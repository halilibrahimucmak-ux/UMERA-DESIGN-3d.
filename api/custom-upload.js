import { put } from '@vercel/blob';
import { enforceRateLimit, setRateLimitResponse } from '../lib/rate-limit.js';

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    enforceRateLimit(req, 'custom-upload', 10, 10 * 60_000);
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Geçersiz yükleme kaynağı.' });
    const { name, type, data } = req.body || {};
    if (!name || !type || !data) return res.status(400).json({ error: 'Görsel bilgisi eksik.' });
    if (!ALLOWED.has(type)) return res.status(400).json({ error: 'JPG, PNG veya WEBP yükleyebilirsiniz.' });
    const raw = String(data).split(',').pop();
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'Her görsel en fazla 3 MB olabilir.' });
    const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, '-').slice(-160);
    const blob = await put(`custom/${Date.now()}-${safe}`, buffer, {
      access: 'public',
      token: process.env.UMERA_PUBLIC_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
      contentType: type
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ url: blob.url });
  } catch (error) {
    if (error.message === 'RATE_LIMIT') return setRateLimitResponse(res, error);
    console.error(error);
    return res.status(500).json({ error: error.message || 'Görsel yüklenemedi.' });
  }
}
