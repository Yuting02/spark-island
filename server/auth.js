// 管理员鉴权：密码来自环境变量，token 随机生成只存内存（重启即失效，单管理员 MVP 够用）。
import crypto from 'node:crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const tokens = new Set();

export function login(password) {
  const expected = Buffer.from(ADMIN_PASSWORD);
  const given = Buffer.from(String(password ?? ''));
  const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!ok) return null;
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(token);
  return token;
}

export function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tokens.has(token)) return res.status(401).json({ error: '未登录或登录已过期' });
  next();
}
