/**
 * Katalog ürünü sipariş kuralları.
 *
 * Bu kurallar istemciye güvenilerek uygulanamaz: sepeti düzenlemek veya
 * doğrudan API'ye istek atmak mümkün. Bu yüzden stok, minimum adet ve fiyat
 * her siparişte sunucuda, ürünün Sheets'teki güncel kaydına bakılarak
 * yeniden doğrulanır.
 */

/** Ürünün minimum sipariş adedi — tanımsız/bozuk değerlerde 1. */
export function minSiparisAdedi(product) {
  const sayi = Math.floor(Number(product?.minAdet));
  return Number.isFinite(sayi) && sayi > 1 ? Math.min(sayi, 999) : 1;
}

/**
 * Bir sepet kalemini doğrular. Kural ihlalinde hata fırlatır.
 *
 * @param {object}  product     Sheets'teki güncel ürün kaydı (yoksa undefined)
 * @param {number}  quantity    İstenen adet
 * @param {boolean} katalogVar  Katalog okunabildi mi (boşsa doğrulama atlanır)
 */
export function dogrulaKatalogKalemi(product, quantity, katalogVar) {
  if (katalogVar && !product) throw new Error('ÜRÜN_BULUNAMADI');
  if (!product) return { minAdet: 1 };

  if (product.stock === 0) throw new Error('STOK_YOK');

  const minAdet = minSiparisAdedi(product);

  // Stok minimumun altına düşmüşse sipariş hiç karşılanamaz; "stok yetersiz"
  // demek yanıltıcı olurdu, müşteri adedi düşürerek çözemez.
  if (product.stock > 0 && product.stock < minAdet) {
    throw Object.assign(new Error('MIN_ADET'), {
      detay: `"${product.name}" en az ${minAdet} adet satılıyor ama stokta ${product.stock} adet kaldı.`
    });
  }

  if (quantity < minAdet) {
    throw Object.assign(new Error('MIN_ADET'), {
      detay: `"${product.name}" en az ${minAdet} adet sipariş edilebilir.`
    });
  }

  if (product.stock > 0 && quantity > product.stock) throw new Error('STOK_YETERSİZ');

  return { minAdet };
}
