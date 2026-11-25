import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import nodemailer from 'nodemailer'
import ipaddr from 'ipaddr.js'
import { payloads, publicCover, publicWork, readCover, uploadedMod, validatePlay, validateProtectedPlay, validateReviewPlay, validateWork } from './content.mjs'
import { complete, endpoint } from './upstream.mjs'
import { playGuard, playReceipt, repeatsSource, requestsSource, reviewGuard, validPlayReceipt } from './play-privacy.mjs'

const origin = new URL(process.env.FRONTEND_ORIGIN).origin
const production = process.env.NODE_ENV === 'production'
const androidOrigin = 'https://localhost'
const databasePath = process.env.DATABASE_PATH || ':memory:'
const configuredKey = process.env.WORKSHOP_CONTENT_KEY
if ((configuredKey !== undefined && !/^[a-f0-9]{64}$/i.test(configuredKey)) ||
    ((production || databasePath !== ':memory:') && !configuredKey)) {
  throw new Error('Set WORKSHOP_CONTENT_KEY to a stable 32-byte hexadecimal key')
}
const contentKey = configuredKey ? Buffer.from(configuredKey, 'hex') : randomBytes(32)
const receiptKey = createHmac('sha256', contentKey).update('mellow-workshop-play-receipt-v1').digest()
const reviewerEmail = '2807117538@qq.com'
const isReviewer = user => user?.email === reviewerEmail
const reviewModel = process.env.WORKSHOP_REVIEW_ENDPOINT && process.env.WORKSHOP_REVIEW_KEY && process.env.WORKSHOP_REVIEW_MODEL
  ? { address: endpoint(process.env.WORKSHOP_REVIEW_ENDPOINT), key: process.env.WORKSHOP_REVIEW_KEY, model: process.env.WORKSHOP_REVIEW_MODEL }
  : null
const playModel = process.env.WORKSHOP_PLAY_ENDPOINT && process.env.WORKSHOP_PLAY_KEY && process.env.WORKSHOP_PLAY_MODEL
  ? { address: endpoint(process.env.WORKSHOP_PLAY_ENDPOINT), key: process.env.WORKSHOP_PLAY_KEY, model: process.env.WORKSHOP_PLAY_MODEL }
  : null
const smtp = process.env.SMTP_URL ? new URL(process.env.SMTP_URL) : null
if (smtp && !['smtp:', 'smtps:'].includes(smtp.protocol)) throw new Error('SMTP_URL must use smtp or smtps')
const blockedIPs = (process.env.BLOCKED_UPSTREAM_IPS ?? '').split(',').map(ip => ip.trim())
if (production && (new URL(origin).protocol !== 'https:' || !smtp || !process.env.MAIL_FROM ||
    !blockedIPs.every(ip => ipaddr.IPv4.isValidFourPartDecimal(ip)))) {
  throw new Error('Production requires HTTPS frontend, SMTP, sender and blocked host IPv4 addresses')
}
const mail = smtp ? nodemailer.createTransport({
  host: smtp.hostname, port: Number(smtp.port || (smtp.protocol === 'smtps:' ? 465 : 587)),
  secure: smtp.protocol === 'smtps:', requireTLS: production && smtp.protocol !== 'smtps:',
  auth: smtp.username ? { user: decodeURIComponent(smtp.username), pass: decodeURIComponent(smtp.password) } : undefined,
  connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
}) : null
process.umask(0o077)
const db = new DatabaseSync(databasePath)
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
db.exec("UPDATE comments SET status = 'approved' WHERE status = 'pending'")

function seal(text, id, slot) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', contentKey, nonce)
  cipher.setAAD(Buffer.from(id + ':' + slot))
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return 'v1:' + Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64')
}
function unseal(text, id, slot) {
  if (!text.startsWith('v1:')) throw new Error('Unknown work format')
  const data = Buffer.from(text.slice(3), 'base64')
  const cipher = createDecipheriv('aes-256-gcm', contentKey, data.subarray(0, 12))
  cipher.setAAD(Buffer.from(id + ':' + slot))
  cipher.setAuthTag(data.subarray(12, 28))
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8')
}
const encryptedWork = db.prepare("SELECT id,draft FROM works WHERE draft LIKE 'v1:%' LIMIT 1").get()
if (encryptedWork) unseal(encryptedWork.draft, encryptedWork.id, 'draft')
db.exec('PRAGMA secure_delete = ON; BEGIN IMMEDIATE')
let migrated = false
try {
  const batch = db.prepare("SELECT id,draft,published FROM works WHERE id > ? AND (draft NOT LIKE 'v1:%' OR published NOT LIKE 'v1:%') ORDER BY id LIMIT 25")
  const write = db.prepare('UPDATE works SET draft = ?, published = ? WHERE id = ?')
  let cursor = ''
  for (let rows = batch.all(cursor); rows.length; rows = batch.all(cursor)) {
    for (const row of rows) {
      write.run(row.draft.startsWith('v1:') ? row.draft : seal(row.draft, row.id, 'draft'),
        row.published && (row.published.startsWith('v1:') ? row.published : seal(row.published, row.id, 'published')), row.id)
      cursor = row.id
      migrated = true
    }
  }
  db.exec('COMMIT')
} catch (failure) {
  db.exec('ROLLBACK')
  throw failure
}
if (migrated) db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE)')

const publishedText = row => unseal(row.published, row.id, 'published')
const categories = ['character', 'world', 'simulator', 'mod']
const fallbackCategory = type => type === 'dlc' ? 'mod' : 'character'
if (!db.prepare('PRAGMA table_info(likes)').all().some(column => column.name === 'created_at')) {
  db.exec('ALTER TABLE likes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0')
}
if (!db.prepare('PRAGMA table_info(installs)').all().some(column => column.name === 'installed_at')) {
  db.exec('ALTER TABLE installs ADD COLUMN installed_at INTEGER NOT NULL DEFAULT 0')
}
const backfill = db.prepare('INSERT OR IGNORE INTO work_categories VALUES (?, ?, ?, ?)')
for (const row of db.prepare('SELECT w.id, w.type, w.published FROM works w LEFT JOIN work_categories c ON c.work_id = w.id WHERE c.work_id IS NULL').all()) {
  const published = row.published ? JSON.parse(publishedText(row)) : null
  backfill.run(row.id, fallbackCategory(row.type), published?.title ?? null, published?.summary ?? null)
}
const listWork = row => ({
  ...publicWork({ ...row, published: publishedText(row) }),
  endpoints: [],
  category: row.category ?? fallbackCategory(row.type),
  creatorId: row.author_id,
  creatorName: row.creatorName ?? '创作者 ' + row.author_id,
  ...(isLaunchExample(row) ? { launchExample: true } : {}),
})
const app = express()
app.disable('x-powered-by')
if (production) app.set('trust proxy', 1)
app.set('etag', false)

function limit(max, interval, key = req => req.ip) {
  const buckets = new Map()
  setInterval(() => {
    for (const [id, bucket] of buckets) if (bucket.until <= Date.now()) buckets.delete(id)
  }, interval).unref()
  return (req, res, next) => {
    const id = key(req)
    let bucket = buckets.get(id)
    if (!bucket || bucket.until <= Date.now()) {
      if (buckets.size >= 10000 && !bucket) return res.status(429).json({ error: '请求过多，请稍后重试' })
      bucket = { count: 0, until: Date.now() + interval }
      buckets.set(id, bucket)
    }
    if (++bucket.count > max) return res.status(429).json({ error: '请求过多，请稍后重试' })
    next()
  }
}

app.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).vary('Origin')
  const requestOrigin = req.get('origin')
  if (requestOrigin === origin || requestOrigin === androidOrigin) {
    res.set({
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
  } else if (req.get('origin') || !['GET', 'HEAD'].includes(req.method)) {
    return res.status(403).json({ error: '来源不允许' })
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.get('/health', (_req, res) => res.json({ ok: true }))
app.use(limit(150, 60_000))
const json = express.json({ limit: '256kb' })
const imageJson = express.json({ limit: '3mb' })
app.use((req, res, next) => {
  const upload = (req.method === 'POST' || req.method === 'PUT') && /^\/(?:mine\/[^/]+|preview\/dlc|profile)\/?$/.test(req.path)
  return (upload ? imageJson : json)(req, res, next)
})

const digest = value => createHash('sha256').update(value).digest('hex')
const token = () => randomBytes(32).toString('base64url')
const get = (sql, ...args) => db.prepare(sql).get(...args)
const all = (sql, ...args) => db.prepare(sql).all(...args)
const run = (sql, ...args) => db.prepare(sql).run(...args)
const launchSlug = row => get('SELECT slug FROM launch_examples WHERE work_id = ? AND revision = ?', row.id, row.revision)?.slug
const isLaunchExample = row => Boolean(launchSlug(row))
const launchBriefs = {
  hehuan: '主持《合欢宗求生手册》。从入宗文牒开始，请玩家自定成年修士的道号、灵根、师承和愿望。以轻巧的修真宗门故事推进九洲历练、同门关系和宗门事务。每幕给出少量可选行动，允许自拟；保留玩家行动自主权，追踪已定设定和事件后果。',
  instinct: '主持《本能法则》。在架空都市，信息素、社会阶层与匹配制度引出自由选择的矛盾。先让玩家自定成年身份、职业、立场或随机开局。根据玩家决定推进人际关系与社会事件，每轮提供可选择也可忽略的行动。人物都有各自意愿，尊重自愿与边界。',
  tragedy: '主持《某乎虐文模拟器》。先让玩家指定背景、成年主角、关系、核心虐点及内容边界。担任编剧、旁白与配角，按选择推演追悔、错过、反转等情节，维持逻辑与人物一致性，结局由玩家决定。',
}
const cookie = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' }
const sessionCookie = req => req.get('origin') === androidOrigin
  ? { ...cookie, sameSite: 'none', secure: true, partitioned: true }
  : cookie
const cookieName = production ? '__Host-mellow_session' : 'mellow_session'
const error = (res, status, message) => res.status(status).json({ error: message })
const normalizeEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : ''
const validEmail = email => email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_{}|~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)
const validPassword = value => typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value) <= 256
const derive = promisify(scrypt)
const dummySalt = randomBytes(16).toString('hex')
const dummyHash = randomBytes(64)
let deriving = 0
async function passwordHash(password, salt) {
  deriving++
  try { return await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 48 * 1024 * 1024 }) }
  finally { deriving-- }
}
const ban = id => get("SELECT action, reason FROM account_actions WHERE user_id = ? AND action IN ('ban','unban') ORDER BY id DESC LIMIT 1", id)
function sessionUser(user) {
  return {
    ...user, reviewer: isReviewer(user),
    warnings: all("SELECT id, reason AS message, created_at AS createdAt FROM account_actions WHERE user_id = ? AND action = 'warn' ORDER BY id DESC LIMIT 20", user.id),
  }
}

app.use((req, _res, next) => {
  const value = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
  if (value && /^[A-Za-z0-9_-]{43}$/.test(value)) {
    req.session = digest(value)
    req.user = get('SELECT users.id, email FROM users JOIN sessions ON users.id = sessions.user_id JOIN passwords ON passwords.user_id = users.id WHERE digest = ? AND expires > ?', req.session, Date.now())
  }
  next()
})
const signedIn = (req, res, next) => {
  if (!req.user) return error(res, 401, '请先登录')
  if (ban(req.user.id)?.action === 'ban') return error(res, 403, '此账号已被封禁')
  next()
}
const reviewer = (req, res, next) => isReviewer(req.user) ? next() : error(res, 403, '需要审核权限')

app.post('/auth/email', limit(5, 900_000), async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!validEmail(email)) return error(res, 400, '请填写有效邮箱')
  if (get('SELECT 1 FROM users JOIN passwords ON passwords.user_id = users.id WHERE email = ?', email)) return res.sendStatus(202)
  if (!mail) return error(res, 503, '邮件登录尚未配置')
  const now = Date.now()
  run('DELETE FROM login_links WHERE expires <= ?', now)
  run('DELETE FROM sessions WHERE expires <= ?', now)
  if (get('SELECT COUNT(*) AS count FROM login_links WHERE email = ?', email).count >= 2) return res.sendStatus(202)
  const code = token()
  const hashed = digest(code)
  run('INSERT INTO login_links VALUES (?, ?, ?)', hashed, email, now + 900_000)
  try {
    await mail.sendMail({ from: process.env.MAIL_FROM, to: { address: email }, subject: '半糖 Mellow 邮箱验证', text: '在半糖注册页面粘贴此验证码，15 分钟内有效，只可使用一次。\n\n' + code })
    res.sendStatus(202)
  } catch {
    run('DELETE FROM login_links WHERE digest = ?', hashed)
    error(res, 502, '邮件暂时发不出去')
  }
})
function startSession(req, res, user) {
  const session = token()
  const maxAge = 7 * 86400_000
  if (req.session) run('DELETE FROM sessions WHERE digest = ?', req.session)
  run('INSERT INTO sessions VALUES (?, ?, ?)', digest(session), user.id, Date.now() + maxAge)
  res.cookie(cookieName, session, { ...sessionCookie(req), maxAge }).json(sessionUser(user))
}
app.post('/auth/register', limit(12, 900_000), async (req, res) => {
  const { code, password } = req.body ?? {}
  const email = normalizeEmail(req.body?.email)
  if (!validEmail(email) || typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code) || !validPassword(password)) {
    return error(res, 400, '请检查邮箱、验证码和密码（至少 12 个字符）')
  }
  const proof = digest(code)
  if (!get('SELECT 1 FROM login_links WHERE digest = ? AND email = ? AND expires > ?', proof, email, Date.now())) return error(res, 400, '验证码无效或已过期')
  if (deriving >= 2) return error(res, 429, '请稍后重试')
  const salt = randomBytes(16).toString('hex')
  const hash = (await passwordHash(password, salt)).toString('hex')
  db.exec('BEGIN IMMEDIATE')
  let user
  try {
    if (!run('DELETE FROM login_links WHERE digest = ? AND email = ? AND expires > ?', proof, email, Date.now()).changes) {
      db.exec('ROLLBACK')
      return error(res, 400, '验证码无效或已过期')
    }
    run('DELETE FROM login_links WHERE email = ?', email)
    user = get('INSERT INTO users(email) VALUES (?) ON CONFLICT(email) DO UPDATE SET email = excluded.email RETURNING id, email', email)
    if (ban(user.id)?.action === 'ban' || !run('INSERT OR IGNORE INTO passwords VALUES (?, ?, ?)', user.id, salt, hash).changes) {
      db.exec('ROLLBACK')
      return error(res, 409, '账号无法注册，请尝试直接登录')
    }
    run('DELETE FROM sessions WHERE user_id = ?', user.id)
    db.exec('COMMIT')
  } catch (failure) {
    db.exec('ROLLBACK')
    throw failure
  }
  startSession(req, res, user)
})
app.post('/auth/login', limit(15, 900_000), limit(20, 900_000, req => normalizeEmail(req.body?.email).slice(0, 254)), async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = req.body?.password
  if (!validEmail(email) || !validPassword(password)) return error(res, 401, '邮箱或密码不正确')
  if (deriving >= 2) return error(res, 429, '请稍后重试')
  const row = get('SELECT users.id, passwords.salt, passwords.hash FROM users JOIN passwords ON passwords.user_id = users.id WHERE email = ?', email)
  const hash = await passwordHash(password, row?.salt ?? dummySalt)
  if (!timingSafeEqual(hash, row ? Buffer.from(row.hash, 'hex') : dummyHash) || !row) return error(res, 401, '邮箱或密码不正确')
  const restriction = ban(row.id)
  if (restriction?.action === 'ban') return error(res, 403, '账号已封禁：' + restriction.reason)
  startSession(req, res, { id: row.id, email })
})
app.get('/auth/me', (req, res) => res.json(req.user && ban(req.user.id)?.action !== 'ban' ? sessionUser(req.user) : null))
app.post('/auth/logout', (req, res) => {
  if (req.session) run('DELETE FROM sessions WHERE digest = ?', req.session)
  res.clearCookie(cookieName, sessionCookie(req)).sendStatus(204)
})
app.use(signedIn)

app.get('/admin/accounts', reviewer, (req, res) => {
  const email = normalizeEmail(req.query.email)
  if (!validEmail(email)) return error(res, 400, '请输入完整邮箱')
  const user = get('SELECT id, email FROM users WHERE email = ?', email)
  if (!user) return error(res, 404, '没有找到该账号')
  res.json({ ...user, banned: ban(user.id)?.action === 'ban', administrator: isReviewer(user) })
})
app.post('/admin/accounts/:id', reviewer, (req, res) => {
  const { action, reason } = req.body ?? {}
  const user = get('SELECT id, email FROM users WHERE id = ?', req.params.id)
  if (!user) return error(res, 404, '没有找到该账号')
  if (isReviewer(user)) return error(res, 403, '管理员账号受保护')
  if (!['warn', 'ban', 'unban'].includes(action) || typeof reason !== 'string' || !reason.trim() || reason.length > 500) return error(res, 400, '请填写处理原因')
  db.exec('BEGIN IMMEDIATE')
  try {
    run('INSERT INTO account_actions(user_id, admin_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?)', user.id, req.user.id, action, reason.trim(), Date.now())
    if (action === 'ban') run('DELETE FROM sessions WHERE user_id = ?', user.id)
    db.exec('COMMIT')
  } catch (failure) {
    db.exec('ROLLBACK')
    throw failure
  }
  res.sendStatus(204)
})

app.get('/works', (req, res) => {
  const type = req.query.type
  const category = req.query.category
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
  const page = Number(req.query.page ?? 1)
  if ((type !== undefined && type !== 'character' && type !== 'dlc') || (category !== undefined && !categories.includes(category)) ||
      !Number.isInteger(page) || page < 1 || page > 10000) {
    return error(res, 400, '分类或页码无效')
  }
  const rows = all(`SELECT w.*, c.category, p.name AS creatorName FROM works w JOIN work_categories c ON c.work_id = w.id
    LEFT JOIN creator_profiles p ON p.user_id = w.author_id
    WHERE w.published IS NOT NULL AND (? IS NULL OR w.type = ?) AND (? IS NULL OR c.category = ?)
    AND (? = '' OR instr(lower(c.public_title),lower(?)) > 0 OR instr(lower(c.public_summary),lower(?)) > 0 OR instr(lower(p.name),lower(?)) > 0)
    ORDER BY w.published_at DESC,w.id LIMIT 21 OFFSET ?`,
    type ?? null, type ?? null, category ?? null, category ?? null, query, query, query, query, (page - 1) * 20)
  res.json({ items: rows.slice(0, 20).map(listWork), next: rows.length > 20 })
})
app.get('/recommendations', (_req, res) => {
  res.json(Object.fromEntries(categories.map(category => [category, all(`SELECT w.*, c.category, p.name AS creatorName
    FROM work_categories c JOIN works w ON w.id = c.work_id LEFT JOIN creator_profiles p ON p.user_id = w.author_id
    WHERE c.category = ? AND w.published IS NOT NULL
    ORDER BY (SELECT COUNT(*) FROM likes WHERE work_id = w.id) DESC, w.published_at DESC, w.id LIMIT 4`, category).map(listWork)])))
})

function creator(id, viewer) {
  const row = get(`SELECT u.id, COALESCE(p.name,'创作者 ' || u.id) AS name, COALESCE(p.bio,'') AS bio,
    f.follower_id AS follower, f.remind_since AS remindSince,
    (SELECT COUNT(*) FROM creator_follows WHERE creator_id = u.id) AS followers,
    (SELECT updated_at FROM creator_avatars WHERE user_id = u.id) AS avatarVersion
    FROM users u LEFT JOIN creator_profiles p ON p.user_id = u.id
    LEFT JOIN creator_follows f ON f.creator_id = u.id AND f.follower_id = ? WHERE u.id = ?`, viewer, id)
  if (!row) return null
  const { follower, remindSince, ...profile } = row
  return { ...profile, following: Boolean(follower), reminders: remindSince !== null }
}
app.get('/profile', (req, res) => res.json(creator(req.user.id, req.user.id)))
app.put('/profile', (req, res) => {
  const { avatar } = req.body ?? {}
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim() : null
  if (!name || name.length > 36 || bio === null || bio.length > 600) return error(res, 400, '请填写 1–36 个字符的昵称，简介最多 600 个字符')
  if (avatar !== undefined && avatar !== null && !readCover(avatar, 512 * 1024)) return error(res, 400, '头像格式无效或超过 512 KB')
  db.exec('BEGIN IMMEDIATE')
  try {
    run('INSERT INTO creator_profiles VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, bio = excluded.bio', req.user.id, name, bio)
    if (typeof avatar === 'string') run(`INSERT INTO creator_avatars VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE
      SET image = excluded.image, updated_at = MAX(excluded.updated_at, creator_avatars.updated_at + 1)`, req.user.id, avatar, Date.now())
    if (avatar === null) run('DELETE FROM creator_avatars WHERE user_id = ?', req.user.id)
    db.exec('COMMIT')
  } catch (failure) {
    db.exec('ROLLBACK')
    throw failure
  }
  res.json(creator(req.user.id, req.user.id))
})
app.get('/creators/:id/avatar', (req, res) => {
  const image = readCover(get('SELECT image FROM creator_avatars WHERE user_id = ?', req.params.id)?.image, 512 * 1024)
  if (!image) return error(res, 404, '头像不可用')
  res.type(image.type).send(image.bytes)
})
app.get('/creators/:id', (req, res) => {
  const profile = creator(req.params.id, req.user.id)
  if (!profile) return error(res, 404, '创作者不存在')
  const page = Number(req.query.page ?? 1)
  if (!Number.isInteger(page) || page < 1 || page > 10000) return error(res, 400, '页码无效')
  const rows = all(`SELECT w.*, c.category, ? AS creatorName FROM works w JOIN work_categories c ON c.work_id = w.id
    WHERE w.author_id = ? AND w.published IS NOT NULL ORDER BY w.published_at DESC, w.id LIMIT 21 OFFSET ?`, profile.name, profile.id, (page - 1) * 20)
  res.json({ ...profile, items: rows.slice(0, 20).map(listWork), next: rows.length > 20 })
})
app.put('/creators/:id/follow', (req, res) => {
  const profile = creator(req.params.id, req.user.id)
  const { following, reminders } = req.body ?? {}
  if (!profile || profile.id === req.user.id || typeof following !== 'boolean' || typeof reminders !== 'boolean' || (!following && reminders)) return error(res, 400, '关注设置无效')
  if (following) run(`INSERT INTO creator_follows VALUES (?, ?, ?) ON CONFLICT(follower_id, creator_id) DO UPDATE
    SET remind_since = CASE WHEN excluded.remind_since IS NULL THEN NULL ELSE COALESCE(creator_follows.remind_since, excluded.remind_since) END`, req.user.id, profile.id, reminders ? Date.now() : null)
  else run('DELETE FROM creator_follows WHERE follower_id = ? AND creator_id = ?', req.user.id, profile.id)
  res.json(creator(profile.id, req.user.id))
})
app.get('/following', (req, res) => {
  const page = Number(req.query.page ?? 1)
  if (!Number.isInteger(page) || page < 1 || page > 10000) return error(res, 400, '页码无效')
  const rows = all('SELECT creator_id FROM creator_follows WHERE follower_id = ? ORDER BY creator_id LIMIT 21 OFFSET ?', req.user.id, (page - 1) * 20)
  res.json({ items: rows.slice(0, 20).map(row => creator(row.creator_id, req.user.id)), next: rows.length > 20 })
})
app.get('/activity', (req, res) => {
  const seen = get('SELECT seen_at FROM workshop_inbox WHERE user_id = ?', req.user.id)?.seen_at ?? 0
  const rows = all(`SELECT * FROM (
    SELECT 'comment' AS kind, w.id AS workId, c.public_title AS title, r.id AS ref, r.created_at AS time, r.body AS body
      FROM comments r JOIN works w ON w.id = r.work_id JOIN work_categories c ON c.work_id = w.id
      WHERE w.author_id = ? AND w.published IS NOT NULL AND r.status = 'approved' AND r.user_id <> w.author_id
    UNION ALL
    SELECT 'like', w.id, c.public_title, l.user_id, l.created_at, NULL
      FROM likes l JOIN works w ON w.id = l.work_id JOIN work_categories c ON c.work_id = w.id
      WHERE w.author_id = ? AND w.published IS NOT NULL AND l.user_id <> w.author_id
    UNION ALL
    SELECT 'update', w.id, c.public_title, w.author_id, w.published_at, COALESCE(p.name,'创作者 ' || w.author_id)
      FROM creator_follows f JOIN works w ON w.author_id = f.creator_id JOIN work_categories c ON c.work_id = w.id
      LEFT JOIN creator_profiles p ON p.user_id = w.author_id
      WHERE f.follower_id = ? AND w.published IS NOT NULL AND w.published_at >= f.remind_since
    ) ORDER BY time DESC,workId,kind,ref DESC LIMIT 60`, req.user.id, req.user.id, req.user.id)
  res.json({ items: rows.map(row => ({ ...row, unread: row.time > seen })), unread: rows.filter(row => row.time > seen).length })
})
app.post('/activity/read', (req, res) => {
  const time = req.body?.time
  if (!Number.isSafeInteger(time) || time < 0 || time > Date.now()) return error(res, 400, '提醒时间无效')
  run('INSERT INTO workshop_inbox VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET seen_at = MAX(seen_at, excluded.seen_at)', req.user.id, time)
  res.sendStatus(204)
})
app.get('/works/:id', (req, res) => {
  const row = get(`SELECT w.*, c.category, p.name AS creatorName FROM works w JOIN work_categories c ON c.work_id = w.id
    LEFT JOIN creator_profiles p ON p.user_id = w.author_id WHERE w.id = ? AND w.published IS NOT NULL`, req.params.id)
  if (!row) return error(res, 404, '作品不可用')
  res.json(listWork(row))
})
app.get('/works/:id/cover', (req, res) => {
  const row = get('SELECT id,published FROM works WHERE id = ? AND published IS NOT NULL', req.params.id)
  const image = row && readCover(JSON.parse(publishedText(row)).cover)
  const bytes = image && publicCover(image)
  if (!bytes) return error(res, 404, '作品封面不可用')
  res.type(image.type).send(bytes)
})

app.use('/works/:id/social', (req, res, next) => {
  if (!get('SELECT 1 FROM works WHERE id = ? AND published IS NOT NULL', req.params.id)) return error(res, 404, '作品不可用')
  next()
})
app.get('/works/:id/social', (req, res) => {
  const before = Number(req.query.before ?? Number.MAX_SAFE_INTEGER)
  if (!Number.isSafeInteger(before) || before < 1) return error(res, 400, '评论页码无效')
  const comments = all(
    "SELECT id, body, status, created_at AS createdAt, user_id AS author FROM comments WHERE work_id = ? AND id < ? AND (status = 'approved' OR user_id = ?) ORDER BY id DESC LIMIT 21",
    req.params.id, before, req.user.id,
  )
  res.json({
    likes: get('SELECT COUNT(*) AS total FROM likes WHERE work_id = ?', req.params.id).total,
    liked: Boolean(get('SELECT 1 FROM likes WHERE work_id = ? AND user_id = ?', req.params.id, req.user.id)),
    comments: comments.slice(0, 20),
    next: comments.length > 20 ? comments[19].id : null,
  })
})
app.put('/works/:id/social/like', (req, res) => {
  const id = req.params.id
  if (req.body?.liked === true) run('INSERT OR IGNORE INTO likes(work_id, user_id, created_at) VALUES (?, ?, ?)', id, req.user.id, Date.now())
  else if (req.body?.liked === false) run('DELETE FROM likes WHERE work_id = ? AND user_id = ?', id, req.user.id)
  else return error(res, 400, '点赞状态无效')
  res.sendStatus(204)
})
app.post('/works/:id/social/comments', limit(6, 600_000, req => req.user.id), (req, res) => {
  const body = req.body?.body
  if (typeof body !== 'string' || !body.trim() || body.length > 1000) return error(res, 400, '评论需要 1 至 1000 个字符')
  run("INSERT INTO comments(work_id, user_id, body, status, created_at) VALUES (?, ?, ?, 'approved', ?)", req.params.id, req.user.id, body.trim(), Date.now())
  res.sendStatus(204)
})
app.delete('/works/:id/social/comments/:commentId', (req, res) => {
  const comment = get('SELECT user_id FROM comments WHERE id = ? AND work_id = ?', req.params.commentId, req.params.id)
  if (!comment) return error(res, 404, '评论不存在')
  if (comment.user_id !== req.user.id && !isReviewer(req.user)) return error(res, 403, '没有删除权限')
  run('DELETE FROM comments WHERE id = ? AND work_id = ?', req.params.commentId, req.params.id)
  res.sendStatus(204)
})

function authorWork(row, includeCover = false) {
  const { cover, ...draft } = JSON.parse(unseal(row.draft, row.id, 'draft'))
  return { id: row.id, type: row.type, category: row.category ?? fallbackCategory(row.type), status: row.status,
    revision: row.revision, reviewNote: row.review_note, published: Boolean(row.published), ...draft,
    hasCover: Boolean(cover), ...(includeCover && cover ? { cover } : {}) }
}
app.get('/mine', signedIn, (req, res) => {
  res.json(all(`SELECT w.id, w.type, w.status, w.revision, w.review_note, w.draft, w.published IS NOT NULL AS published, c.category
    FROM works w JOIN work_categories c ON c.work_id = w.id WHERE w.author_id = ? ORDER BY w.updated_at DESC`, req.user.id).map(row => authorWork(row)))
})
app.get('/mine/:id', (req, res) => {
  const row = get('SELECT w.*,c.category FROM works w JOIN work_categories c ON c.work_id=w.id WHERE w.id = ? AND w.author_id = ?', req.params.id, req.user.id)
  if (!row) return error(res, 404, '没有找到你的作品')
  res.json(authorWork(row, true))
})
function draftCover(row, res) {
  const image = row && readCover(JSON.parse(unseal(row.draft, row.id, 'draft')).cover)
  if (!image) return error(res, 404, '作品封面不可用')
  res.type(image.type).send(image.bytes)
}
app.get('/mine/:id/cover', (req, res) => {
  draftCover(get('SELECT id,draft FROM works WHERE id = ? AND author_id = ?', req.params.id, req.user.id), res)
})
function parseDraft(type, input, existingCover) {
  if ((type !== 'character' && type !== 'dlc') || !validateWork(input) || !payloads[type](input.content) ||
      !input.title.trim()) return null
  const image = readCover(input.cover)
  if (!image || (input.cover !== existingCover && image.width * 4 !== image.height * 3)) return null
  try {
    return JSON.stringify({ ...input, endpoints: [...new Set(input.endpoints.map(endpoint))] })
  } catch { return null }
}

function importLaunchExamples() {
  const entries = JSON.parse(readFileSync(0, 'utf8'))
  if (!Array.isArray(entries) || entries.length !== 4 || new Set(entries.map(entry => entry.category)).size !== 4) {
    throw new Error('Provide one launch example for each Workshop category')
  }
  const owner = get('SELECT users.id FROM users JOIN passwords ON passwords.user_id = users.id WHERE email = ?', reviewerEmail)
  if (!owner) throw new Error('Register the Workshop administrator before importing examples')
  const drafts = entries.map(({ slug, category, draft }) => {
    if (!categories.includes(category) || typeof slug !== 'string' || !/^[a-z0-9-]{1,40}$/.test(slug)) throw new Error('Invalid launch example')
    const type = category === 'mod' ? 'dlc' : 'character'
    const validated = parseDraft(type, draft)
    if (!validated) throw new Error('Invalid launch submission: ' + slug)
    return { slug, category, type, validated }
  })
  db.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE')
  try {
    const result = drafts.map(({ slug, category, type, validated }) => {
      const previous = get('SELECT w.id, w.status FROM launch_examples e JOIN works w ON w.id = e.work_id WHERE e.slug = ?', slug)
      if (previous) return { slug, ...previous }
      const id = randomUUID()
      run("INSERT INTO works(id, author_id, type, draft, status, updated_at) VALUES (?, ?, ?, ?, 'pending', ?)", id, owner.id, type, seal(validated, id, 'draft'), Date.now())
      backfill.run(id, category, null, null)
      run('INSERT INTO launch_examples VALUES (?, ?, 1)', slug, id)
      return { slug, id, status: 'pending' }
    })
    db.exec('COMMIT')
    console.log(JSON.stringify(result))
  } catch (failure) {
    db.exec('ROLLBACK')
    throw failure
  }
}
app.post('/preview/dlc', (req, res) => {
  const draft = parseDraft('dlc', uploadedMod(req.body))
  if (!draft) return error(res, 400, '请检查 MOD 配置文件，封面须为竖版 3:4')
  res.json(publicWork({ id: 'preview', type: 'dlc', published: draft }))
})
app.post('/mine/:type', signedIn, (req, res) => {
  const category = req.params.type === 'dlc' ? 'mod' : req.params.type
  if (!categories.includes(category)) return error(res, 400, '作品分类无效')
  const type = category === 'mod' ? 'dlc' : 'character'
  const draft = parseDraft(type, type === 'dlc' ? uploadedMod(req.body) : req.body)
  if (!draft) return error(res, 400, '请检查作品内容、接口地址和竖版 3:4 封面')
  if (get('SELECT COUNT(*) AS count FROM works WHERE author_id = ?', req.user.id).count >= 40) return error(res, 409, '作品已达上限')
  const id = randomUUID()
  db.exec('BEGIN IMMEDIATE')
  try {
    run("INSERT INTO works(id, author_id, type, draft, status, updated_at) VALUES (?, ?, ?, ?, 'draft', ?)", id, req.user.id, type, seal(draft, id, 'draft'), Date.now())
    backfill.run(id, category, null, null)
    db.exec('COMMIT')
  } catch (failure) {
    db.exec('ROLLBACK')
    throw failure
  }
  res.status(201).json({ id, revision: 1 })
})
app.put('/mine/:id', signedIn, (req, res) => {
  const row = get('SELECT * FROM works WHERE id = ? AND author_id = ?', req.params.id, req.user.id)
  if (!row) return error(res, 404, '没有找到你的作品')
  if (row.revision !== req.body?.revision) return error(res, 409, '草稿已改动，请重新打开后再编辑')
  const incoming = req.body?.draft
  const existing = JSON.parse(unseal(row.draft, row.id, 'draft'))
  const draft = parseDraft(row.type, row.type === 'dlc' ? uploadedMod(incoming) : incoming, existing.cover)
  if (!draft) return error(res, 400, '请检查作品内容、接口地址和竖版 3:4 封面')
  const published = row.published && JSON.parse(publishedText(row))
  if (published) {
    const selected = JSON.parse(draft).endpoints
    published.endpoints = published.endpoints.filter(address => selected.includes(address))
  }
  run("UPDATE works SET draft = ?, published = ?, status = 'draft', revision = revision + 1, review_note = '', reviewed_by = NULL, updated_at = ? WHERE id = ?", seal(draft, row.id, 'draft'), published ? seal(JSON.stringify(published), row.id, 'published') : null, Date.now(), row.id)
  res.json({ id: row.id, revision: row.revision + 1 })
})
app.post('/mine/:id/submit', signedIn, (req, res) => {
  const revision = req.body?.revision
  if (!Number.isInteger(revision)) return error(res, 400, '缺少草稿版本')
  const row = get("SELECT id,draft FROM works WHERE id = ? AND author_id = ? AND revision = ? AND status IN ('draft','rejected')", req.params.id, req.user.id, revision)
  if (row && !readCover(JSON.parse(unseal(row.draft, row.id, 'draft')).cover)) return error(res, 400, '请先上传作品封面再送审')
  const result = run("UPDATE works SET status = 'pending', review_note = '', updated_at = ? WHERE id = ? AND author_id = ? AND revision = ? AND status IN ('draft','rejected')", Date.now(), req.params.id, req.user.id, revision)
  if (!result.changes) return error(res, 409, '作品状态或版本已改变，请刷新后再提交')
  res.sendStatus(204)
})
app.delete('/mine/:id', signedIn, (req, res) => {
  run('DELETE FROM works WHERE id = ? AND author_id = ?', req.params.id, req.user.id)
  res.sendStatus(204)
})

app.get('/review', reviewer, (req, res) => {
  const after = typeof req.query.after === 'string' ? req.query.after : ''
  res.json(all(`SELECT w.id, w.type, w.status, w.revision, w.review_note, w.draft, w.published IS NOT NULL AS published, c.category
    FROM works w JOIN work_categories c ON c.work_id = w.id WHERE w.status = 'pending' AND w.id > ? ORDER BY w.id LIMIT 20`, after).map(row => {
      const { content, endpoints, ...summary } = authorWork(row)
      return summary
    }))
})
const pendingDraft = (id, revision) => get(`SELECT w.*, c.category FROM works w JOIN work_categories c ON c.work_id = w.id
  WHERE w.id = ? AND w.status = 'pending' AND w.revision = ?`, id, revision)
app.get('/review/:id', reviewer, (req, res) => {
  const row = pendingDraft(req.params.id, Number(req.query.revision))
  if (!row) return error(res, 404, '待审版本已变更，请刷新队列')
  const draft = authorWork(row)
  res.json({ ...draft, canTest: Boolean(reviewModel), launchExample: Boolean(launchBriefs[launchSlug(row)]) })
})
app.post('/review/:id/test', reviewer, limit(12, 60_000, req => req.user.id), async (req, res) => {
  const { revision, messages, simulation, action } = req.body ?? {}
  if (!Number.isSafeInteger(revision) || revision < 1) return error(res, 400, '待审版本无效')
  const row = pendingDraft(req.params.id, revision)
  if (!row) return error(res, 404, '待审对话版本不可用')
  if (simulation !== undefined) {
    const brief = launchBriefs[launchSlug(row)]
    if (!brief || !validatePlay(simulation) || simulation.dlc.length || simulation.button || simulation.messages.at(-1)?.role !== 'user') {
      return error(res, 400, '首发试玩配置无效')
    }
    let address
    try { address = endpoint(simulation.endpoint) } catch { return error(res, 400, '模型地址无效') }
    return runModel(req, res, { address, key: simulation.key, model: simulation.model, messages: simulation.messages, prompt: brief })
  }
  if (!validateReviewPlay(req.body) || messages.at(-1)?.role !== 'user') return error(res, 400, '测试消息无效')
  if (!reviewModel) return error(res, 503, '尚未配置受信任的审核模型')
  const { persona, world, system_prompt_addon, custom_buttons } = authorWork(row).content
  const button = action === undefined ? undefined : custom_buttons?.[action]
  if (action !== undefined && !button) return error(res, 400, '待审按钮不可用')
  const prompt = [persona, world, system_prompt_addon, button?.instruction].filter(Boolean).join('\n\n')
  if (!prompt) return error(res, 400, '此作品没有模型规则，可直接试用界面')
  return runModel(req, res, { ...reviewModel, messages, prompt })
})
app.get('/review/:id/cover', reviewer, (req, res) => {
  draftCover(get("SELECT id,draft FROM works WHERE id = ? AND status = 'pending' AND revision = ?", req.params.id, req.query.revision ?? ''), res)
})
app.post('/review/:id', reviewer, (req, res) => {
  const { decision, revision, note = '' } = req.body ?? {}
  if (!['approved', 'rejected'].includes(decision) || !Number.isInteger(revision) || typeof note !== 'string' || note.length > 800) {
    return error(res, 400, '审核决定无效')
  }
  const row = get("SELECT * FROM works WHERE id = ? AND status = 'pending' AND revision = ?", req.params.id, revision)
  if (!row) return error(res, 409, '作品已改动或已处理，请刷新后重新审核')
  const text = decision === 'approved' ? unseal(row.draft, row.id, 'draft') : null
  db.exec('BEGIN IMMEDIATE')
  try {
    if (text) {
      const {title, summary} = JSON.parse(text)
      run('UPDATE work_categories SET public_title = ?, public_summary = ? WHERE work_id = ?', title, summary, row.id)
    }
    run('UPDATE works SET status = ?, review_note = ?, reviewed_by = ?, published = ?, published_at = ? WHERE id = ?',
      decision, note, req.user.id, text ? seal(text, row.id, 'published') : row.published, text ? Date.now() : row.published_at, row.id)
    db.exec('COMMIT')
  } catch (failure) {
    db.exec('ROLLBACK')
    throw failure
  }
  res.sendStatus(204)
})

app.get('/library', signedIn, (req, res) => {
  const rows = all(`SELECT w.*, i.enabled, i.installed_at AS installedAt, c.category, p.name AS creatorName
    FROM installs i JOIN works w ON i.work_id = w.id JOIN work_categories c ON c.work_id = w.id
    LEFT JOIN creator_profiles p ON p.user_id = w.author_id
    WHERE i.user_id = ? AND w.published IS NOT NULL ORDER BY i.installed_at DESC, w.id`, req.user.id)
  res.json(rows.map(row => ({ ...listWork(row), installedAt: row.installedAt, enabled: Boolean(row.enabled), mine: row.author_id === req.user.id,
    ...(row.type === 'character' ? { protectedPlayReady: true } : {}),
  })))
})
app.post('/library/:id', signedIn, (req, res) => {
  if (get('SELECT COUNT(*) AS count FROM installs WHERE user_id = ?', req.user.id).count >= 150) return error(res, 409, '已领取作品达到上限')
  const result = run('INSERT INTO installs(user_id, work_id, installed_at) SELECT ?, id, ? FROM works WHERE id = ? AND published IS NOT NULL ON CONFLICT DO NOTHING', req.user.id, Date.now(), req.params.id)
  if (!result.changes && !get('SELECT 1 FROM installs WHERE user_id = ? AND work_id = ?', req.user.id, req.params.id)) return error(res, 404, '作品不可领取')
  res.sendStatus(204)
})
app.patch('/library/:id', signedIn, (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') return error(res, 400, '启用状态无效')
  const result = run("UPDATE installs SET enabled = ? WHERE user_id = ? AND work_id = ? AND work_id IN (SELECT id FROM works WHERE type = 'dlc' AND published IS NOT NULL)", Number(req.body.enabled), req.user.id, req.params.id)
  if (!result.changes) return error(res, 404, '没有找到已领取的 DLC')
  res.sendStatus(204)
})
app.delete('/library/:id', signedIn, (req, res) => {
  run('DELETE FROM installs WHERE user_id = ? AND work_id = ?', req.user.id, req.params.id)
  res.sendStatus(204)
})

function installed(user, id, type, enabled) {
  return get('SELECT w.* FROM installs i JOIN works w ON i.work_id = w.id WHERE i.user_id = ? AND w.id = ? AND w.type = ? AND w.published IS NOT NULL AND i.enabled >= ?', user, id, type, enabled)
}
const inFlight = new Set()
const phoneChannelRules = {
  sms: '本轮发生在半糖短信。用当前角色身份回复，像真实发短信一样简短，只写聊天正文。无需叙述线下动作，不要替玩家发言。',
  offline: '本轮发生在半糖线下。根据已有对话继续面对面的场景，用纯文本写动作、环境和角色对白。不要替玩家做决定。',
  side: '本轮发生在半糖番外。沿着当前支线演出设定和玩法，用纯文本写可见剧情。不要替玩家决定行动。',
}
async function runModel(req, res, { address, key, model, messages, prompt, render, playerModel = false }) {
  if (inFlight.has(req.user.id) || inFlight.size >= 12) return error(res, 429, '模型调用繁忙，请稍后重试')
  inFlight.add(req.user.id)
  const controller = new AbortController()
  const cancel = () => controller.abort()
  const timer = setTimeout(cancel, 60_000)
  res.once('close', cancel)
  try {
    const raw = await complete(address, key, model, [{ role: 'system', content: prompt }, ...messages], controller.signal)
    const reply = raw.replaceAll(key, '[密钥已隐藏]')
    const result = render ? await render(reply, controller.signal) : { reply }
    if (!result) return error(res, 422, '未生成可显示的剧情。请换一个剧情行动。')
    res.json(result)
  } catch (failure) {
    const message = playerModel && [401, 403].includes(failure.status) ? '你配置的模型 API 密钥或权限无效，请到设置中检查当前模块的接口和模型'
      : playerModel && failure.status === 429 ? '你配置的模型 API 额度不足或请求过多，请检查额度或稍后重试'
      : playerModel && failure.status === 404 ? '你配置的模型 API 地址或模型名称无效，请到设置中检查'
      : controller.signal.aborted ? '工坊游玩服务响应超时，请稍后重试'
      : [401, 403].includes(failure.status) ? '工坊游玩服务的模型密钥或权限无效，请联系管理员检查服务配置'
      : failure.status === 429 ? '工坊游玩服务的模型额度不足或请求过多，请稍后重试'
      : failure.status === 404 ? '工坊游玩服务的模型地址或模型名称无效，请联系管理员检查服务配置'
      : '工坊游玩服务调用模型失败，请稍后重试或联系管理员检查服务配置'
    if (!res.destroyed) error(res, 502, message)
  } finally {
    inFlight.delete(req.user.id)
    clearTimeout(timer)
    res.off('close', cancel)
  }
}
app.post('/play/:id', signedIn, limit(12, 60_000, req => req.user.id), async (req, res) => {
  if (!validatePlay(req.body) || req.body.messages.at(-1).role !== 'user') return error(res, 400, '模型配置或聊天内容无效')
  let address
  try { address = endpoint(req.body.endpoint) } catch { return error(res, 400, '模型地址无效') }
  const { dlc, button, key, model, messages } = req.body
  const card = installed(req.user.id, req.params.id, 'character', 0)
  if (!card) return error(res, 404, '请先领取这张角色卡')
  const brief = launchBriefs[launchSlug(card)]
  const extensions = dlc.map(id => installed(req.user.id, id, 'dlc', 1))
  if (extensions.some(row => !row)) return error(res, 403, '包含未启用的 DLC')
  if (!brief || button || extensions.some(row => listWork(row).display.usesModel)) return error(res, 403, '该作品或扩展需要在小手机内游玩')
  return runModel(req, res, { address, key, model, messages, prompt: brief })
})

app.post('/play/:id/protected', signedIn, limit(12, 60_000, req => req.user.id), async (req, res) => {
  if (!validateProtectedPlay(req.body) || req.body.messages.at(-1).role !== 'user') return error(res, 400, '游玩消息格式无效')
  const { dlc, button, messages, channel, cast = [] } = req.body
  const card = installed(req.user.id, req.params.id, 'character', 0)
  if (!card) return error(res, 404, '请先领取作品')
  if (channel === 'sms' && get('SELECT category FROM work_categories WHERE work_id = ?', card.id)?.category !== 'character') {
    return error(res, 400, '请在短信中使用工坊角色卡')
  }
  if (cast.includes(card.id) || (cast.length && (!channel || channel === 'sms'))) return error(res, 400, '游玩角色无效')
  const characters = cast.map(id => installed(req.user.id, id, 'character', 0))
  if (characters.some(row => !row || get('SELECT category FROM work_categories WHERE work_id = ?', row.id)?.category !== 'character')) {
    return error(res, 403, '包含未领取的工坊角色')
  }
  const extensions = dlc.map(id => installed(req.user.id, id, 'dlc', 1))
  if (extensions.some(row => !row)) return error(res, 403, '包含未启用的 DLC')
  const replyScope = channel ? card.id + ':' + channel : card.id
  if (messages.some(turn => turn.role === 'assistant' && !validPlayReceipt(receiptKey, req.user.id, replyScope, turn))) {
    return error(res, 400, '对话记录无法验证，请开启新的对话')
  }
  if (requestsSource(messages.at(-1).content)) return error(res, 422, '请继续剧情中的行动或对话')
  let selectedModel = playModel // Compatibility for installed clients predating player API routing.
  const playerModel = req.body.endpoint !== undefined
  if (playerModel) {
    try { selectedModel = { address: endpoint(req.body.endpoint), key: req.body.key, model: req.body.model } }
    catch { return error(res, 400, '请配置公网 HTTPS 模型接口，且不能带查询参数') }
  }
  if (!selectedModel) return error(res, 503, '请更新小手机，并在设置中配置自己的模型 API')
  const work = JSON.parse(publishedText(card))
  const additional = characters.map(row => ({ row, draft: JSON.parse(publishedText(row)) }))
  const mods = extensions.map(row => [row.id, JSON.parse(publishedText(row))])
  const authorized = draft => !draft.endpoints.length || draft.endpoints.some(address => endpoint(address) === selectedModel.address)
  if ((!isLaunchExample(card) && !authorized(work)) ||
      additional.some(({ row, draft }) => !isLaunchExample(row) && !authorized(draft)) ||
      mods.some(([, draft]) => (draft.content.system_prompt_addon || draft.content.custom_buttons?.length) && !authorized(draft))) {
    return error(res, 403, '该作品或扩展的创作者尚未授权当前模型接口，请切换到创作者允许的接口')
  }
  const { persona, world } = work.content
  const configs = new Map(mods.map(([id, draft]) => [id, draft.content]))
  const action = button && configs.get(button.id)?.custom_buttons?.[button.index]
  if (button && !action) return error(res, 400, 'DLC 按钮不可用')
  const rules = Array.from(configs.values(), config => config.system_prompt_addon)
  const castRules = additional.flatMap(({ draft }) => [draft.content.persona, draft.content.world])
  const source = [playGuard, reviewGuard, persona, world, ...castRules, ...rules, ...Array.from(configs.values()).flatMap(config => (config.custom_buttons ?? []).map(item => item.instruction))].filter(Boolean)
  const publicText = [work, ...additional.map(({ draft }) => draft)].flatMap(draft => [draft.title, draft.summary, draft.content.greeting]).filter(Boolean)
  const prior = messages.filter(turn => turn.role === 'assistant').slice(-6).map(turn => turn.content.slice(-1500))
  // Omit the labels of all unselected actions from model context.
  const prompt = [playGuard, persona, world, ...castRules, ...rules, action?.instruction, phoneChannelRules[channel]].filter(Boolean).join('\n\n')
  return runModel(req, res, {
    ...selectedModel, prompt, playerModel,
    messages: messages.filter(turn => turn.role !== 'user' || !requestsSource(turn.content)).map(({ role, content }) => ({ role, content })),
    render: async (value, signal) => {
      const reply = value.trim().slice(0, 8000)
      if (!reply || repeatsSource(reply, source)) return null
      const verdict = await complete(selectedModel.address, selectedModel.key, selectedModel.model, [
        { role: 'system', content: reviewGuard },
        { role: 'user', content: JSON.stringify({ protected: source, public: publicText, prior, reply }) },
      ], signal)
      if (verdict.trim() !== 'ALLOW') return null
      return { reply, receipt: playReceipt(receiptKey, req.user.id, replyScope, reply) }
    },
  })
})

app.use((_req, res) => error(res, 404, '接口不存在'))
app.use((err, _req, res, _next) => {
  if (err.status === 413) return error(res, 413, '提交内容太大')
  if (err.status === 400) return error(res, 400, 'JSON 格式无效')
  error(res, 500, '服务暂时不可用')
})
const importing = process.argv[2] === '--import-launch-examples'
if (importing) {
  try { importLaunchExamples() } finally { db.close() }
}
export const server = importing ? null : app.listen(Number(process.env.PORT || 8787), process.env.BIND_HOST || '127.0.0.1')
server?.once('close', () => db.close())
