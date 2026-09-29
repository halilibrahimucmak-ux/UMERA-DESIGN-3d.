/**
 * Shopier mağazasının herkese açık vitrin sayfasından katalog çıkarır.
 *
 * Neden var: Shopier bu hesapta ürün API'sini (/v1/products) 403 ile
 * reddediyor — anahtar geçerli, products:read izni var ve /orders,
 * /categories, /balance aynı anahtarla 200 dönüyor; yalnızca ürün kaynağı
 * kapalı. Destek bunu açana kadar katalog boş kalmasın diye vitrin sayfası
 * okunuyor. API açıldığı anda bu yol kendiliğinden devreden çıkar.
 *
 * Vitrin sayfası sunucuda render ediliyor, JavaScript gerekmiyor. Yine de
 * HTML ayrıştırmak kırılgandır: Shopier şablonunu değiştirirse burası boş
 * döner ve site kendi ürünleriyle çalışmaya devam eder.
 */

import { fiyatOku } from './shopier.js';

const KOK = 'https://www.shopier.com';
const ZAMAN_ASIMI = 8000;

/** Vitrin denemesinin son sonucu — teşhis için; gizli veri içermez. */
export let vitrinDurumu = null;

/* Her ürün kartı bu sınıf adıyla başlıyor. Sabit metinle bölüyoruz;
   kartın kapanış etiketini aramak işe yaramıyor, çünkü araya 4 KB'lık
   girintili işaretleme giriyor. */
const KART_AYRACI = 'class="product-card shopier--product-card';

/* Bu depo tek bir mağazaya ait ve vitrin adresi herkese açık; varsayılanı
   koda koymak bir sır sızdırmıyor, ortam değişkeni eklenmeyi unutulunca
   kataloğun sessizce boş kalmasını önlüyor. SHOPIER_MAGAZA tanımlıysa o
   kazanır. */
const VARSAYILAN_MAGAZA = 'UmeraDesign';

/** Vitrin adresindeki mağaza adı. */
export function magazaAdi() {
  const ayar = String(process.env.SHOPIER_MAGAZA || '').trim();
  return (ayar || VARSAYILAN_MAGAZA).replace(/^\/+/, '').replace(/\/+$/, '');
}


/** Etiketleri atıp HTML varlıklarını çözer. */
function metin(ham) {
  return String(ham || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vitrin HTML'ini site katalog biçiminde ürün listesine çevirir.
 * @param {string} html vitrin sayfasının kaynağı
 * @param {string} magaza mağaza adı (ürün adresini kurmak için)
 */
export function magazayiAyristir(html, magaza) {
  if (!html || !magaza) return [];

  const urunler = [];
  const gorulen = new Set();

  for (const kart of String(html).split(KART_AYRACI).slice(1)) {
    const kimlik = (kart.match(/href="[^"]*\/(\d+)"/) || [])[1];
    // Şablonda gizli bir "placeholder" kart var; kimliği olmadığı için elenir.
    if (!kimlik || gorulen.has(kimlik)) continue;

    const gorsel = (kart.match(/<img[^>]+src="([^"]+)"/) || [])[1] || '';
    /* Ad görselin alt/title özniteliğinde tam haliyle duruyor; başlık kutusu
       uzun adlarda kırpılabiliyor. */
    const ad = metin(
      (kart.match(/<img[^>]+alt="([^"]+)"/) || [])[1] ||
      (kart.match(/product-card-title"[^>]*>([\s\S]*?)<\/div>/) || [])[1] ||
      ''
    );
    if (!ad) continue;

    // data-price tam tutarı kuruşuyla veriyor: "1.499,00 TL"
    const fiyatMetni = (kart.match(/data-price="([^"]+)"/) || [])[1] || '';
    const fiyat = fiyatOku(fiyatMetni.replace(/[^\d.,]/g, ''));

    const rozet = metin((kart.match(/product-card-badges[\s\S]{0,400}?<\/div>/) || [])[0]).toLowerCase();
    const tukendi = /tükendi|tukendi|stokta yok/.test(rozet);

    gorulen.add(kimlik);
    urunler.push({
      id: `shopier:${kimlik}`,
      kaynak: 'shopier',
      shopierUrl: `${KOK}/${magaza}/${kimlik}`,
      name: ad,
      category: 'Shopier',
      price: fiyat === null ? 0 : fiyat,
      // Okunamayan fiyatta kartta "0 ₺" değil "Shopier'de gör" yazılır.
      fiyatBilinmiyor: fiyat === null,
      listePrice: 0,
      paraBirimi: 'TRY',
      // Vitrin sayfası adet vermiyor; yalnızca tükendi bilgisi var.
      stock: tukendi ? 0 : 1,
      image: gorsel,
      images: gorsel ? [{ url: gorsel, etiket: '' }] : [],
      // Açıklama ürün sayfasında; 19 ayrı istek atmamak için boş bırakılıyor.
      description: '',
      active: true,
      createdAt: '',
      minAdet: 1,
    });
  }
  return urunler;
}

/** Vitrin sayfasını indirip ayrıştırır. */
export async function magazaUrunleri() {
  const magaza = magazaAdi();
  if (!magaza) return [];

  const iptal = new AbortController();
  const saat = setTimeout(() => iptal.abort(), ZAMAN_ASIMI);
  vitrinDurumu = null;
  try {
    /* Vitrin, tarayıcılar için yazılmış herkese açık bir sayfa ve Cloudflare
       arkasında duruyor. Sunucudan istek atarken kendimizi tarayıcı gibi
       tanıtmazsak istek engellenebiliyor. Kendi mağazamızın kendi sayfası. */
    const yanit = await fetch(`${KOK}/${magaza}`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
      signal: iptal.signal,
    });
    const html = await yanit.text();
    const urunler = yanit.ok ? magazayiAyristir(html, magaza) : [];
    vitrinDurumu = { durum: yanit.status, boyut: html.length, urun: urunler.length };
    if (!yanit.ok) throw new Error(`MAGAZA_HATA_${yanit.status}`);
    return urunler;
  } catch (hata) {
    if (!vitrinDurumu) vitrinDurumu = { durum: null, hata: String(hata.message || hata).slice(0, 120) };
    throw hata;
  } finally {
    clearTimeout(saat);
  }
}

/**
 * Kendi kataloğumuzla Shopier kataloğunu tek listede birleştirir.
 *
 * Aynı ürün iki yerde birden duruyor: satıcı ürünleri hem Google Sheets'e
 * hem Shopier'e girmiş. Ham birleştirmede katalogda her biri iki kez
 * çıkıyordu — biri "Sepete Ekle" (havale), diğeri "Shopier'de Al" (kart).
 * Aynı ürünü iki kanaldan satmak stok çakışması demek.
 *
 * Eşleşenlerde ödeme Shopier'e yönlendiriliyor (satıcının tercihi: kart ve
 * taksit orada çalışıyor, stok tek yerde), ama açıklama ve çoklu görsel
 * kendi kaydımızdan korunuyor — Shopier vitrini bunları vermiyor.
 *
 * Eşleştirme yalnızca normalleştirilmiş TAM ad eşitliğiyle yapılıyor;
 * "içeriyor" gibi gevşek bir kural yanlış ürünleri birleştirebilirdi.
 */
export function katalogBirlestir(kendi = [], shopier = []) {
  const anahtar = (ad) =>
    String(ad || '')
      .toLocaleLowerCase('tr')
      .replace(/[^a-zçğıöşü0-9]+/g, ' ')
      .trim();

  const kendiHaritasi = new Map();
  for (const u of kendi) {
    const k = anahtar(u.name);
    if (k && !kendiHaritasi.has(k)) kendiHaritasi.set(k, u);
  }

  const eslesen = new Set();
  const birlesik = shopier.map((s) => {
    const es = kendiHaritasi.get(anahtar(s.name));
    if (!es) return s;
    eslesen.add(es.id);
    return {
      ...s,
      // Fiyat ve stok Shopier'den: müşteri orada ödüyor.
      description: es.description || s.description,
      images: es.images?.length ? es.images : s.images,
      image: es.images?.[0]?.url || es.image || s.image,
      category: es.category && es.category !== 'Diğer' ? es.category : s.category,
    };
  });

  // Shopier'de karşılığı olmayan kendi ürünlerimiz sepet akışında kalır.
  return [...kendi.filter((u) => !eslesen.has(u.id)), ...birlesik];
}
