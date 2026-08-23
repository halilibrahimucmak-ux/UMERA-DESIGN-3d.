/**
 * Abajur fiyat tarifesi — varsayılan değerler + yöneticinin kaydettikleri.
 *
 * Tarife Sheets'te düz anahtar/değer olarak tutulur ("filament.PLA" = 780).
 * Burada varsayılanların üzerine biniyor ve her alan aralık kontrolünden
 * geçiyor: bozuk ya da uçuk bir değer fiyatı sıfırlamamalı veya saçma bir
 * tutar üretmemeli.
 */

export const VARSAYILAN_TARIFE = {
  guncelleme: '2026-08-15',
  filament: { PLA: 780, PETG: 975, 'PLA Silk': 1014 },
  fire: 8,
  makineSaat: 45,
  /* Efektif baskı akışı (mm³/s) — baskı süresini, dolayısıyla makine
     maliyetini belirler. Fiyatı en çok etkileyen kalem budur.
     Kalibrasyon: akis = hacim(cm³) × 1000 ÷ (gerçek_süre_saat × 3600). */
  akisMm3s: 4,
  elIsciligi: 60,
  boyunMontaj: 45,
  duy: { E27: 180, E14: 150 },
  kar: 55,
  duyMarj: 35,
  kdv: 20,
};

/** Her alanın kabul edilebilir aralığı: [en az, en çok]. */
export const TARIFE_ARALIK = {
  'filament.PLA': [0, 20000],
  'filament.PETG': [0, 20000],
  'filament.PLA Silk': [0, 20000],
  fire: [0, 100],
  makineSaat: [0, 10000],
  akisMm3s: [0.5, 60],
  elIsciligi: [0, 100000],
  boyunMontaj: [0, 100000],
  'duy.E27': [0, 50000],
  'duy.E14': [0, 50000],
  kar: [0, 1000],
  duyMarj: [0, 1000],
  kdv: [0, 100],
};

export const TARIFE_ALANLARI = Object.keys(TARIFE_ARALIK);

/** Düz anahtarla iç içe tarifeden değer okur. */
export function tarifeOku(tarife, anahtar) {
  const [ust, alt] = anahtar.split('.');
  return alt === undefined ? tarife[ust] : tarife[ust]?.[alt];
}

/** Düz anahtarları iç içe nesneye yazar (kopya üzerinde). */
function tarifeYaz(tarife, anahtar, deger) {
  const [ust, alt] = anahtar.split('.');
  if (alt === undefined) tarife[ust] = deger;
  else tarife[ust] = { ...(tarife[ust] || {}), [alt]: deger };
}

/**
 * Bir alanı doğrular ve aralığa sıkıştırır.
 * @returns {{gecerli: boolean, deger: number}}
 */
export function tarifeAlaniDogrula(anahtar, ham) {
  const aralik = TARIFE_ARALIK[anahtar];
  if (!aralik) return { gecerli: false, deger: 0 };
  // "1.500" ve "1,5" gibi yerel yazımları toparla
  const sayi = Number(String(ham).trim().replace(',', '.'));
  if (!Number.isFinite(sayi)) return { gecerli: false, deger: 0 };
  const [enAz, enCok] = aralik;
  return { gecerli: true, deger: Math.min(enCok, Math.max(enAz, sayi)) };
}

/**
 * Kaydedilmiş düz anahtarları varsayılanların üzerine bindirir.
 * Bilinmeyen anahtarlar ve geçersiz değerler yok sayılır — tarifenin
 * kısmen bozuk olması fiyatlandırmayı durdurmamalı.
 */
export function tarifeBirlestir(kayit = {}) {
  const tarife = {
    ...VARSAYILAN_TARIFE,
    filament: { ...VARSAYILAN_TARIFE.filament },
    duy: { ...VARSAYILAN_TARIFE.duy },
  };
  for (const [anahtar, ham] of Object.entries(kayit || {})) {
    if (!TARIFE_ARALIK[anahtar]) continue;
    const { gecerli, deger } = tarifeAlaniDogrula(anahtar, ham);
    if (gecerli) tarifeYaz(tarife, anahtar, deger);
  }
  return tarife;
}

/**
 * Yöneticiden gelen gövdeyi kaydedilebilir düz anahtarlara çevirir.
 * Tanınmayan alan gönderilirse hata verir; sessizce yutmak, yöneticinin
 * kaydettiğini sandığı bir değerin uygulanmamasına yol açardı.
 */
export function kaydedilecekAlanlar(govde = {}) {
  const alanlar = {};
  for (const [anahtar, ham] of Object.entries(govde)) {
    if (!TARIFE_ARALIK[anahtar]) {
      throw Object.assign(new Error('GECERSIZ_ALAN'), { detay: `Bilinmeyen fiyat alanı: ${anahtar}` });
    }
    const { gecerli, deger } = tarifeAlaniDogrula(anahtar, ham);
    if (!gecerli) {
      throw Object.assign(new Error('GECERSIZ_DEGER'), { detay: `${anahtar} sayı olmalı.` });
    }
    alanlar[anahtar] = deger;
  }
  if (!Object.keys(alanlar).length) {
    throw Object.assign(new Error('GECERSIZ_DEGER'), { detay: 'Kaydedilecek alan yok.' });
  }
  return alanlar;
}
