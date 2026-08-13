import { ABAJUR_FIYAT, quoteAbajur } from '../lib/abajur.js';
import { enforceRateLimit, setRateLimitResponse } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return res.json(ABAJUR_FIYAT);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    enforceRateLimit(req, 'abajur-quote', 20, 10 * 60_000);
    const quote = quoteAbajur(req.body?.config || {});
    return res.json({
      ok: true,
      config: quote.config,
      geoSurum: quote.geoSurum,
      birim: quote.birim,
      toplam: quote.toplam,
      gram: quote.gram,
      sureSaat: quote.sureSaat,
      summary: quote.summary,
      name: quote.name
    });
  } catch (error) {
    console.error(error);
    if (error.message === 'RATE_LIMIT') return setRateLimitResponse(res, error);
    if (error.message === 'ABAJUR_SIGMIYOR') return res.status(400).json({ error: 'Bu ölçüler üretim tablasına sığmıyor.' });
    return res.status(400).json({ error: 'Abajur fiyatı hesaplanamadı.' });
  }
}
