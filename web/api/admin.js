import crypto from 'node:crypto';
import {
  ADMIN_USERNAME,
  extractBearerToken,
  formatIST,
  getStorageMode,
  hashPassword,
  loadAuthDb,
  parseJsonBody,
  sanitizeUser,
  saveAuthDb,
  setCorsHeaders,
  verifyAdminCredentials,
  verifyToken,
} from './_lib/authStore.js';

function buildSummary(db) {
  const users = (db.users || []).map(sanitizeUser);
  const counts = {
    pending: users.filter((u) => u.status === 'pending').length,
    approved: users.filter((u) => u.status === 'approved').length,
    rejected: users.filter((u) => u.status === 'rejected').length,
    total: users.length,
  };
  return {
    ok: true,
    storageMode: getStorageMode(),
    adminUsername: ADMIN_USERNAME,
    counts,
    users,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Strictly verify Admin token
  const token = extractBearerToken(req);
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin authorization required.' });
  }

  try {
    const db = await loadAuthDb();

    if (req.method === 'GET') {
      return res.status(200).json(buildSummary(db));
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      const action = String(body.action || '').trim().toLowerCase();

      // 1. Accept / Approve user
      if (action === 'approve') {
        const user = db.users.find((u) => u.id === body.userId);
        if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
        user.status = 'approved';
        user.reviewedAt = formatIST();
        await saveAuthDb(db);
        return res.status(200).json({ ...buildSummary(db), message: `Approved access for ${user.username}.` });
      }

      // 2. Reject / Revoke user
      if (action === 'reject') {
        const user = db.users.find((u) => u.id === body.userId);
        if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
        user.status = 'rejected';
        user.reviewedAt = formatIST();
        await saveAuthDb(db);
        return res.status(200).json({ ...buildSummary(db), message: `Rejected access for ${user.username}.` });
      }

      // 3. Delete user permanently
      if (action === 'delete') {
        const idx = db.users.findIndex((u) => u.id === body.userId);
        if (idx === -1) return res.status(404).json({ ok: false, error: 'User not found.' });
        const [removed] = db.users.splice(idx, 1);
        await saveAuthDb(db);
        return res.status(200).json({ ...buildSummary(db), message: `Deleted account ${removed.username}.` });
      }

      // 4. Directly create an approved user
      if (action === 'create') {
        const name = String(body.name || '').trim();
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!name || name.length < 2) {
          return res.status(400).json({ ok: false, error: 'Full name is required (min 2 chars).' });
        }
        if (!username || username.length < 3 || !/^[a-z0-9._@-]+$/.test(username)) {
          return res.status(400).json({ ok: false, error: 'Valid User ID is required (min 3 chars).' });
        }
        if (!password || password.length < 4) {
          return res.status(400).json({ ok: false, error: 'Password must be at least 4 characters.' });
        }
        if (username === ADMIN_USERNAME || db.users.some((u) => u.username.toLowerCase() === username)) {
          return res.status(409).json({ ok: false, error: 'User ID already exists.' });
        }

        const nowIst = formatIST();
        const newUser = {
          id: `usr_${crypto.randomBytes(8).toString('hex')}`,
          name,
          username,
          passwordHash: hashPassword(password),
          role: 'user',
          status: 'approved',
          createdAt: nowIst,
          createdAtTs: Date.now(),
          reviewedAt: nowIst,
          lastLoginAt: null,
        };

        db.users.unshift(newUser);
        await saveAuthDb(db);
        return res.status(201).json({ ...buildSummary(db), message: `Created approved account ${username}.` });
      }

      // 5. Change Admin Password
      if (action === 'change_admin_password') {
        const currentPassword = String(body.currentPassword || '');
        const newPassword = String(body.newPassword || '');

        if (!verifyAdminCredentials(db, ADMIN_USERNAME, currentPassword)) {
          return res.status(401).json({ ok: false, error: 'Current admin password is incorrect.' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ ok: false, error: 'New admin password must be at least 6 characters.' });
        }

        db.adminPasswordHash = hashPassword(newPassword);
        await saveAuthDb(db);
        return res.status(200).json({ ...buildSummary(db), message: 'Admin password updated successfully.' });
      }

      return res.status(400).json({ ok: false, error: 'Unsupported admin action.' });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[API/ADMIN] Error:', err);
    return res.status(500).json({ ok: false, error: 'Admin service error.' });
  }
}
