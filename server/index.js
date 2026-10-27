import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
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
await db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT "user", plan TEXT NOT NULL DEFAULT "free" CHECK(plan IN ("free", "premium")), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
const userColumns = await db.all('PRAGMA table_info(users)');
if (!userColumns.some(column => column.name === 'plan')) await db.exec('ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT "free"');
if (!userColumns.some(column => column.name === 'discord_id')) await db.exec('ALTER TABLE users ADD COLUMN discord_id TEXT');
await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_discord_id_unique ON users(discord_id) WHERE discord_id IS NOT NULL');
await db.exec('CREATE TABLE IF NOT EXISTS bots (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, discord_user_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))');

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, plan: u.plan || 'free', createdAt: u.created_at });
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
app.get('/api/health', (_req, res) => res.json({ ok: true, status: 'ok', service: 'discord-โปรโมท API', time: new Date().toISOString() }));


const discordOAuthStates = new Map();
const frontendUrl = (process.env.FRONTEND_URL || 'https://to-discord-bot.vercel.app').replace(/\/$/, '');
const discordRedirectUri = process.env.DISCORD_REDIRECT_URI || '';
app.get('/api/auth/discord', (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !discordRedirectUri) {
    return res.status(503).send('Discord OAuth ยังตั้งค่าไม่ครบ: ต้องกำหนด DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET และ DISCORD_REDIRECT_URI ที่ Backend');
  }
  const state = randomBytes(24).toString('hex');
  discordOAuthStates.set(state, Date.now() + 10 * 60 * 1000);
  for (const [key, expiry] of discordOAuthStates) if (expiry < Date.now()) discordOAuthStates.delete(key);
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: discordRedirectUri,
    response_type: 'code',
    scope: 'identify email',
    state
  });
  res.redirect('https://discord.com/oauth2/authorize?' + params.toString());
});
app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(frontendUrl + '/#discord_error=' + encodeURIComponent('ยกเลิกการอนุญาต Discord'));
  const expiry = discordOAuthStates.get(String(state || ''));
  discordOAuthStates.delete(String(state || ''));
  if (!code || !expiry || expiry < Date.now()) return res.redirect(frontendUrl + '/#discord_error=' + encodeURIComponent('สถานะ OAuth ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่'));
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: discordRedirectUri
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error('Discord token exchange failed');
    const discordResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token }
    });
    const discordUser = await discordResponse.json();
    if (!discordResponse.ok || !discordUser.id || !discordUser.email || discordUser.verified !== true) {
      return res.redirect(frontendUrl + '/#discord_error=' + encodeURIComponent('บัญชี Discord ต้องมีอีเมลที่ยืนยันแล้ว'));
    }
    let user = await db.get('SELECT * FROM users WHERE discord_id = ?', String(discordUser.id));
    if (!user) {
      user = await db.get('SELECT * FROM users WHERE email = ?', String(discordUser.email).toLowerCase());
      if (user) {
        await db.run('UPDATE users SET discord_id = ? WHERE id = ?', String(discordUser.id), user.id);
        user = await db.get('SELECT * FROM users WHERE id = ?', user.id);
      } else {
        const name = String(discordUser.global_name || discordUser.username || 'Discord User').slice(0, 60);
        const randomPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
        const result = await db.run('INSERT INTO users(name,email,password_hash,discord_id) VALUES(?,?,?,?)',
          name, String(discordUser.email).toLowerCase(), randomPasswordHash, String(discordUser.id));
        user = await db.get('SELECT * FROM users WHERE id = ?', result.lastID);
      }
    }
    const token = tokenFor(user);
    return res.redirect(frontendUrl + '/#discord_token=' + encodeURIComponent(token));
  } catch (err) {
    console.error('Discord OAuth error:', err.message);
    return res.redirect(frontendUrl + '/#discord_error=' + encodeURIComponent('เข้าสู่ระบบ Discord ไม่สำเร็จ กรุณาลองใหม่'));
  }
});

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
    const user = await db.get('SELECT id,name,email,role,plan,created_at FROM users WHERE id = ?', result.lastID);
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
  const user = await db.get('SELECT id,name,email,role,plan,created_at FROM users WHERE id = ?', Number(req.session.sub));
  if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });
  res.json({ user: publicUser(user) });
});
app.patch('/api/me', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
  const user = await db.get('SELECT plan FROM users WHERE id = ?', Number(req.session.sub));
  const currentCount = await db.get('SELECT COUNT(*) AS count FROM bots WHERE user_id = ?', Number(req.session.sub));
  const botLimit = user?.plan === 'premium' ? 10 : 1;
  if ((currentCount?.count || 0) >= botLimit) return res.status(403).json({ error: user?.plan === 'premium' ? 'แพ็กเกจ Premium ถึงขีดจำกัดบอตแล้ว' : 'แพ็กเกจ Free เพิ่มได้ 1 บอตเท่านั้น กรุณาลบบอตเดิมก่อนเพิ่มใหม่' });
  const result = await db.run('INSERT INTO bots(user_id,name,discord_user_id) VALUES(?,?,?)', Number(req.session.sub), name, discordUserId);
  res.status(201).json({ bot: { id: result.lastID, name, discordUserId } });
});
app.delete('/api/bots/:id', requireAuth, async (req, res) => {
  const result = await db.run('DELETE FROM bots WHERE id = ? AND user_id = ?', Number(req.params.id), Number(req.session.sub));
  if (!result.changes) return res.status(404).json({ error: 'ไม่พบบอตนี้' });
  res.status(204).end();
});
await db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bot','server','video')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL,
    followed_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(follower_id, followed_id),
    FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(followed_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS post_likes (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, post_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
`);
const postShape = row => ({
  id: String(row.id), type: row.type, title: row.title, body: row.body, url: row.url,
  tags: JSON.parse(row.tags || '[]'), ownerId: String(row.user_id), owner: row.owner,
  handle: '@' + String(row.owner || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24),
  avatar: String(row.owner || 'U').slice(0, 1).toUpperCase(), verified: row.role === 'admin',
  likes: Number(row.likes || 0), comments: Number(row.comments || 0), views: Number(row.views || 0),
  following: Boolean(row.following), time: row.created_at
});
const postSelect = `
 SELECT p.*, u.name AS owner, u.role,
 (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
 (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comments,
 0 AS views,
 EXISTS(SELECT 1 FROM follows f WHERE f.followed_id=p.user_id AND f.follower_id=?) AS following
 FROM posts p JOIN users u ON u.id=p.user_id
`;
app.get('/api/posts', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const type = ['bot','server','video'].includes(req.query.type) ? req.query.type : null;
  const userId = (() => { try { const h=req.headers.authorization||''; return h.startsWith('Bearer ')?Number(jwt.verify(h.slice(7),jwtSecret,{issuer:'to-discord-bot-api'}).sub):0; } catch { return 0; } })();
  const clauses = [], params = [userId];
  if (type) { clauses.push('p.type=?'); params.push(type); }
  if (q) { clauses.push('(p.title LIKE ? OR p.body LIKE ? OR p.tags LIKE ?)'); params.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
  const rows = await db.all(postSelect + (clauses.length ? ' WHERE '+clauses.join(' AND ') : '') + ' ORDER BY p.id DESC LIMIT 100', ...params);
  res.json({ posts: rows.map(postShape) });
});
app.post('/api/posts', requireAuth, async (req, res) => {
  const type = String(req.body?.type || '');
  const title = String(req.body?.title || '').trim().slice(0,100);
  const body = String(req.body?.body || '').trim().slice(0,1500);
  const url = String(req.body?.url || '').trim().slice(0,2048);
  const tags = Array.isArray(req.body?.tags) ? req.body.tags : String(req.body?.tags || '').split(/[ ,]+/).filter(Boolean);
  if (!['bot','server','video'].includes(type) || title.length < 2 || !body) return res.status(400).json({error:'กรอกประเภท หัวข้อ และรายละเอียดให้ครบ'});
  if (url && !/^https:\/\//i.test(url)) return res.status(400).json({error:'ลิงก์ต้องเป็น HTTPS'});
  const safeTags = [...new Set(tags.map(t=>String(t).replace(/^#/,'').replace(/[^\p{L}\p{N}_-]/gu,'').slice(0,30)).filter(Boolean))].slice(0,10).map(t=>'#'+t);
  const result = await db.run('INSERT INTO posts(user_id,type,title,body,url,tags) VALUES(?,?,?,?,?,?)',Number(req.session.sub),type,title,body,url,JSON.stringify(safeTags));
  const rows = await db.all(postSelect+' WHERE p.id=?',[Number(req.session.sub),result.lastID]);
  res.status(201).json({post:postShape(rows[0])});
});
app.post('/api/posts/:id/like', requireAuth, async (req,res) => {
  const postId=Number(req.params.id), userId=Number(req.session.sub);
  const exists=await db.get('SELECT 1 FROM posts WHERE id=?',postId);
  if(!exists)return res.status(404).json({error:'ไม่พบโพสต์'});
  const liked=await db.get('SELECT 1 FROM post_likes WHERE user_id=? AND post_id=?',userId,postId);
  if(liked) await db.run('DELETE FROM post_likes WHERE user_id=? AND post_id=?',userId,postId);
  else await db.run('INSERT INTO post_likes(user_id,post_id) VALUES(?,?)',userId,postId);
  const count=await db.get('SELECT COUNT(*) AS count FROM post_likes WHERE post_id=?',postId);
  res.json({liked:!liked,likes:count.count});
});
app.post('/api/posts/:id/comments', requireAuth, async (req,res) => {
  const postId=Number(req.params.id), body=String(req.body?.body||'').trim().slice(0,1000);
  if(!body)return res.status(400).json({error:'กรอกความคิดเห็นก่อน'});
  const post=await db.get('SELECT id FROM posts WHERE id=?',postId);
  if(!post)return res.status(404).json({error:'ไม่พบโพสต์'});
  const result=await db.run('INSERT INTO comments(user_id,post_id,body) VALUES(?,?,?)',Number(req.session.sub),postId,body);
  const row=await db.get('SELECT c.id,c.body,c.created_at,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=?',result.lastID);
  res.status(201).json({comment:{id:row.id,body:row.body,name:row.name,createdAt:row.created_at}});
});
app.get('/api/posts/:id/comments', async (req,res) => {
  const rows=await db.all('SELECT c.id,c.body,c.created_at AS createdAt,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC LIMIT 100',Number(req.params.id));
  res.json({comments:rows});
});
app.post('/api/users/:id/follow', requireAuth, async (req,res) => {
  const followerId=Number(req.session.sub), followedId=Number(req.params.id);
  if(!Number.isInteger(followedId)||followedId===followerId)return res.status(400).json({error:'ไม่สามารถติดตามบัญชีนี้ได้'});
  const target=await db.get('SELECT id FROM users WHERE id=?',followedId);
  if(!target)return res.status(404).json({error:'ไม่พบบัญชีผู้ใช้'});
  const exists=await db.get('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?',followerId,followedId);
  if(exists)await db.run('DELETE FROM follows WHERE follower_id=? AND followed_id=?',followerId,followedId);
  else await db.run('INSERT INTO follows(follower_id,followed_id) VALUES(?,?)',followerId,followedId);
  res.json({following:!exists});
});
app.get('/api/me/follows', requireAuth, async (req,res) => {
 const rows=await db.all('SELECT u.id,u.name FROM follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=?',Number(req.session.sub));
 res.json({users:rows.map(u=>({id:String(u.id),name:u.name}))});
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.all('SELECT id,name,email,role,plan,created_at AS createdAt FROM users ORDER BY id DESC LIMIT 200');
  res.json({ users });
});
app.use((err, _req, res, _next) => {
  console.error('API error:', err.message);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
});
app.listen(port, '0.0.0.0', () => console.log('TO Discord BOT API listening on ' + port));
