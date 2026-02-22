import jwt from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bank-simulation-secret-change-in-production';
const COOKIE_NAME = 'bank_token';

export function generateToken(userId) {
  return jwt.sign(
    {
      userId,
      iat: Math.floor(Date.now() / 1000),
      nonce: Math.random().toString(36).substring(7)
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export function storeToken(userId, token) {
  const stmt = db.prepare(
    'INSERT INTO tokens (user_id, token) VALUES (?, ?)'
  );
  stmt.run(userId, token);
}

export function findTokenInDb(token) {
  const row = db.prepare('SELECT user_id FROM tokens WHERE token = ?').get(token);
  return row ? row.user_id : null;
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const userIdInDb = findTokenInDb(token);
  if (userIdInDb !== payload.userId) {
    return res.status(401).json({ error: 'Token not found' });
  }
  req.userId = payload.userId;
  next();
}

export { COOKIE_NAME, JWT_SECRET };
