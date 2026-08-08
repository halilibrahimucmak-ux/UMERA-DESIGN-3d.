import { appendOrder, getProducts, updateOrderStatus } from '../lib/sheets.js';
import { requireAdmin } from '../lib/auth.js';
import { enforceRateLimit, setRateLimitResponse } from '../lib/rate-limit.js';

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      enforceRateLimit(req, 'create-order', 6, 10 * 60_000);
      const body = req.body || {};
      const name = cleanText(body.name, 120);
      const phone = cleanText(body.phone, 30);
      const email = cleanText(body.email, 160);
      const address = cleanText(body.address, 500);
      const note = cleanText(body.note, 500);

      if (!name || !phone || !address || !Array.isArray(body.items) || !body.items.length) {
        return res.status(400).json({ error: 'Eksik sipariş bilgisi.' });
      }
      if (body.items.length > 30) return res.status(400).json({ error: 'Sepette çok fazla ürün var.' });

      const currentProducts = await getProducts();
      const validatedItems = body.items.map(item => {
        const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
        const product = currentProducts.find(candidate => candidate.id === item.id);
        if (currentProducts.length && !product) throw new Error('ÜRÜN_BULUNAMADI');
        if (product && product.stock === 0) throw new Error('STOK_YOK');
        if (product && product.stock > 0 && quantity > product.stock) throw new Error('STOK_YETERSİZ');
        return {
          id: product?.id || cleanText(item.id, 100),
          name: product?.name || cleanText(item.name, 180),
          quantity,
          price: Number(product?.price ?? item.price ?? 0)
        };
      });
      const total = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const orderNo = `UM-${Date.now().toString(36).toUpperCase()}`;
      await appendOrder({ orderNo, name, phone, email, address, note, items: validatedItems, total });
      return res.json({ ok: true, orderNo, total });
    }

    if (req.method === 'PUT') {
      await requireAdmin(req);
      const body = req.body || {};
      if (!body.orderNo || !body.status) return res.status(400).json({ error: 'Sipariş numarası ve durum gerekli.' });
      const order = await updateOrderStatus(String(body.orderNo), String(body.status));
      return res.json({ ok: true, order });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    if (error.message === 'RATE_LIMIT') return setRateLimitResponse(res, error);
    if (error.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Yetkisiz erişim.' });
    if (error.message === 'NOT_FOUND') return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    if (error.message === 'GEÇERSİZ_DURUM') return res.status(400).json({ error: 'Geçersiz sipariş durumu.' });
    if (error.message === 'ÜRÜN_BULUNAMADI') return res.status(400).json({ error: 'Sepetteki ürünlerden biri artık satışta değil.' });
    if (error.message === 'STOK_YOK') return res.status(400).json({ error: 'Sepetteki ürünlerden biri tükendi.' });
    if (error.message === 'STOK_YETERSİZ') return res.status(400).json({ error: 'Sepetteki ürünlerden birinin stoğu yetersiz.' });
    return res.status(500).json({ error: error.message || 'Sipariş işlemi başarısız.' });
  }
}
