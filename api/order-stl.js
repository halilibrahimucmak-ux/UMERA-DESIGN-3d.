import { requireAdmin } from '../lib/auth.js';
import { getOrder } from '../lib/sheets.js';
import { createOrderStl } from '../lib/order-stl.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const orderNo = String(req.body?.orderNo || '').trim();
    const configurationIndex = Number(req.body?.configurationIndex);
    if (!orderNo || !Number.isInteger(configurationIndex) || configurationIndex < 0) {
      return res.status(400).json({ error: 'Sipariş ve tasarım bilgisi gerekli.' });
    }

    const order = await getOrder(orderNo);
    const { stl, fileName } = createOrderStl(order, configurationIndex);
    const buffer = Buffer.from(stl);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-STL-Size', String(buffer.byteLength));
    res.flushHeaders?.();
    for (let offset = 0; offset < buffer.byteLength; offset += 64 * 1024) {
      res.write(buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.byteLength)));
    }
    return res.end();
  } catch (error) {
    console.error(error);
    if (error.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Yetkisiz erişim.' });
    if (error.message === 'NOT_FOUND') return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    if (error.message === 'YAPILANDIRMA_BULUNAMADI') return res.status(404).json({ error: 'Bu siparişte STL üretilecek abajur tasarımı bulunamadı.' });
    if (error.message === 'GECERSIZ_YAPILANDIRMA') return res.status(400).json({ error: 'Geçersiz tasarım seçimi.' });
    return res.status(500).json({ error: 'STL oluşturulamadı.' });
  }
}

