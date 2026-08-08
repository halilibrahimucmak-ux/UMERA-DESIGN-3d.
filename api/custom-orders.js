import { appendCustomOrder, getCustomOrders, updateCustomOrderStatus } from '../lib/sheets.js';
import { requireAdmin } from '../lib/auth.js';
import { enforceRateLimit, setRateLimitResponse } from '../lib/rate-limit.js';

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      enforceRateLimit(req, 'custom-order', 5, 10 * 60_000);
      const body = req.body || {};
      const data = {
        name: cleanText(body.name, 120),
        phone: cleanText(body.phone, 30),
        email: cleanText(body.email, 160),
        details: cleanText(body.details, 2500),
        dimensions: cleanText(body.dimensions, 160),
        color: cleanText(body.color, 160),
        quantity: Math.max(1, Math.min(99, Number(body.quantity) || 1)),
        note: cleanText(body.note, 1000),
        images: Array.isArray(body.images) ? body.images.slice(0, 5).map(url => cleanText(url, 1000)) : []
      };
      if (!data.name || !data.details) return res.status(400).json({ error: 'Ad ve tasarım açıklaması zorunludur.' });
      if (!data.phone && !data.email) return res.status(400).json({ error: 'Telefon veya e-posta zorunludur.' });
      if (data.images.length > 5) return res.status(400).json({ error: 'En fazla 5 görsel gönderebilirsiniz.' });
      const requestNo = `CT-${Date.now().toString(36).toUpperCase()}`;
      await appendCustomOrder({ ...data, requestNo });
      return res.json({ ok: true, requestNo });
    }

    await requireAdmin(req);

    if (req.method === 'GET') return res.json({ orders: await getCustomOrders() });

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.requestNo || !body.status) return res.status(400).json({ error: 'Talep numarası ve durum gerekli.' });
      const order = await updateCustomOrderStatus(String(body.requestNo), String(body.status), body.quote);
      return res.json({ ok: true, order });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    if (error.message === 'RATE_LIMIT') return setRateLimitResponse(res, error);
    if (error.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Yetkisiz erişim.' });
    if (error.message === 'NOT_FOUND') return res.status(404).json({ error: 'Talep bulunamadı.' });
    if (error.message === 'GEÇERSİZ_DURUM') return res.status(400).json({ error: 'Geçersiz talep durumu.' });
    return res.status(500).json({ error: error.message || 'Özel tasarım işlemi başarısız.' });
  }
}
