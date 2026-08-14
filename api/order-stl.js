import { promisify } from 'node:util';
import { gzip as gzipCb } from 'node:zlib';
import { requireAdmin } from '../lib/auth.js';
import { getOrder } from '../lib/sheets.js';
import { createOrderStl } from '../lib/order-stl.js';

const gzip = promisify(gzipCb);

export const config = { maxDuration: 60 };

/* Vercel serverless fonksiyonlarında yanıt gövdesi 4.5 MB ile sınırlı.
   Sıkıştırılmış çıktıyı bunun altında tutuyoruz; aşarsa üçgen bütçesini
   düşürüp bir kez daha üretiyoruz. Böylece indirme her tasarımda çalışır. */
const GUVENLI_SINIR = 3_800_000;
const CHUNK = 64 * 1024;

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

    // Rapor modu: dosyayı indirmeden Bambu Studio ayarlarını ve kontrol
    // sonuçlarını göster. Yönetici "İş emri" düğmesinde bunu kullanıyor.
    if (req.body?.rapor) {
      const { isEmri, gram, ucgen, kontrol, olcu } = createOrderStl(order, configurationIndex);
      return res.json({ ok: true, isEmri, gram, ucgen, kapali: kontrol.kapali, olcu });
    }

    let sonuc = createOrderStl(order, configurationIndex);
    let govde = Buffer.from(sonuc.stl);

    const gzipDestekli = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
    let sikistirilmis = gzipDestekli ? await gzip(govde, { level: 6 }) : null;

    // Güvenlik ağı: beklenmedik biçimde büyük çıkarsa çözünürlüğü düşür.
    const boyut = () => (sikistirilmis ? sikistirilmis.length : govde.length);
    if (boyut() > GUVENLI_SINIR) {
      const oran = GUVENLI_SINIR / boyut();
      const yeniButce = Math.max(20_000, Math.floor(sonuc.ucgen * oran * 0.9));
      sonuc = createOrderStl(order, configurationIndex, { ucgenButcesi: yeniButce });
      govde = Buffer.from(sonuc.stl);
      sikistirilmis = gzipDestekli ? await gzip(govde, { level: 6 }) : null;
    }

    const cikti = sikistirilmis || govde;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `attachment; filename="${sonuc.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Content-Length', String(cikti.length));
    if (sikistirilmis) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
    }
    // Yönetici paneli bu başlıkları indirme sonrası özet olarak gösteriyor.
    res.setHeader('X-Stl-Bytes', String(govde.length));
    res.setHeader('X-Stl-Triangles', String(sonuc.ucgen));
    res.setHeader('X-Stl-Watertight', sonuc.kontrol.kapali ? '1' : '0');
    res.flushHeaders?.();

    for (let offset = 0; offset < cikti.length; offset += CHUNK) {
      res.write(cikti.subarray(offset, Math.min(offset + CHUNK, cikti.length)));
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
