import { verifyAdminCredentials, createSession, sessionCookie } from '../lib/auth.js';
import { enforceRateLimit, setRateLimitResponse } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    enforceRateLimit(req, 'admin-login', 8, 10 * 60_000);
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunlu.' });
    if (!(await verifyAdminCredentials(String(username), String(password)))) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }
    const token = await createSession(username);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return res.json({ ok: true, user: { username, role: 'admin' } });
  } catch (error) {
    if (error.message === 'RATE_LIMIT') return setRateLimitResponse(res, error);
    console.error(error);
    return res.status(500).json({ error: 'Giriş yapılamadı.' });
  }
}
