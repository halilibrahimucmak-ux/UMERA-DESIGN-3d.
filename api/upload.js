import { put } from '@vercel/blob';
import { requireAdmin } from '../lib/auth.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const { name, type, data } = req.body || {};
    if (!name || !type || !data) return res.status(400).json({ error: 'Dosya bilgisi eksik.' });
    if (!ALLOWED.has(type)) return res.status(400).json({ error: 'JPG, PNG veya WEBP görsel yüklenebilir.' });
    const raw = String(data).split(',').pop();
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Görsel 3 MB altında olmalı.' });
    const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, '-').slice(-160);
    const blob = await put(`products/${Date.now()}-${safe}`, buffer, {
      access: 'public',
      token: process.env.UMERA_PUBLIC_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
      contentType: type
    });
    return res.json({ url: blob.url });
  } catch (error) {
    console.error(error);
    return res.status(error.message === 'UNAUTHORIZED' ? 401 : 500).json({
      error: error.message === 'UNAUTHORIZED' ? 'Yetkisiz erişim.' : error.message || 'Görsel yüklenemedi.'
    });
  }
}
