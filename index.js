import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import db from './server/db.js';
import {
  generateToken,
  storeToken,
  authMiddleware,
  COOKIE_NAME,
} from './server/auth.js';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// --- Registration ---
app.post('/api/register', (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password and full name required' });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare(
      'INSERT INTO users (email, password_hash, full_name, balance) VALUES (?, ?, ?, 1000)'
    );
    const result = stmt.run(email, hash, fullName.trim());
    res.status(201).json({
      id: result.lastInsertRowid,
      email,
      fullName: fullName.trim(),
      message: 'Registration successful',
    });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw e;
  }
});

// --- Login: generate token, store in DB, set cookie ---
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT id, email, full_name, password_hash FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = generateToken(user.id);
  storeToken(user.id, token);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    message: 'Login successful',
  });
});

// --- Logout: clear cookie (optional: remove token from DB) ---
app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ message: 'Logged out' });
});

// --- Check balance (JWT from cookie, validate, return balance) ---
app.get('/api/balance', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.userId);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ balance: row.balance });
});

// --- Deposit ---
app.post('/api/deposit', authMiddleware, (req, res) => {
  const { amount } = req.body;
  if (amount == null || amount <= 0) {
    return res.status(400).json({ error: 'Positive amount required' });
  }
  const numAmount = Number(amount);
  const update = db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
  const record = db.prepare('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)');

  try {
    db.exec('BEGIN');
    update.run(numAmount, req.userId);
    record.run(req.userId, 'deposit', numAmount);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.userId);
  res.json({ message: 'Deposit successful', balance: newBalance.balance });
});

// --- Withdraw ---
app.post('/api/withdraw', authMiddleware, (req, res) => {
  const { amount } = req.body;
  if (amount == null || amount <= 0) {
    return res.status(400).json({ error: 'Positive amount required' });
  }
  const numAmount = Number(amount);
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.userId);
  if (user.balance < numAmount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const update = db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?');
  const record = db.prepare('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)');

  try {
    db.exec('BEGIN');
    update.run(numAmount, req.userId);
    record.run(req.userId, 'withdraw', numAmount);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.userId);
  res.json({ message: 'Withdrawal successful', balance: newBalance.balance });
});

// --- Transaction History ---
app.get('/api/transactions', authMiddleware, (req, res) => {
  const transactions = db.prepare(
    'SELECT type, amount, other_party, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.userId);
  res.json(transactions);
});

// --- Send money ---
app.post('/api/send-money', authMiddleware, (req, res) => {
  const { toEmail, amount } = req.body;
  if (!toEmail || amount == null || amount <= 0) {
    return res.status(400).json({ error: 'Valid toEmail and positive amount required' });
  }
  const sender = db.prepare('SELECT id, email, balance FROM users WHERE id = ?').get(req.userId);
  const recipient = db.prepare('SELECT id, email, balance FROM users WHERE email = ?').get(toEmail);

  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  if (recipient.id === sender.id) return res.status(400).json({ error: 'Cannot send to yourself' });

  const numAmount = Number(amount);
  if (sender.balance < numAmount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const updateBalance = db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
  const recordTx = db.prepare('INSERT INTO transactions (user_id, type, amount, other_party) VALUES (?, ?, ?, ?)');

  try {
    db.exec('BEGIN');
    // Deduct from sender
    updateBalance.run(-numAmount, sender.id);
    recordTx.run(sender.id, 'sent', numAmount, recipient.email);

    // Add to recipient
    updateBalance.run(numAmount, recipient.id);
    recordTx.run(recipient.id, 'received', numAmount, sender.email);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.userId);
  res.json({ message: 'Transfer successful', balance: newBalance.balance });
});

// --- AI Chat Proxy ---
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages) {
    return res.status(400).json({ error: 'Messages are required' });
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.2-3B-Instruct',
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        errorData = { error: text || 'Unknown API error' };
      }
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('AI Proxy Error:', error);
    res.status(500).json({ error: 'Failed to connect to AI service' });
  }
});

// --- Optional: get current user (for UI) ---
app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, full_name FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
  });
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Bank API running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer(PORT);
}

