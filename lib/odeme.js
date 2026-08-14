/**
 * Havale / EFT ödeme bilgisi — tek kaynak.
 *
 * IBAN koda veya depoya yazılmaz; ortam değişkeninden okunur. Böylece
 * banka veya hesap değiştiğinde kod dağıtmadan Vercel'den güncellenir ve
 * herkese açık repoda banka bilgisi durmaz.
 *
 * Gerekli ortam değişkenleri:
 *   ODEME_IBAN    TR.. (boşluklu veya boşluksuz)
 *   ODEME_ALICI   hesap sahibinin tam adı — müşteri havalede bunu görecek
 *   ODEME_BANKA   banka adı (isteğe bağlı)
 */

/** Boşlukları temizler, büyütür. */
export function ibanSadelestir(deger) {
  return String(deger || '').replace(/\s+/g, '').toUpperCase();
}

/** Dörtlü gruplar halinde okunabilir biçim: TR12 3456 7890 ... */
export function ibanBicimle(deger) {
  const ham = ibanSadelestir(deger);
  return ham.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * TR IBAN'ı biçim ve ISO 7064 mod-97 sağlamasıyla kontrol eder.
 * Yanlış girilmiş bir IBAN müşteriyi başkasına para göndermeye
 * yönlendirebileceği için bu kontrol sessizce geçilmemeli.
 */
export function ibanGecerli(deger) {
  const iban = ibanSadelestir(deger);
  if (!/^TR\d{24}$/.test(iban)) return false;
  const donuk = iban.slice(4) + iban.slice(0, 4);
  let kalan = 0;
  for (const karakter of donuk) {
    const sayi = karakter >= 'A' && karakter <= 'Z'
      ? String(karakter.charCodeAt(0) - 55)
      : karakter;
    for (const basamak of sayi) kalan = (kalan * 10 + Number(basamak)) % 97;
  }
  return kalan === 1;
}

/** Ortamda tanımlı ödeme bilgisi; eksikse null döner. */
export function odemeBilgisi() {
  const iban = ibanSadelestir(process.env.ODEME_IBAN);
  const alici = String(process.env.ODEME_ALICI || '').trim();
  if (!iban || !alici) return null;
  return {
    iban: ibanBicimle(iban),
    alici,
    banka: String(process.env.ODEME_BANKA || '').trim(),
    gecerli: ibanGecerli(iban),
  };
}

/**
 * Sipariş için ödeme talimatı. `aciklama` mutlaka sipariş numarasıdır:
 * gelen havaleyi siparişle eşleştirmenin tek yolu budur.
 */
export function odemeTalimati(order) {
  const bilgi = odemeBilgisi();
  if (!bilgi) return null;
  return {
    ...bilgi,
    aciklama: order.orderNo,
    tutar: Number(order.total || 0),
  };
}

const tl = (n) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

/** Müşteriye gönderilecek düz metin ödeme talimatı. */
export function odemeMetni(order) {
  const o = odemeTalimati(order);
  if (!o) return '';
  return [
    'ÖDEME BİLGİLERİ',
    o.banka ? `Banka: ${o.banka}` : '',
    `Alıcı: ${o.alici}`,
    `IBAN: ${o.iban}`,
    `Tutar: ${tl(o.tutar)}`,
    `Açıklama: ${o.aciklama}`,
    '',
    'Havale/EFT açıklamasına sipariş numaranızı yazmayı unutmayın;',
    'ödemenizi siparişinizle bu numara üzerinden eşleştiriyoruz.',
  ].filter(Boolean).join('\n');
}
