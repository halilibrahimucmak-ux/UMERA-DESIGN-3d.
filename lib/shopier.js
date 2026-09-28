/**
 * Shopier kataloğunu siteye taşır.
 *
 * Ödeme Shopier'de kalıyor: burada üretilen ürünler sepete girmez, "Satın Al"
 * müşteriyi Shopier ürün sayfasına götürür. Böylece stok ve fiyatın tek doğru
 * kaynağı Shopier olur ve aynı ürün iki kanaldan satılıp çakışmaz.
 *
 * Kişisel erişim anahtarı (PAT) Shopier hesabında TAM yetki verir; bu yüzden
 * yalnızca sunucuda, ortam değişkeninden okunur ve hiçbir yanıtta, hiçbir log
 * satırında görünmez.
 */

const KOK = 'https://api.shopier.com/v1';
const SAYFA_BOYU = 50;      // Shopier'in izin verdiği en büyük limit
const EN_COK_SAYFA = 20;    // 1000 ürün; sonsuz döngüye karşı emniyet
const ZAMAN_ASIMI = 8000;

export function shopierAktif() {
  return Boolean(process.env.SHOPIER_TOKEN);
}

/** HTML açıklamayı kart üzerinde okunur düz metne indirger. */
function duzMetin(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fiyat metnini sayıya çevirir. Shopier fiyatı metin olarak veriyor ve
 * belgede biçimi yazmıyor; "1200", "899.90", "899,90", "1.299,50" ve
 * "1,299.50" biçimlerinin hepsi gelebilir. Yanlış okunması müşteriye yanlış
 * fiyat göstermek demek, o yüzden tahmin etmiyoruz: iki ayraç birden varsa
 * SONDAKİ ondalıktır, diğeri binliktir. Çözülemeyen değer null döner ve
 * kartta tutar yerine "Shopier'de gör" yazılır.
 */
export function fiyatOku(deger) {
  if (deger === null || deger === undefined) return null;
  if (typeof deger === 'number') return Number.isFinite(deger) ? deger : null;

  const ham = String(deger).replace(/[^0-9.,-]/g, '');
  if (!ham || !/[0-9]/.test(ham)) return null;

  const sonNokta = ham.lastIndexOf('.');
  const sonVirgul = ham.lastIndexOf(',');
  let metin;

  if (sonNokta >= 0 && sonVirgul >= 0) {
    // İkisi de var: sondaki ondalık ayraç, öteki binlik.
    const ondalik = sonNokta > sonVirgul ? '.' : ',';
    const binlik = ondalik === '.' ? ',' : '.';
    metin = ham.split(binlik).join('').replace(ondalik, '.');
  } else if (sonVirgul >= 0) {
    /* Yalnız virgül. Tek virgül ve ardından tam üç rakam geliyorsa binlik
       ("1,200"), değilse Türkçe ondalık ("899,90"). */
    const tek = ham.indexOf(',') === sonVirgul;
    metin = tek && ham.length - sonVirgul === 4 ? ham.replace(',', '') : ham.split(',').join('.');
  } else if (sonNokta >= 0) {
    /* Yalnız nokta: "899.90" ondalık, "1.200" binlik. Tek nokta ve ardından
       tam üç rakam varsa binlik sayılır — 1,2 TL'lik ürün gerçekçi değil. */
    const tek = ham.indexOf('.') === sonNokta;
    metin = tek && ham.length - sonNokta === 4 ? ham.replace('.', '') : ham;
  } else {
    metin = ham;
  }

  const n = Number(metin);
  return Number.isFinite(n) ? n : null;
}
function sayi(deger) {
  const n = fiyatOku(deger);
  return n === null ? 0 : n;
}

/** Shopier ürününü sitenin katalog biçimine çevirir. */
export function shopierUrunuCevir(ham) {
  const fiyatlar = ham.priceData || {};
  // İndirim varsa müşterinin Shopier'de ödeyeceği tutar gösterilmeli.
  const okunan = fiyatlar.discount ? fiyatOku(fiyatlar.discountedPrice) : fiyatOku(fiyatlar.price);
  const fiyat = okunan === null ? 0 : okunan;
  const liste = sayi(fiyatlar.price);

  const gorseller = (ham.media || [])
    .filter(m => m && m.type === 'image' && m.url)
    .sort((a, b) => (a.placement || 99) - (b.placement || 99))
    .map(m => ({ url: m.url, etiket: '' }));

  // stockQuantity sınırsız stokta 0 gelebiliyor; "tükendi" kararını
  // stockStatus veriyor, miktar yalnızca bilgi.
  const tukendi = ham.stockStatus === 'outOfStock';

  return {
    id: `shopier:${ham.id}`,
    kaynak: 'shopier',
    shopierUrl: ham.url || '',
    name: ham.title || 'Ürün',
    category: ham.categories?.[0]?.title || 'Shopier',
    price: fiyat,
    // Okunamayan fiyatta "0 ₺" yazmak yanlış bilgi olur; kart bunu görünce
    // tutar yerine Shopier'e yönlendirir.
    fiyatBilinmiyor: okunan === null,
    listePrice: okunan !== null && fiyatlar.discount && liste > fiyat ? liste : 0,
    paraBirimi: fiyatlar.currency || 'TRY',
    kargoUcreti: sayi(fiyatlar.shippingPrice),
    kargoSaticiOdiyor: ham.shippingPayer === 'sellerPays',
    stock: tukendi ? 0 : Math.max(1, Number(ham.stockQuantity) || 1),
    image: gorseller[0]?.url || '',
    images: gorseller,
    description: duzMetin(ham.description),
    active: true,
    createdAt: ham.dateCreated || '',
    minAdet: 1,
  };
}

async function sayfaCek(sayfa, token) {
  const iptal = new AbortController();
  const saat = setTimeout(() => iptal.abort(), ZAMAN_ASIMI);
  try {
    const yanit = await fetch(`${KOK}/products?limit=${SAYFA_BOYU}&page=${sayfa}&sort=dateDesc`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: iptal.signal,
    });
    if (yanit.status === 401 || yanit.status === 403) throw new Error('SHOPIER_YETKI');
    if (yanit.status === 429) throw new Error('SHOPIER_HIZ_SINIRI');
    if (!yanit.ok) throw new Error(`SHOPIER_HATA_${yanit.status}`);
    const veri = await yanit.json();
    return Array.isArray(veri) ? veri : (veri.data || veri.products || []);
  } finally {
    clearTimeout(saat);
  }
}

/**
 * Shopier'deki tüm ürünleri sayfa sayfa toplar ve site biçiminde döner.
 * Anahtar tanımlı değilse boş dizi verir — site Shopier olmadan da çalışır.
 */
export async function shopierUrunleri() {
  const token = process.env.SHOPIER_TOKEN;
  if (!token) return [];

  const hepsi = [];
  for (let sayfa = 1; sayfa <= EN_COK_SAYFA; sayfa++) {
    const parca = await sayfaCek(sayfa, token);
    hepsi.push(...parca);
    if (parca.length < SAYFA_BOYU) break;   // son sayfa
  }
  return hepsi
    .filter(u => u && u.id)
    .map(shopierUrunuCevir)
    // Satın alınacak yer Shopier ürün sayfası; adresi olmayanı listelemeyiz.
    .filter(u => u.shopierUrl);
}
/* Sunucusuz örnek yeniden kullanıldığında Shopier'e her istekte gitmemek için
   süreç içi küçük bir önbellek. Vercel'in Hobby planı dağıtım başına 12
   fonksiyona izin verdiğinden Shopier'in ayrı ucu yok; katalog /api/products
   içinden servis ediliyor ve orada kenar önbelleği yok. */
let onbellek = { zaman: 0, urunler: null };
const ONBELLEK_MS = 5 * 60 * 1000;

/** Önbellekli okuma. Shopier düşerse elde veri varsa onu sürdürür. */
export async function shopierUrunleriOnbellekli() {
  if (!shopierAktif()) return [];
  const simdi = Date.now();
  if (onbellek.urunler && simdi - onbellek.zaman < ONBELLEK_MS) return onbellek.urunler;
  try {
    const urunler = await shopierUrunleri();
    onbellek = { zaman: simdi, urunler };
    return urunler;
  } catch (hata) {
    // Bayat veri, hiç ürün göstermemekten iyi.
    if (onbellek.urunler) return onbellek.urunler;
    throw hata;
  }
}
