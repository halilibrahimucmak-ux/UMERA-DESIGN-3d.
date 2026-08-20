import test from 'node:test';
import assert from 'node:assert/strict';

import { dogrulaKatalogKalemi, minSiparisAdedi } from '../lib/siparis-dogrula.js';

const urun = (ek = {}) => ({ id: 'p1', name: 'Toptan Magnet', price: 120, stock: 100, minAdet: 5, ...ek });

test('minimum adet bozuk değerlerde 1e düşer', () => {
  assert.equal(minSiparisAdedi({ minAdet: 5 }), 5);
  assert.equal(minSiparisAdedi({ minAdet: '5' }), 5);
  assert.equal(minSiparisAdedi({ minAdet: 5.9 }), 5, 'ondalık aşağı yuvarlanır');
  assert.equal(minSiparisAdedi({ minAdet: 0 }), 1);
  assert.equal(minSiparisAdedi({ minAdet: -3 }), 1);
  assert.equal(minSiparisAdedi({ minAdet: 'abc' }), 1);
  assert.equal(minSiparisAdedi({}), 1);
  assert.equal(minSiparisAdedi(undefined), 1);
  assert.equal(minSiparisAdedi({ minAdet: 99999 }), 999, 'üst sınır');
});

test('minimum adedin altındaki sipariş reddedilir', () => {
  for (const adet of [1, 2, 4]) {
    assert.throws(
      () => dogrulaKatalogKalemi(urun(), adet, true),
      (e) => e.message === 'MIN_ADET' && /en az 5 adet/.test(e.detay),
      `${adet} adet kabul edilmemeliydi`
    );
  }
});

test('minimum adet ve üzeri kabul edilir', () => {
  for (const adet of [5, 6, 100]) {
    assert.deepEqual(dogrulaKatalogKalemi(urun(), adet, true), { minAdet: 5 });
  }
});

test('minimum tanımlı değilse tek adet satılabilir', () => {
  assert.deepEqual(dogrulaKatalogKalemi(urun({ minAdet: 1 }), 1, true), { minAdet: 1 });
  assert.deepEqual(dogrulaKatalogKalemi(urun({ minAdet: undefined }), 1, true), { minAdet: 1 });
});

test('stok minimumun altına düşmüşse anlaşılır hata verir', () => {
  // "stok yetersiz" demek yanıltıcı olurdu: müşteri adedi düşürerek çözemez
  assert.throws(
    () => dogrulaKatalogKalemi(urun({ stock: 3 }), 5, true),
    (e) => e.message === 'MIN_ADET' && /stokta 3 adet kaldı/.test(e.detay)
  );
});

test('stok üstü sipariş reddedilir', () => {
  assert.throws(
    () => dogrulaKatalogKalemi(urun({ stock: 10 }), 11, true),
    /STOK_YETERSİZ/
  );
});

test('tükenmiş ürün reddedilir', () => {
  assert.throws(() => dogrulaKatalogKalemi(urun({ stock: 0 }), 5, true), /STOK_YOK/);
});

test('katalogda olmayan ürün reddedilir', () => {
  assert.throws(() => dogrulaKatalogKalemi(undefined, 1, true), /ÜRÜN_BULUNAMADI/);
  // katalog hiç okunamadıysa doğrulama atlanır (demo/çevrimdışı hâl)
  assert.deepEqual(dogrulaKatalogKalemi(undefined, 1, false), { minAdet: 1 });
});
