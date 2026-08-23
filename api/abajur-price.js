import { quoteAbajur, tarifeBirlestir, VARSAYILAN_TARIFE } from '../lib/abajur.js';
import { kaydedilecekAlanlar, TARIFE_ALANLARI, tarifeOku } from '../lib/abajur-tarife.js';
import { getAbajurFiyat, saveAbajurFiyat } from '../lib/sheets.js';
import { requireAdmin } from '../lib/auth.js';
import { enforceRateLimit, setRateLimitResponse } from '../lib/rate-limit.js';

/* Tarife Sheets'ten okunuyor. Fiyat sorgusu sık gelmediği için kısa bir
   bellek içi önbellek yeterli; Sheets'e her istekte gitmeyi önlüyor.
   Yönetici kaydettiğinde önbellek hemen tazeleniyor. */
let onbellek = null;
let onbellekZamani = 0;
const ONBELLEK_MS = 60_000;

async function tarifeGetir() {
  if (onbellek && Date.now() - onbellekZamani < ONBELLEK_MS) return onbellek;
  try {
    onbellek = tarifeBirlestir(await getAbajurFiyat());
  } catch {
    // Sheets erişilemiyorsa fiyatlandırma durmamalı
    onbellek = tarifeBirlestir({});
  }
  onbellekZamani = Date.now();
  return onbellek;
}

/** Yönetici ekranının gösterdiği düz alan listesi. */
function duzTarife(tarife) {
  return Object.fromEntries(TARIFE_ALANLARI.map(a => [a, tarifeOku(tarife, a)]));
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const tarife = await tarifeGetir();
      // Konfigüratör tabloyu bu uçtan çekiyor
      return res.json({ ...tarife, alanlar: duzTarife(tarife), varsayilan: duzTarife(VARSAYILAN_TARIFE) });
    }

    if (req.method === 'PUT') {
      await requireAdmin(req);
      const alanlar = kaydedilecekAlanlar(req.body || {});
      const kayit = await saveAbajurFiyat(alanlar);
      onbellek = tarifeBirlestir(kayit);
      onbellekZamani = Date.now();
      return res.json({ ok: true, alanlar: duzTarife(onbellek) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    enforceRateLimit(req, 'abajur-quote', 20, 10 * 60_000);

    /* Müşteri fiyatı DAİMA kayıtlı tarifeden hesaplanır. Yalnızca yönetici,
       henüz kaydetmediği değerlerle önizleme isteyebilir; istek yönetici
       değilse 401 döner, sessizce yok sayılmaz. */
    let tarife = await tarifeGetir();
    if (req.body?.tarife) {
      await requireAdmin(req);
      tarife = tarifeBirlestir(req.body.tarife);
    }

    const quote = quoteAbajur(req.body?.config || {}, tarife);
    return res.json({
      ok: true,
      config: quote.config,
      geoSurum: quote.geoSurum,
      birim: quote.birim,
      toplam: quote.toplam,
      gram: quote.gram,
      hacimCm3: quote.hacimCm3,
      sureSaat: quote.sureSaat,
      duvarSayisi: quote.duvarSayisi,
      enBuyukCap: quote.enBuyukCap,
      summary: quote.summary,
      name: quote.name
    });
  } catch (error) {
    if (error.message === 'RATE_LIMIT') return setRateLimitResponse(res, error);
    if (error.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'Yetkisiz erişim.' });
    if (error.message === 'GECERSIZ_ALAN' || error.message === 'GECERSIZ_DEGER') {
      return res.status(400).json({ error: error.detay || 'Geçersiz fiyat değeri.' });
    }
    console.error(error);
    if (error.message === 'ABAJUR_SIGMIYOR') return res.status(400).json({ error: 'Bu ölçüler üretim tablasına sığmıyor.' });
    return res.status(400).json({ error: 'Abajur fiyatı hesaplanamadı.' });
  }
}
