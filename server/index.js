import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const app = express();
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET;
const allowedOrigins = [...new Set(['http://localhost:5173', 'http://localhost:4173', 'capacitor://localhost', 'https://localhost', ...(process.env.CLIENT_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean)])];
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('Configure JWT_SECRET with at least 32 random characters.');
  process.exit(1);
}
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const here = path.dirname(fileURLToPath(import.meta.url));
const db = await open({ filename: process.env.DATABASE_PATH || path.join(here, 'data.sqlite'), driver: sqlite3.Database });
await db.exec('PRAGMA journal_mode = WAL;');
await db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT "user", created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
await db.exec('CREATE TABLE IF NOT EXISTS bots (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, discord_user_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))');

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at });
const tokenFor = u => jwt.sign({ sub: String(u.id), role: u.role }, jwtSecret, { expiresIn: '12h', issuer: 'to-discord-bot-api' });
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  try {
    if (!header.startsWith('Bearer ')) throw new Error('missing token');
    req.session = jwt.verify(header.slice(7), jwtSecret, { issuer: 'to-discord-bot-api' });
    next();
  } catch {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
  }
}
function requireAdmin(req, res, next) {
  if (req.session?.role !== 'admin') return res.status(403).json({ error: 'ต้องใช้สิทธิ์ผู้ดูแลระบบ' });
  next();
}
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'TO Discord BOT API', time: new Date().toISOString() }));

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'กรอกชื่อ อีเมลให้ถูกต้อง และรหัสผ่าน 8–128 ตัวอักษร' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.run('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)', name, email, hash);
    const user = await db.get('SELECT id,name,email,role,created_at FROM users WHERE id = ?', result.lastID);
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'อีเมลนี้มีบัญชีแล้ว' });
    console.error('register error:', err.message);
    res.status(500).json({ error: 'ไม่สามารถสมัครสมาชิกได้ในขณะนี้' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await db.get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  res.json({ token: tokenFor(user), user: publicUser(user) });
});
app.get('/api/me', requireAuth, async (req, res) => {
  const user = await db.get('SELECT id,name,email,role,created_at FROM users WHERE id = ?', Number(req.session.sub));
  if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });
  res.json({ user: publicUser(user) });
});
app.patch('/api/me', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (name.length < 2 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'กรอกชื่ออย่างน้อย 2 ตัวอักษรและอีเมลให้ถูกต้อง' });
  }
  try {
    await db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', name, email, Number(req.session.sub));
    const user = await db.get('SELECT id,name,email,role,created_at FROM users WHERE id = ?', Number(req.session.sub));
    if (!user) return res.status(404).json({ error: 'ไม่พบบัญชีผู้ใช้' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    console.error('profile update error:', err.message);
    res.status(500).json({ error: 'บันทึกโปรไฟล์ไม่สำเร็จ' });
  }
});
app.get('/api/bots', requireAuth, async (req, res) => {
  const bots = await db.all('SELECT id,name,discord_user_id AS discordUserId,created_at AS createdAt FROM bots WHERE user_id = ? ORDER BY id DESC', Number(req.session.sub));
  res.json({ bots });
});
app.post('/api/bots', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const discordUserId = String(req.body?.discordUserId || '').trim().slice(0, 30) || null;
  if (name.length < 2) return res.status(400).json({ error: 'ชื่อบอตต้องมีอย่างน้อย 2 ตัวอักษร' });
  const result = await db.run('INSERT INTO bots(user_id,name,discord_user_id) VALUES(?,?,?)', Number(req.session.sub), name, discordUserId);
  res.status(201).json({ bot: { id: result.lastID, name, discordUserId } });
});
app.delete('/api/bots/:id', requireAuth, async (req, res) => {
  const result = await db.run('DELETE FROM bots WHERE id = ? AND user_id = ?', Number(req.params.id), Number(req.session.sub));
  if (!result.changes) return res.status(404).json({ error: 'ไม่พบบอตนี้' });
  res.status(204).end();
});
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.all('SELECT id,name,email,role,created_at AS createdAt FROM users ORDER BY id DESC LIMIT 200');
  res.json({ users });
});
app.use((err, _req, res, _next) => {
  console.error('API error:', err.message);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
});
app.listen(port, '0.0.0.0', () => console.log('TO Discord BOT API listening on ' + port));
