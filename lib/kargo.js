/**
 * Kargo ücreti — tek kaynak.
 *
 * Ücret istemciden GELMEZ; sipariş toplamı her zaman burada, sunucuda
 * hesaplanır. İstemci yalnızca göstermek için okur.
 *
 * Ortam değişkenleri:
 *   KARGO_UCRETI       ₺ — 0 veya tanımsızsa kargo ücreti alınmaz
 *   KARGO_BEDAVA_ESIK  ₺ — sepet ara toplamı bu tutara ulaşırsa kargo bedava
 *                          (0 veya tanımsızsa bedava kargo yok)
 */

const sayi = (deger) => {
  const n = Number(deger);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export function kargoAyari() {
  const ucret = sayi(process.env.KARGO_UCRETI);
  const bedavaEsik = sayi(process.env.KARGO_BEDAVA_ESIK);
  return {
    ucret,
    bedavaEsik,
    // ücret tanımlı değilse kargo hiç gösterilmez (ör. elden teslim)
    aktif: ucret > 0,
  };
}

/**
 * Sepet ara toplamına göre kargo bedeli.
 * @param {number} araToplam Ürünlerin KDV dahil toplamı (kargo hariç)
 */
export function kargoHesapla(araToplam) {
  const { ucret, bedavaEsik } = kargoAyari();
  if (ucret <= 0) return 0;
  if (bedavaEsik > 0 && Number(araToplam) >= bedavaEsik) return 0;
  return ucret;
}

/** Kalan tutar bedava kargoya ne kadar kaldı — 0 ise ulaşılmış demektir. */
export function bedavaKargoyaKalan(araToplam) {
  const { ucret, bedavaEsik } = kargoAyari();
  if (ucret <= 0 || bedavaEsik <= 0) return 0;
  return Math.max(0, bedavaEsik - Number(araToplam || 0));
}
