/**
 * abajur-delik.mjs — Gövdeyi delen kafes desenleri.
 *
 * Mevcut desenler (nervür, dalga, faset) yalnızca yarıçapı değiştirir;
 * kabuk her yerde kapalı kalır. Buradaki desenler ise gövdeyi gerçekten
 * deler: ışık deliklerden geçer, malzeme ve baskı süresi düşer.
 *
 * Her desen, açılmış (düzleme serilmiş) yüzey üzerinde bir **işaretli
 * uzaklık** üretir:
 *     f(θ, u) > 0  -> katı (çubuk)
 *     f(θ, u) < 0  -> delik
 * Değer milimetre cinsindendir, dolayısıyla çubuk kalınlığı doğrudan
 * kontrol edilebilir ve geometri kodu delik kenarını ara değerle tam
 * yerinde kesebilir (bkz. abajurGeometrisi).
 *
 * Desenler BELİRLENİMCİDİR: organik desendeki rastgelelik `delikTohum`
 * ile tohumlanır, böylece aynı sipariş aylar sonra da aynı modeli verir.
 */

export const DELIK_DESENLERI = ["yok", "elmas", "petek", "organik"];

/** Çubuk kalınlığı sınırları (mm). Altında baskı kırılgan olur. */
export const CUBUK_ARALIK = [1.5, 8];

/**
 * Bir çubuğun karşısına düşmesi gereken en az ızgara hücresi.
 *
 * Bu oran 1'in altına inerse çubuk iki örnek arasına sığar ve yer yer
 * tamamen kaybolur: kafes lif lif parçalanmış görünür. 2.5, hem topolojiyi
 * güvenle yakalar hem kenarları düzgün bırakır.
 */
export const CUBUK_HUCRE_ORANI = 2.5;

/** Delikli modelde hücre başına düşen ortalama üçgen (ölçümle kalibre).
    Kapalı kabukta 4'tür; delikte çoğu hücre boş kalsa da sınır hücreleri
    kırpılmış yüzey + delik yan duvarı ürettiği için ölçülen değer 5'e
    yakın çıkıyor. */
const UCGEN_KATSAYISI = 5;

/**
 * Bu gövdede üretilebilecek EN İNCE çubuk kalınlığı (mm).
 *
 * Çubuk inceldikçe onu çözebilmek için ızgara sıklaşır ve üçgen sayısı
 * kare olarak artar. Bütçe aşılınca çözünürlüğü düşürmek parçalanmayı geri
 * getirirdi; bunun yerine çubuğu inceltmeye baştan izin vermiyoruz.
 */
export function enAzCubukKalinligi(yukseklik, rOrt, ucgenButcesi) {
  const C = 2 * Math.PI * rOrt;
  const gerekli = Math.sqrt(
    (UCGEN_KATSAYISI * CUBUK_HUCRE_ORANI * CUBUK_HUCRE_ORANI * C * yukseklik) / ucgenButcesi
  );
  return Math.max(CUBUK_ARALIK[0], Math.ceil(gerekli * 10) / 10);
}

/** Delik deseni için gereken ızgara adımı (mm). */
export function delikIzgaraAdimi(cubukKalinlik) {
  return Math.max(0.2, cubukKalinlik / CUBUK_HUCRE_ORANI);
}

/** Delik alanının gövde üstünde/altında bıraktığı katı bant (mm). */
export const ALT_BANT = 10;
export const UST_BANT_EK = 4; // yakanın üstüne eklenen pay

/* ------------------------- yardımcılar ------------------------- */

/** Tohumlanmış, taşınabilir rastgele üreteç (mulberry32). */
function rastgeleUret(tohum) {
  let t = (tohum >>> 0) || 1;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deliklerin açılabileceği yükseklik aralığı (mm). */
export function delikAlani(p, yakaYuksekligi) {
  const alt = ALT_BANT;
  const ust = p.yukseklik - yakaYuksekligi - UST_BANT_EK;
  return { alt, ust, yeterli: ust - alt > 20 };
}

/* --------------------------- desenler --------------------------- */

/**
 * Elmas kafes: iki çapraz çizgi ailesinin kesişimi. Delikler baklava
 * dilimi biçiminde olur ve üst uçları sivri bittiği için köprü
 * gerektirmez — baskı açısından en güvenli desen.
 */
function elmasAlan(C, cubuk, nCevre, nDikey, alt, ust) {
  const a = C / nCevre;
  const b = (ust - alt) / nDikey;
  const olcek = Math.hypot(1 / a, 1 / b);
  const yari = cubuk / 2;

  return (s, t) => {
    const k = (t - alt) / b;
    const m = s / a;
    const d1 = Math.abs((m + k) - Math.round(m + k)) / olcek;
    const d2 = Math.abs((m - k) - Math.round(m - k)) / olcek;
    return yari - Math.min(d1, d2);
  };
}

/**
 * Voronoi tabanlı desenler. Tohumlar düzgün altıgen ızgaradaysa petek,
 * sarsılmışsa organik hücreler çıkar. Katı bölge, en yakın iki tohuma
 * uzaklığın neredeyse eşit olduğu yerdir — yani hücre sınırları.
 */
function voronoiAlan(C, cubuk, tohumlar, hucreBoy) {
  const yari = cubuk / 2;

  // Uzamsal kova: her sorguda tüm tohumlara bakmak pahalı olurdu.
  const kovaBoy = Math.max(hucreBoy, 1);
  const kovaX = Math.max(1, Math.round(C / kovaBoy));
  const kovaXBoy = C / kovaX;
  const kovalar = new Map();
  let enAzT = Infinity;
  let enCokT = -Infinity;
  for (const [ss, tt] of tohumlar) {
    enAzT = Math.min(enAzT, tt);
    enCokT = Math.max(enCokT, tt);
  }
  const kovaAnahtar = (ix, iy) => ix * 100000 + iy;
  for (const tohum of tohumlar) {
    const ix = ((Math.floor(tohum[0] / kovaXBoy) % kovaX) + kovaX) % kovaX;
    const iy = Math.floor((tohum[1] - enAzT) / kovaBoy);
    const a = kovaAnahtar(ix, iy);
    let liste = kovalar.get(a);
    if (!liste) kovalar.set(a, (liste = []));
    liste.push(tohum);
  }

  return (s, t) => {
    const ix0 = ((Math.floor(s / kovaXBoy) % kovaX) + kovaX) % kovaX;
    const iy0 = Math.floor((t - enAzT) / kovaBoy);
    let d1 = Infinity;
    let d2 = Infinity;
    /* +-2 kova taranir: +-1 ile ikinci en yakin tohum kacirilabiliyor ve
       alan kopuyordu (olculdu: 0.945 mm sicrama, ornek araligi 0.628 mm).
       Kopuk alanda kontur kapanmaz, ag su gecirmez olmaz. */
    for (let dx = -2; dx <= 2; dx++) {
      const ix = ((ix0 + dx) % kovaX + kovaX) % kovaX;
      for (let dy = -2; dy <= 2; dy++) {
        const liste = kovalar.get(kovaAnahtar(ix, iy0 + dy));
        if (!liste) continue;
        for (const [ss, tt] of liste) {
          let ds = s - ss;
          ds -= C * Math.round(ds / C); // silindirde sarmalama
          const dt = t - tt;
          const d = Math.sqrt(ds * ds + dt * dt);
          if (d < d1) { d2 = d1; d1 = d; }
          else if (d < d2) d2 = d;
        }
      }
    }
    if (!Number.isFinite(d2)) return -1; // komşu bulunamadı -> delik say
    return yari - (d2 - d1) / 2;
  };
}

/** Petek ve organik için tohum yerleşimi. */
function tohumlariUret(C, alt, ust, hucreBoy, dagitim, tohumNo) {
  const nCevre = Math.max(3, Math.round(C / hucreBoy));
  const dx = C / nCevre;
  const dy = dx * 0.866; // altıgen ızgara satır aralığı
  const nDikey = Math.max(2, Math.round((ust - alt) / dy));
  const gercekDy = (ust - alt) / nDikey;

  const rnd = rastgeleUret(tohumNo);
  const tohumlar = [];
  // Delik alanının bir satır dışına da tohum koy: kenar hücreleri
  // yarım kalmasın, sınırda garip uzun çubuklar oluşmasın.
  for (let j = -1; j <= nDikey + 1; j++) {
    for (let i = 0; i < nCevre; i++) {
      const kaydir = (j & 1) ? dx / 2 : 0;
      let s = i * dx + kaydir;
      let t = alt + j * gercekDy;
      if (dagitim === "organik") {
        s += (rnd() - 0.5) * dx * 0.62;
        t += (rnd() - 0.5) * gercekDy * 0.62;
      }
      tohumlar.push([((s % C) + C) % C, t]);
    }
  }
  return { tohumlar, hucreBoy: Math.max(dx, gercekDy) };
}

/* ------------------------------ API ------------------------------ */

/**
 * Verilen yapılandırma için işaretli uzaklık fonksiyonu döndürür.
 * Delik yoksa null döner; çağıran tarafta eski (kapalı) yol çalışır.
 *
 * @param p               abajur yapılandırması
 * @param yakaYuksekligi  üstteki desensiz yaka bandı (mm)
 * @param rOrt            gövdenin ortalama yarıçapı (deseni açma ölçeği)
 * @returns {null | { f: (theta:number, u:number)=>number, bilgi: object }}
 */
export function delikAlaniFonksiyonu(p, yakaYuksekligi, rOrt) {
  const desen = p.delik;
  if (!desen || desen === "yok" || !DELIK_DESENLERI.includes(desen)) return null;

  const { alt, ust, yeterli } = delikAlani(p, yakaYuksekligi);
  if (!yeterli) return null; // gövde delik açacak kadar uzun değil

  const C = 2 * Math.PI * rOrt;
  const cubuk = Math.min(CUBUK_ARALIK[1], Math.max(CUBUK_ARALIK[0], Number(p.cubukKalinlik) || 2.5));
  const hedefHucre = Math.max(cubuk * 2.2, Number(p.delikBoyu) || 18);

  let alan;
  let bilgi;

  if (desen === "elmas") {
    const nCevre = Math.max(4, Math.round(C / hedefHucre));
    const nDikey = Math.max(2, Math.round((ust - alt) / hedefHucre));
    alan = elmasAlan(C, cubuk, nCevre, nDikey, alt, ust);
    bilgi = { desen, nCevre, nDikey, hucreBoy: C / nCevre, cubuk };
  } else {
    const { tohumlar, hucreBoy } = tohumlariUret(
      C, alt, ust, hedefHucre,
      desen === "organik" ? "organik" : "duzgun",
      Math.round(Number(p.delikTohum) || 1)
    );
    alan = voronoiAlan(C, cubuk, tohumlar, hucreBoy);
    bilgi = { desen, tohumSayisi: tohumlar.length, hucreBoy, cubuk };
  }

  /* Üst ve alt bantlar daima katı: halkalar ve taşıyıcı bağlantısı orada.

     f bant içinde de GERÇEK bir uzaklık döndürür. Önce sabit büyük bir
     sayı (1e3) dönüyordu; bant sınırındaki hücrede kesişim oranı
     1e3/(1e3+küçük) ≈ 1 çıkıyor, kontur noktası köşeye yapışıp sıfır
     alanlı üçgen ve çift duvar üretiyordu. Sürekli uzaklıkla o kenar
     iyi koşullu oluyor. */
  const gecis = 1.5; // bant kenarındaki yumuşak geçiş (mm)
  const f = (theta, u) => {
    const t = u * p.yukseklik;
    const bantIci = Math.max(alt - t, t - ust); // >0 ise katı bant içinde
    if (bantIci >= 0) return bantIci + gecis;
    const s = theta * rOrt;
    const icDeger = alan(((s % C) + C) % C, t);
    const kenaraUzaklik = -bantIci;
    if (kenaraUzaklik < gecis) return Math.max(icDeger, gecis - kenaraUzaklik);
    return icDeger;
  };

  return { f, bilgi: { ...bilgi, alt, ust, C, rOrt } };
}
