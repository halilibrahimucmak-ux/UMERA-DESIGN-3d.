/**
 * Görseli tarayıcıda küçültüp yeniden kodlar.
 *
 * Neden: Vercel serverless fonksiyonlarında istek gövdesi 4.5 MB ile sınırlı.
 * Görsel base64'e çevrilince ~%33 büyüdüğü için 3 MB'lık bir fotoğraf ~4 MB
 * gövde demek — sınırın hemen dibinde. Telefon fotoğrafları zaten 5-12 MB
 * olduğundan kullanıcı çoğu zaman hiç yükleyemiyordu.
 *
 * Burada dosya daha ağa çıkmadan uzun kenarı sınırlanıp WebP'ye çevriliyor;
 * 12 MP bir fotoğraf tipik olarak 200-500 KB'a iniyor. Sunucudaki 3 MB
 * kontrolü ikinci savunma hattı olarak yerinde kalıyor.
 */

const VARSAYILAN = {
  maksKenar: 2000,      // px — ürün ve referans görselleri için fazlasıyla yeterli
  hedefBayt: 900_000,   // base64 sonrası ~1.2 MB
  enDusukKalite: 0.5,
};

const DESTEKLENEN = ['image/jpeg', 'image/png', 'image/webp'];

function webpDestegi() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Görsel okunamadı.'));
    reader.readAsDataURL(blob);
  });
}

function canvasBlob(canvas, tur, kalite) {
  return new Promise((resolve) => canvas.toBlob(resolve, tur, kalite));
}

async function goruntuAl(file) {
  // imageOrientation: telefon fotoğraflarındaki EXIF dönüşü uygulanır,
  // yoksa yüklenen görsel yan yatmış görünür.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* eski tarayıcı — aşağıdaki yola düş */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Görsel açılamadı.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * @returns {Promise<{dataUrl:string,name:string,type:string,oncekiBayt:number,sonrakiBayt:number,genislik:number,yukseklik:number}>}
 */
export async function sikistir(file, secenek = {}) {
  const ayar = { ...VARSAYILAN, ...secenek };
  if (!DESTEKLENEN.includes(file.type)) {
    throw new Error('Sadece JPG, PNG veya WEBP yükleyebilirsiniz.');
  }

  const hedefTur = webpDestegi() ? 'image/webp' : 'image/jpeg';
  let goruntu;
  try {
    goruntu = await goruntuAl(file);
  } catch {
    // görsel çözülemedi — orijinali olduğu gibi gönder, sunucu doğrulasın
    return {
      dataUrl: await blobDataUrl(file),
      name: file.name,
      type: file.type,
      oncekiBayt: file.size,
      sonrakiBayt: file.size,
      genislik: 0,
      yukseklik: 0,
    };
  }

  const kaynakG = goruntu.width;
  const kaynakY = goruntu.height;
  const olcek = Math.min(1, ayar.maksKenar / Math.max(kaynakG, kaynakY));
  let genislik = Math.max(1, Math.round(kaynakG * olcek));
  let yukseklik = Math.max(1, Math.round(kaynakY * olcek));

  let sonuc = null;
  let kalite = 0.85;

  for (let deneme = 0; deneme < 6; deneme++) {
    const canvas = document.createElement('canvas');
    canvas.width = genislik;
    canvas.height = yukseklik;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    // PNG'nin şeffaf zemini JPEG'de siyaha dönmesin
    if (hedefTur === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, genislik, yukseklik);
    }
    ctx.drawImage(goruntu, 0, 0, genislik, yukseklik);

    const blob = await canvasBlob(canvas, hedefTur, kalite);
    canvas.width = canvas.height = 0;
    if (!blob) break;
    sonuc = blob;
    if (blob.size <= ayar.hedefBayt) break;

    if (kalite > ayar.enDusukKalite) {
      kalite = Math.max(ayar.enDusukKalite, kalite - 0.12);
    } else {
      genislik = Math.max(320, Math.round(genislik * 0.8));
      yukseklik = Math.max(320, Math.round(yukseklik * 0.8));
    }
  }

  goruntu.close?.();

  if (!sonuc) {
    return {
      dataUrl: await blobDataUrl(file),
      name: file.name,
      type: file.type,
      oncekiBayt: file.size,
      sonrakiBayt: file.size,
      genislik: kaynakG,
      yukseklik: kaynakY,
    };
  }

  // Sıkıştırma işe yaramadıysa (zaten küçük ve optimize dosya) orijinali koru
  if (sonuc.size >= file.size && file.size <= ayar.hedefBayt) {
    return {
      dataUrl: await blobDataUrl(file),
      name: file.name,
      type: file.type,
      oncekiBayt: file.size,
      sonrakiBayt: file.size,
      genislik: kaynakG,
      yukseklik: kaynakY,
    };
  }

  const uzanti = hedefTur === 'image/webp' ? 'webp' : 'jpg';
  return {
    dataUrl: await blobDataUrl(sonuc),
    name: file.name.replace(/\.[^.]+$/, '') + '.' + uzanti,
    type: hedefTur,
    oncekiBayt: file.size,
    sonrakiBayt: sonuc.size,
    genislik,
    yukseklik,
  };
}

export function boyutYazisi(bayt) {
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`;
  return `${(bayt / 1024 / 1024).toFixed(1)} MB`;
}
