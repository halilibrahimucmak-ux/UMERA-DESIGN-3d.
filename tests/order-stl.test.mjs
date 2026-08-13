import test from 'node:test';
import assert from 'node:assert/strict';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createOrderStl } from '../lib/order-stl.js';

const order = {
  orderNo: 'UM-TEST/STL',
  configurations: [{
    quantity: 1,
    geoSurum: '2.0',
    config: {
      paket: 'set', duyTipi: 'E27', profil: 'duz', altCap: 100, ustCap: 80,
      yukseklik: 90, bel: 0, desen: 'duz', nervurSayisi: 12, derinlik: 1,
      burgu: 0, dalgaSayisi: 4, cidar: 1.2, malzeme: 'PLA', renk: 'Kemik Beyazı',
      montaj: 'boyun', bogazCap: 41, boyunH: 12, kolSayisi: 4,
      kolKalinlik: 4.2, kelvin: 2700, adet: 1
    }
  }]
};

test('sipariş tasarımından geçerli ikili STL üretir', () => {
  const result = createOrderStl(order, 0);
  const view = new DataView(result.stl);
  const triangleCount = view.getUint32(80, true);
  assert.ok(triangleCount > 0);
  assert.equal(result.stl.byteLength, 84 + triangleCount * 50);
  assert.equal(result.fileName, 'UM-TEST-STL-abajur-1-E27.stl');
  assert.equal(result.isEmri.tablayaSigar, true);
  const geometry = new STLLoader().parse(result.stl);
  geometry.computeBoundingBox();
  assert.ok(geometry.attributes.position.count > 0);
  assert.ok(geometry.boundingBox.max.z > geometry.boundingBox.min.z);
});

test('siparişte olmayan tasarım indeksini reddeder', () => {
  assert.throws(() => createOrderStl(order, 9), /YAPILANDIRMA_BULUNAMADI/);
});
