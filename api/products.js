import { requireAdmin } from '../lib/auth.js';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/sheets.js';
import { shopierUrunleriOnbellekli, shopierAktif } from '../lib/shopier.js';

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
      /* Kurulum teşhisi. Dışarıdan bakınca "anahtar tanımlı değil" ile
         "anahtar var ama Shopier hata veriyor" aynı görünüyordu: ikisinde de
         katalog Shopier'siz dönüyor. Bu uç ikisini ayırır. Anahtar ya da
         Shopier'in hata metni burada yer almaz; yalnızca kaba durum. */
      if (req.query?.shopier === 'durum') {
        res.setHeader('Cache-Control', 'no-store');
        if (!shopierAktif()) {
          return res.json({ aktif: false, not: 'SHOPIER_TOKEN tanımlı değil. Ekledikten sonra yeniden dağıtmayı unutma.' });
        }
        try {
          const urunler = await shopierUrunleriOnbellekli();
          return res.json({
            aktif: true,
            calisiyor: true,
            urunSayisi: urunler.length,
            not: urunler.length
              ? 'Bağlantı çalışıyor.'
              : 'Bağlantı çalışıyor ama Shopier hiç ürün döndürmedi. Mağazada yayında ürün var mı?',
          });
        } catch (hata) {
          const kod = String(hata.message || '');
          return res.json({
            aktif: true,
            calisiyor: false,
            not: kod === 'SHOPIER_YETKI'
              ? "Anahtar geçersiz ya da yetkisiz. Shopier'de yeniden üretip Vercel'de güncelle."
              : kod === 'SHOPIER_HIZ_SINIRI'
                ? 'Shopier istek sınırına takıldı, birazdan tekrar dene.'
                : "Shopier'e ulaşılamadı.",
          });
        }
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
