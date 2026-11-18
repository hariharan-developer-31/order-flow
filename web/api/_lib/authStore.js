/**
 * Secure Authentication & User Approval Store for TRADING BOY Terminal
 * Zero external dependencies — uses Node.js built-in crypto, fs, os, path & fetch.
 *
 * Persistence Priority:
 *  1. Upstash Redis / Vercel KV REST API (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *     or KV_REST_API_URL + KV_REST_API_TOKEN) — permanent cross-device cloud storage.
 *  2. Ephemeral local JSON file (os.tmpdir()/tb_auth_users_db.json) + in-memory cache.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DB_KEY = 'tb_terminal_auth_db_v1';
const LOCAL_DB_FILE = path.join(os.tmpdir(), 'tb_auth_users_db.json');

// Configurable via Vercel Environment Variables (with safe defaults)
export const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TradingBoy@2026';
const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  crypto
    .createHash('sha256')
    .update(`tb-auth-secret-v1::${ADMIN_USERNAME}::${DEFAULT_ADMIN_PASSWORD}`)
    .digest('hex');

const KV_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

let memoryDb = null;

export function getStorageMode() {
  return KV_URL && KV_TOKEN ? 'cloud_kv' : 'local_memory';
}

export function formatIST(date = new Date()) {
  try {
    return (
      date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ' IST'
    );
  } catch {
    return date.toISOString();
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(String(password), salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function signToken(payload, ttlSeconds = 7 * 24 * 3600) {
  const data = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = base64UrlEncode(JSON.stringify(data));
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function createEmptyDb() {
  return {
    users: [],
    adminPasswordHash: null,
    updatedAt: Date.now(),
  };
}

export async function loadAuthDb() {
  // 1. Try Cloud KV (Upstash Redis / Vercel KV REST)
  if (KV_URL && KV_TOKEN) {
    try {
      const endpoint = `${KV_URL.replace(/\/+$/, '')}/get/${encodeURIComponent(DB_KEY)}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.result) {
          const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
          if (parsed && Array.isArray(parsed.users)) {
            memoryDb = parsed;
            return parsed;
          }
        }
        const fresh = createEmptyDb();
        memoryDb = fresh;
        return fresh;
      }
    } catch (err) {
      console.warn('[AUTH_STORE] Cloud KV read failed, using fallback:', err.message);
    }
  }

  // 2. Try local /tmp JSON file
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) {
        memoryDb = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[AUTH_STORE] Local file read note:', err.message);
  }

  // 3. Fallback to in-memory cache
  if (memoryDb && Array.isArray(memoryDb.users)) {
    return memoryDb;
  }

  memoryDb = createEmptyDb();
  return memoryDb;
}

export async function saveAuthDb(db) {
  db.updatedAt = Date.now();
  memoryDb = db;

  // 1. Save to Cloud KV if configured
  if (KV_URL && KV_TOKEN) {
    try {
      const endpoint = `${KV_URL.replace(/\/+$/, '')}/set/${encodeURIComponent(DB_KEY)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(db),
      });
      if (!res.ok) {
        console.warn('[AUTH_STORE] Cloud KV write HTTP', res.status);
      }
    } catch (err) {
      console.warn('[AUTH_STORE] Cloud KV write failed:', err.message);
    }
  }

  // 2. Also persist to local /tmp file
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[AUTH_STORE] Local file write note:', err.message);
  }
}

export function verifyAdminCredentials(db, username, password) {
  const cleanUser = String(username || '').trim().toLowerCase();
  if (cleanUser !== ADMIN_USERNAME) return false;

  if (db?.adminPasswordHash) {
    return verifyPassword(password, db.adminPasswordHash);
  }
  return String(password || '') === DEFAULT_ADMIN_PASSWORD;
}

export function sanitizeUser(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role || 'user',
    status: u.status, // 'pending' | 'approved' | 'rejected'
    createdAt: u.createdAt,
    reviewedAt: u.reviewedAt || null,
    lastLoginAt: u.lastLoginAt || null,
  };
}

export async function notifyAdminTelegram(user) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const text =
      `🔔 *New Webapp Access Request*\n\n` +
      `👤 *Name:* ${user.name}\n` +
      `🆔 *ID:* \`${user.username}\`\n` +
      `🕒 *Time:* ${user.createdAt}\n\n` +
      `Open the *Admin Panel* in the webapp to Accept or Reject this user.`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-blocking notification
  }
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
