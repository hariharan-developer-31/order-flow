import crypto from 'node:crypto';
import {
  ADMIN_USERNAME,
  extractBearerToken,
  formatIST,
  getStorageMode,
  hashPassword,
  loadAuthDb,
  notifyAdminTelegram,
  parseJsonBody,
  sanitizeUser,
  saveAuthDb,
  setCorsHeaders,
  signToken,
  verifyAdminCredentials,
  verifyPassword,
  verifyToken,
} from './_lib/authStore.js';

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Session verification (GET /api/auth)
    if (req.method === 'GET') {
      const token = extractBearerToken(req);
      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ ok: false, error: 'Session expired or invalid.' });
      }

      const db = await loadAuthDb();

      if (payload.role === 'admin') {
        const pendingCount = db.users.filter((u) => u.status === 'pending').length;
        return res.status(200).json({
          ok: true,
          user: {
            id: 'admin',
            name: 'Administrator',
            username: ADMIN_USERNAME,
            role: 'admin',
            status: 'approved',
          },
          pendingCount,
          storageMode: getStorageMode(),
        });
      }

      const existing = db.users.find((u) => u.id === payload.sub);
      if (!existing) {
        return res.status(401).json({ ok: false, error: 'Account no longer exists.' });
      }
      if (existing.status === 'pending') {
        return res.status(403).json({
          ok: false,
          status: 'pending',
          error: 'Your account is pending Admin approval.',
        });
      }
      if (existing.status !== 'approved') {
        return res.status(403).json({
          ok: false,
          status: 'rejected',
          error: 'Your access has been revoked by the Administrator.',
        });
      }

      return res.status(200).json({
        ok: true,
        user: sanitizeUser(existing),
      });
    }

    // 2. Login / Register (POST /api/auth)
    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      const action = String(body.action || '').trim().toLowerCase();

      // --- REGISTER NEW ACCOUNT (PENDING APPROVAL) ---
      if (action === 'register') {
        const name = String(body.name || '').trim();
        const rawUsername = String(body.username || '').trim();
        const username = rawUsername.toLowerCase();
        const password = String(body.password || '');

        if (!name || name.length < 2) {
          return res.status(400).json({ ok: false, error: 'Please enter your full name (min 2 characters).' });
        }
        if (!username || username.length < 3 || username.length > 40) {
          return res.status(400).json({ ok: false, error: 'User ID must be between 3 and 40 characters.' });
        }
        if (!/^[a-z0-9._@-]+$/.test(username)) {
          return res.status(400).json({
            ok: false,
            error: 'User ID can only contain letters, numbers, dots, underscores, hyphens, or @.',
          });
        }
        if (!password || password.length < 4) {
          return res.status(400).json({ ok: false, error: 'Password must be at least 4 characters.' });
        }

        const db = await loadAuthDb();

        if (username === ADMIN_USERNAME || db.users.some((u) => u.username.toLowerCase() === username)) {
          return res.status(409).json({ ok: false, error: 'This User ID is already registered.' });
        }

        const newUser = {
          id: `usr_${crypto.randomBytes(8).toString('hex')}`,
          name,
          username,
          passwordHash: hashPassword(password),
          role: 'user',
          status: 'pending',
          createdAt: formatIST(),
          createdAtTs: Date.now(),
          reviewedAt: null,
          lastLoginAt: null,
        };

        db.users.unshift(newUser);
        await saveAuthDb(db);

        // Fire-and-forget Telegram notification to admin if configured
        notifyAdminTelegram(newUser).catch(() => {});

        return res.status(201).json({
          ok: true,
          status: 'pending',
          user: sanitizeUser(newUser),
          message: 'Account created! Waiting for Admin approval before you can access the terminal.',
        });
      }

      // --- LOGIN ---
      if (action === 'login') {
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!username || !password) {
          return res.status(400).json({ ok: false, error: 'Please enter both User ID and Password.' });
        }

        const db = await loadAuthDb();

        // Check Admin Login first
        if (verifyAdminCredentials(db, username, password)) {
          const token = signToken({
            sub: 'admin',
            username: ADMIN_USERNAME,
            role: 'admin',
          });
          const pendingCount = db.users.filter((u) => u.status === 'pending').length;
          return res.status(200).json({
            ok: true,
            token,
            user: {
              id: 'admin',
              name: 'Administrator',
              username: ADMIN_USERNAME,
              role: 'admin',
              status: 'approved',
            },
            pendingCount,
            storageMode: getStorageMode(),
          });
        }

        // Check Regular User Login
        const found = db.users.find((u) => u.username.toLowerCase() === username);
        if (!found || !verifyPassword(password, found.passwordHash)) {
          return res.status(401).json({ ok: false, error: 'Invalid User ID or Password.' });
        }

        if (found.status === 'pending') {
          return res.status(403).json({
            ok: false,
            status: 'pending',
            error: 'Your account is pending Admin approval. Please wait until the Admin accepts your request.',
          });
        }

        if (found.status === 'rejected') {
          return res.status(403).json({
            ok: false,
            status: 'rejected',
            error: 'Your access request was rejected by the Administrator.',
          });
        }

        // Approved user -> issue token & update last login
        found.lastLoginAt = formatIST();
        await saveAuthDb(db);

        const token = signToken({
          sub: found.id,
          username: found.username,
          role: 'user',
        });

        return res.status(200).json({
          ok: true,
          token,
          user: sanitizeUser(found),
        });
      }

      return res.status(400).json({ ok: false, error: 'Unsupported auth action.' });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[API/AUTH] Error:', err);
    return res.status(500).json({ ok: false, error: 'Authentication service error.' });
  }
}
