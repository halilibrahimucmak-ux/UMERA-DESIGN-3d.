import { requireAdmin } from '../lib/auth.js';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/sheets.js';
import { shopierUrunleriOnbellekli, shopierAktif, sonKaynak, sonHata } from '../lib/shopier.js';
import { magazaAdi, vitrinDurumu } from '../lib/shopier-magaza.js';

/*
 * Katalog ve ürün yönetimi.
 *
 * Shopier ürünleri ayrı bir uçta değil burada: Vercel'in Hobby planı dağıtım
 * başına 12 fonksiyona izin veriyor ve api/ klasöründeki her dosya bir
 * fonksiyon oluyor. Ayrı uç 13'e çıkarıp dağıtımı düşürüyordu.
 *
 * Yalnızca vitrin (?katalog=1) Shopier'i ekler; admin paneli kendi ürünlerini
 * düzenlediği için onları görmemeli.
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      /* Kurulum teşhisi: katalog hangi kaynaktan besleniyor, kaç ürün geldi.
         Anahtarın değeri ya da içeriği burada yer almaz. */
      if (req.query?.shopier === 'durum') {
        res.setHeader('Cache-Control', 'no-store');
        const urunler = await shopierUrunleriOnbellekli().catch(() => []);

        return res.json({
          kaynak: sonKaynak,
          urunSayisi: urunler.length,
          apiAnahtariTanimli: shopierAktif(),
          apiSonDurum: sonHata?.durum ?? null,
          magaza: magazaAdi(),
          vitrin: vitrinDurumu,
          not: sonKaynak === 'api'
            ? 'Ürünler Shopier API üzerinden geliyor.'
            : sonKaynak === 'vitrin'
              ? 'Ürünler mağazanın herkese açık vitrin sayfasından geliyor (API 403 verdiği için).'
              : 'Hiç ürün alınamadı. Mağaza adı doğru mu, vitrinde yayında ürün var mı?',
        });
      }

      const kendi = await getProducts();
      if (!req.query?.katalog) return res.json(kendi);

      let shopier = [];
      try {
        shopier = await shopierUrunleriOnbellekli();
      } catch (hata) {
        // Shopier erişilemezse katalog kendi ürünleriyle çalışmaya devam eder.
        console.error('shopier:', String(hata.message || hata));
      }
      return res.json([...kendi, ...shopier]);
    }

    await requireAdmin(req);
    if (req.method === 'POST') return res.status(201).json(await createProduct(req.body));
    if (req.method === 'PUT') { const { id, ...p } = req.body || {}; return res.json(await updateProduct(id, p)); }
    if (req.method === 'DELETE') { await deleteProduct(req.body?.id); return res.json({ ok: true }); }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    const code = e.message === 'UNAUTHORIZED' ? 401 : e.message === 'NOT_FOUND' ? 404 : 500;
    return res.status(code).json({ error: code === 401 ? 'Yetkisiz erişim.' : e.message || 'İşlem başarısız.' });
  }
}
