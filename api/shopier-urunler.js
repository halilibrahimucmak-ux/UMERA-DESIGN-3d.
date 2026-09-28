import { shopierUrunleri, shopierAktif } from '../lib/shopier.js';

/*
 * Shopier kataloğunu tarayıcıya açar. Anahtar burada kalır: yanıtta yalnızca
 * ürünler var. Shopier'e her ziyarette gitmemek için kenarda önbelleğe alınır;
 * ödeme Shopier'de yapıldığı için stok ve fiyat orada yeniden doğrulanıyor,
 * birkaç dakikalık gecikme satışı yanlış fiyattan bağlamaz.
 */
const ONBELLEK_SN = 300;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!shopierAktif()) {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ urunler: [], aktif: false });
  }

  try {
    const urunler = await shopierUrunleri();
    res.setHeader('Cache-Control', `public, s-maxage=${ONBELLEK_SN}, stale-while-revalidate=${ONBELLEK_SN * 2}`);
    return res.json({ urunler, aktif: true });
  } catch (error) {
    // Shopier erişilemezse katalog Shopier'siz çalışmaya devam etmeli.
    const kod = String(error.message || '');
    const mesaj = kod === 'SHOPIER_YETKI'
      ? 'Shopier anahtarı geçersiz veya yetkisiz.'
      : kod === 'SHOPIER_HIZ_SINIRI'
        ? 'Shopier istek sınırına takıldı, birazdan tekrar denenecek.'
        : 'Shopier ürünleri şu an alınamadı.';
    console.error('shopier-urunler:', kod);          // anahtar loglanmaz
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ urunler: [], aktif: true, hata: mesaj });
  }
}
