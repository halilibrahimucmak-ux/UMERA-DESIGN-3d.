import test from 'node:test';
import assert from 'node:assert/strict';
import { magazayiAyristir, magazaAdi, katalogBirlestir } from '../lib/shopier-magaza.js';

/* Gerçek vitrin işaretlemesinin küçültülmüş hali: iki ürün, bir de şablonun
   gizli "placeholder" kartı. Kart sınıfı ve data-price biçimi olduğu gibi. */
const HTML = `
<div class="product-card placeholder addable-placeholder !hidden"><a href="#"></a></div>
<div class="product-card shopier--product-card product-card-store">
  <a  href="https://www.shopier.com/UmeraDesign/51324068" data-back-id="51324068">
    <div class="product-card-image-container"><picture>
      <img src="https://cdn.shopier.app/pictures_mid/A.jpeg" alt="Umera Curve &amp; Masa Lambası" title="Umera Curve &amp; Masa Lambası">
    </picture></div>
    <div class="product-card-body">
      <div class="product-card-badges product-card-badges-store"><span class="badge">Yeni</span></div>
      <div class="product-card-title">Umera Curve</div>
      <div class="product-card-price"><div class="price" data-price="1.499,00 TL">
        <span class="price-value">1.499</span><span class="price-currency">TL</span></div></div>
    </div>
  </a>
</div>
<div class="product-card shopier--product-card product-card-store">
  <a  href="https://www.shopier.com/UmeraDesign/51254657" data-back-id="51254657">
    <img src="https://cdn.shopier.app/pictures_mid/B.jpeg" alt="Mızmız Ördek">
    <div class="product-card-badges"><span class="badge">Tükendi</span></div>
    <div class="product-card-price"><div class="price" data-price="599,50 TL"></div></div>
  </a>
</div>`;

test('vitrin sayfasından ürünler çıkarılır', () => {
  const u = magazayiAyristir(HTML, 'UmeraDesign');
  assert.equal(u.length, 2, 'gizli placeholder kart ürün sayılmamalı');
  assert.equal(u[0].name, 'Umera Curve & Masa Lambası', 'HTML varlığı çözülmeli');
  assert.equal(u[0].price, 1499, 'binlik ayraçlı fiyat doğru okunmalı');
  assert.equal(u[0].image, 'https://cdn.shopier.app/pictures_mid/A.jpeg');
  assert.equal(u[0].shopierUrl, 'https://www.shopier.com/UmeraDesign/51324068');
  assert.equal(u[0].kaynak, 'shopier');
  assert.equal(u[0].id, 'shopier:51324068', 'Sheets UUID’leriyle çakışmasın diye önekli');
});

test('kuruşlu fiyat korunur', () => {
  const u = magazayiAyristir(HTML, 'UmeraDesign');
  assert.equal(u[1].price, 599.5, 'gösterilen tutar Shopier’de ödenenle aynı olmalı');
  assert.equal(u[1].fiyatBilinmiyor, false);
});

test('tükenen ürün stok sıfır gelir', () => {
  const u = magazayiAyristir(HTML, 'UmeraDesign');
  assert.equal(u[0].stock, 1, 'Yeni rozeti tükendi sayılmamalı');
  assert.equal(u[1].stock, 0);
});

test('bozuk ya da boş girdi çökertmez', () => {
  assert.deepEqual(magazayiAyristir('', 'UmeraDesign'), []);
  assert.deepEqual(magazayiAyristir(HTML, ''), []);
  assert.deepEqual(magazayiAyristir('<div>hiç ürün yok</div>', 'UmeraDesign'), []);
  // Şablon değişirse sessizce boş dönmeli; site kendi ürünleriyle çalışsın.
  assert.deepEqual(magazayiAyristir('<div class="urun-karti">x</div>', 'UmeraDesign'), []);
});

test('aynı ürün iki kez listelenmez', () => {
  const u = magazayiAyristir(HTML + HTML, 'UmeraDesign');
  assert.equal(u.length, 2);
});

test('adı olmayan kart atlanır', () => {
  const eksik = `<div class="product-card shopier--product-card">
    <a href="https://www.shopier.com/UmeraDesign/1"><div class="product-card-price"><div data-price="10,00 TL"></div></div></a></div>`;
  assert.deepEqual(magazayiAyristir(eksik, 'UmeraDesign'), []);
});

test('mağaza adı ortam değişkeni yoksa varsayılana düşer', () => {
  /* Ortam değişkeni eklemeyi unutunca katalog sessizce boş kalıyordu.
     Depo tek mağazaya ait ve vitrin adresi herkese açık olduğu için
     varsayılan kodda; tanımlıysa ortam değişkeni kazanır. */
  const onceki = process.env.SHOPIER_MAGAZA;
  delete process.env.SHOPIER_MAGAZA;
  assert.equal(magazaAdi(), 'UmeraDesign');
  process.env.SHOPIER_MAGAZA = 'BaskaMagaza';
  assert.equal(magazaAdi(), 'BaskaMagaza');
  process.env.SHOPIER_MAGAZA = '/EgikCizgili/';
  assert.equal(magazaAdi(), 'EgikCizgili', 'baştaki/sondaki eğik çizgi temizlenmeli');
  if (onceki === undefined) delete process.env.SHOPIER_MAGAZA;
  else process.env.SHOPIER_MAGAZA = onceki;
});

test('depodaki anlık görüntü kullanılabilir durumda', async () => {
  /* API ve vitrin engelli olduğunda katalog bu dosyadan besleniyor; bozuk
     ya da boş bir yenileme commit'lenirse site sessizce ürünsüz kalırdı. */
  const { VITRIN, GUNCELLEME } = await import('../data/shopier-vitrin.js');
  assert.ok(Array.isArray(VITRIN) && VITRIN.length > 0, 'anlık görüntü boş');
  assert.ok(!Number.isNaN(Date.parse(GUNCELLEME)), 'geçerli bir tarih taşımalı');
  for (const u of VITRIN) {
    assert.match(u.id, /^shopier:\d+$/, `kimlik bozuk: ${u.id}`);
    assert.ok(u.name, 'adsız ürün var');
    assert.ok(u.shopierUrl.startsWith('https://www.shopier.com/'), `adres bozuk: ${u.shopierUrl}`);
    assert.equal(u.kaynak, 'shopier');
    assert.ok(u.price > 0 || u.fiyatBilinmiyor, `fiyatsız ürün: ${u.name}`);
  }
});

const KENDI = {
  id: 'uuid-1', name: 'Aura Trio', category: 'Aydınlatma', price: 1599, stock: 3,
  image: 'a.jpg', images: [{ url: 'a.jpg', etiket: 'Beyaz' }, { url: 'b.jpg', etiket: 'Siyah' }],
  description: 'Üç parçalı set.', active: true, minAdet: 1,
};
const SHOPIER = {
  id: 'shopier:9', kaynak: 'shopier', shopierUrl: 'https://www.shopier.com/UmeraDesign/9',
  name: 'Aura Trio', category: 'Shopier', price: 1599, stock: 1,
  image: 's.jpg', images: [{ url: 's.jpg', etiket: '' }], description: '', minAdet: 1,
};

test('aynı ürün iki kez listelenmez, ödeme Shopier’e gider', () => {
  /* Satıcı ürünlerini hem Sheets’e hem Shopier’e girmiş; ham birleştirmede
     her ürün iki kez çıkıyor ve aynı ürün iki kanaldan satılabiliyordu. */
  const b = katalogBirlestir([KENDI], [SHOPIER]);
  assert.equal(b.length, 1, 'çakışan ürün tekilleşmeli');
  assert.equal(b[0].kaynak, 'shopier', 'ödeme Shopier’de yapılmalı');
  assert.equal(b[0].shopierUrl, SHOPIER.shopierUrl);
});

test('birleşimde kendi içeriğimiz korunur', () => {
  // Shopier vitrini açıklama ve çoklu görsel vermiyor; onlar kaybolmamalı.
  const b = katalogBirlestir([KENDI], [SHOPIER]);
  assert.equal(b[0].description, 'Üç parçalı set.');
  assert.equal(b[0].images.length, 2);
  assert.equal(b[0].images[1].etiket, 'Siyah');
  assert.equal(b[0].category, 'Aydınlatma', 'kendi kategorimiz "Shopier"e yeğlenir');
});

test('eşleşmede ad karşılaştırması büyük/küçük harf ve boşluğa takılmaz', () => {
  const b = katalogBirlestir(
    [{ ...KENDI, name: '  AURA   trio ' }],
    [SHOPIER],
  );
  assert.equal(b.length, 1);
});

test('farklı ürünler birleştirilmez', () => {
  /* Gevşek eşleştirme (içeriyor) yanlış ürünleri birleştirirdi; yalnızca
     tam ad eşitliği kabul ediliyor. */
  const b = katalogBirlestir([{ ...KENDI, name: 'Aura' }], [SHOPIER]);
  assert.equal(b.length, 2, '"Aura" ile "Aura Trio" aynı ürün değil');
});

test('Shopier’de karşılığı olmayan ürün sepet akışında kalır', () => {
  const tek = { ...KENDI, id: 'uuid-2', name: 'Sadece Sitede' };
  const b = katalogBirlestir([tek], [SHOPIER]);
  assert.equal(b.length, 2);
  const kalan = b.find(u => u.name === 'Sadece Sitede');
  assert.notEqual(kalan.kaynak, 'shopier', 'sepete eklenebilmeli');
});

test('boş girdilerde çökmez', () => {
  assert.deepEqual(katalogBirlestir([], []), []);
  assert.equal(katalogBirlestir([KENDI], []).length, 1);
  assert.equal(katalogBirlestir([], [SHOPIER]).length, 1);
  assert.equal(katalogBirlestir().length, 0);
});
