import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import MaintenancePage from './MaintenancePage.jsx';
import { sikistir, boyutYazisi } from './lib/gorsel.js';
import { hukukMetinleri, firmaBilgisi, eksikBilgiVar } from './lib/hukuk.js';

// Konfigüratör three.js ile birlikte ~600 KB. Katalogla gelen ziyaretçiyi
// bekletmemek için yalnızca tasarım stüdyosu açıldığında indiriliyor.
const AbajurKonfigurator = lazy(() => import('./components/AbajurKonfigurator.jsx'));

const SITE_OPEN = import.meta.env.VITE_SITE_OPEN !== 'false';
const SEPET_ANAHTAR = 'umera.sepet.v2';
const SON_SIPARIS_ANAHTAR = 'umera.sonSiparis.v1';

const WA = import.meta.env.VITE_WHATSAPP_NUMBER || '';
const EMAIL = import.meta.env.VITE_COMPANY_EMAIL || 'siparis@umeradesign3d.com';
const CATS = ['Tümü', 'Figür & Oyuncak', 'Ev Dekorasyon', 'Masaüstü Aksesuar', 'Özel Tasarım', 'Sanat & Dekor', 'Diğer'];
const ORDER_STATUSES = ['Yeni', 'Ödeme Bekleniyor', 'Ödeme Alındı', 'Onaylandı', 'Hazırlanıyor', 'Kargoya Hazır', 'Kargolandı', 'Tamamlandı', 'İptal'];
const ODEME_BEKLEYEN = ['Yeni', 'Ödeme Bekleniyor'];
const CUSTOM_STATUSES = ['Yeni', 'İnceleniyor', 'Fiyat Verildi', 'Onaylandı', 'Üretimde', 'Tamamlandı', 'İptal'];
const DEMO = [
  {
    id: 'demo-1',
    name: 'Mafsallı Ejderha Figürü',
    category: 'Figür & Oyuncak',
    price: 350,
    stock: 8,
    image: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&q=80&w=900',
    description: 'Hareketli eklemli, dekoratif ve eğlenceli 3D baskı model.'
  },
  {
    id: 'demo-2',
    name: 'Geometrik Modern Saksı',
    category: 'Ev Dekorasyon',
    price: 180,
    stock: 12,
    image: 'https://images.unsplash.com/photo-1577900232427-18219b9166a0?auto=format&fit=crop&q=80&w=900',
    description: 'Modern masaüstü ve raf dekorasyonu için minimal tasarım.'
  },
  {
    id: 'demo-3',
    name: 'Kulaklık Standı',
    category: 'Masaüstü Aksesuar',
    price: 220,
    stock: 5,
    image: 'https://images.unsplash.com/photo-1599669500515-b3e1f5b08c90?auto=format&fit=crop&q=80&w=900',
    description: 'Çalışma ve oyun masanızı düzenleyen şık stand.'
  }
];

const money = value => new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0
}).format(Number(value) || 0);

function configId(config) {
  const text = JSON.stringify(config);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

const api = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'İşlem başarısız.');
  return data;
};

/* ------------------------------ BİLDİRİM ------------------------------
   alert() akışı kesiyor, üst üste geldiğinde kullanılamaz hale geliyor ve
   mobilde sayfayı dondurabiliyor. Yerine sağ üstte biriken, kendiliğinden
   kaybolan bildirimler. Modül düzeyinde abone tutuluyor ki alt bileşenler
   prop zinciri olmadan bildirim gönderebilsin. */
let toastAbone = null;

function bildir(mesaj, tip = 'bilgi') {
  if (toastAbone) toastAbone(String(mesaj), tip);
  else if (tip === 'hata') console.error(mesaj);
}

function ToastKapsayici() {
  const [liste, setListe] = useState([]);

  useEffect(() => {
    toastAbone = (mesaj, tip) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setListe(mevcut => [...mevcut.slice(-3), { id, mesaj, tip }]);
      setTimeout(
        () => setListe(mevcut => mevcut.filter(t => t.id !== id)),
        tip === 'hata' ? 7000 : 4000
      );
    };
    return () => { toastAbone = null; };
  }, []);

  if (!liste.length) return null;
  return (
    <div className="toastKapsayici" role="status" aria-live="polite">
      {liste.map(t => (
        <div key={t.id} className={`toast ${t.tip}`}>
          <span>{t.tip === 'hata' ? '⚠' : t.tip === 'basari' ? '✓' : 'i'}</span>
          <p>{t.mesaj}</p>
          <button type="button" onClick={() => setListe(m => m.filter(x => x.id !== t.id))} aria-label="Kapat">×</button>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('Tümü');
  // Sepet sekme yenilense de kaybolmasın — ziyaretçi tasarımını tekrar
  // kurmak zorunda kalmıyor.
  const [cart, setCart] = useState(() => {
    try {
      const kayit = JSON.parse(localStorage.getItem(SEPET_ANAHTAR) || '[]');
      return Array.isArray(kayit) ? kayit.filter(i => i?.product?.id && i.quantity > 0) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [custom, setCustom] = useState(false);
  const [designerOpen, setDesignerOpen] = useState(() => typeof window !== 'undefined' && window.location.hash.startsWith('#d='));
  const [adminLogin, setAdminLogin] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [login, setLogin] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [odeme, setOdeme] = useState(null);
  const [edit, setEdit] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [customUploading, setCustomUploading] = useState(false);
  const [customFiles, setCustomFiles] = useState([]);
  const [uploadDurum, setUploadDurum] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'Figür & Oyuncak',
    price: '',
    stock: '',
    image: '',
    description: ''
  });
  const [logoClicks, setLogoClicks] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [productDetail, setProductDetail] = useState(null);
  const [hukuk, setHukuk] = useState('');
  const firma = useMemo(() => firmaBilgisi(), []);
  // Son sipariş fişi — müşteri WhatsApp'a geçip dönmese bile ödeme
  // bilgilerini geri çağırabilsin diye saklanıyor.
  const [sonSiparis, setSonSiparis] = useState(() => {
    try {
      const kayit = JSON.parse(localStorage.getItem(SON_SIPARIS_ANAHTAR) || 'null');
      if (!kayit?.orderNo) return null;
      return Date.now() - (kayit.tarih || 0) < 21 * 864e5 ? kayit : null;
    } catch {
      return null;
    }
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api('/api/products');
      setProducts(data.length ? data : DEMO);
    } catch {
      setProducts(DEMO);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    const timer = setInterval(loadProducts, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SEPET_ANAHTAR, JSON.stringify(cart));
    } catch { /* özel sekme veya dolu depolama — sepet yalnızca bellekte kalır */ }
  }, [cart]);

  useEffect(() => {
    api('/api/auth-me')
      .then(data => setAdmin(Boolean(data?.authenticated)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (adminOpen && admin) loadDashboard();
  }, [adminOpen, admin]);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') {
        setSelectedImage(null);
        setProductDetail(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => products.filter(product => {
    const categoryMatch = cat === 'Tümü' || product.category === cat;
    const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
    return categoryMatch && text.includes(query.toLowerCase());
  }), [products, cat, query]);

  const featured = useMemo(() => products.filter(product => product.stock !== 0).slice(0, 3), [products]);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  function logoTap() {
    const now = Date.now();
    const next = [...logoClicks.filter(time => now - time < 3000), now];
    setLogoClicks(next);
    if (next.length >= 5) {
      setLogoClicks([]);
      setAdminLogin(true);
      setLoginError('');
    }
  }

  function add(product) {
    if (product.stock === 0) return;
    setCart(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) {
        return current.map(item => item.product.id === product.id
          ? { ...item, quantity: Math.min(item.quantity + 1, product.stock || 99) }
          : item);
      }
      return [...current, { product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function qty(id, delta) {
    setCart(current => current.map(item => item.product.id === id
      ? { ...item, quantity: Math.max(1, Math.min(item.product.stock || 99, item.quantity + delta)) }
      : item));
  }

  function remove(id) {
    setCart(current => current.filter(item => item.product.id !== id));
  }

  async function addAbajur(payload) {
    const quote = await api('/api/abajur-price', {
      method: 'POST',
      body: JSON.stringify({ config: payload.config })
    });
    // Fiyat sunucuda yeniden hesaplanır; beklenen alanlar yoksa sepete
    // yanlış fiyatla ürün eklemektense hata veriyoruz.
    if (!quote?.config || !Number.isFinite(Number(quote.birim))) {
      throw new Error('Fiyat doğrulanamadı. Lütfen birazdan tekrar dene.');
    }
    const quantity = Math.max(1, Math.min(20, Number(quote.config.adet) || 1));
    const product = {
      id: `abajur-${configId(quote.config)}`,
      type: 'abajur',
      name: quote.name,
      category: 'Abajur Tasarımı',
      price: quote.birim,
      stock: 20,
      image: '/logo-mark.webp',
      description: quote.summary,
      config: quote.config,
      geoSurum: quote.geoSurum
    };
    setCart(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) {
        return current.map(item => item.product.id === product.id
          ? { ...item, quantity: Math.min(20, item.quantity + quantity) }
          : item);
      }
      return [...current, { product, quantity }];
    });
    setCartOpen(true);
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!cart.length || submittingOrder) return;

    const formData = new FormData(event.currentTarget);
    const data = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      address: String(formData.get('address') || '').trim(),
      note: String(formData.get('note') || '').trim(),
      items: cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        type: item.product.type || 'catalog',
        config: item.product.config || undefined,
        geoSurum: item.product.geoSurum || undefined
      })),
      total
    };

    setSubmittingOrder(true);
    try {
      const response = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const orderNo = response.orderNo;
      const confirmedTotal = Number(response.total);
      const odeme = response.odeme || null;

      /* Ödeme bilgisi mesajın İÇİNE de konuyor. wa.me bağlantısı müşterinin
         kendi sohbetine yazdığı için bu metin müşterinin WhatsApp geçmişinde
         kalıcı olarak duruyor; fişi kapatsa bile IBAN'a ulaşabiliyor. */
      const lines = [
        'UMERA DESIGN 3D — YENİ SİPARİŞ',
        `Sipariş No: ${orderNo}`,
        `Müşteri: ${data.name}`,
        `Telefon: ${data.phone}`,
        data.email ? `E-posta: ${data.email}` : '',
        `Adres: ${data.address}`,
        data.note ? `Not: ${data.note}` : '',
        '',
        ...data.items.map(item => `${item.name} x${item.quantity} — ${money(item.price * item.quantity)}`),
        '',
        `TOPLAM: ${money(confirmedTotal)}`,
        ...(odeme ? [
          '',
          '— ÖDEME BİLGİLERİ —',
          odeme.banka ? `Banka: ${odeme.banka}` : '',
          `Alıcı: ${odeme.alici}`,
          `IBAN: ${odeme.iban}`,
          `Açıklama: ${orderNo}`,
          '',
          'Havale açıklamasına sipariş numarasını yazmayı unutmayın.'
        ] : [])
      ].filter(Boolean).join('\n');

      const fis = { text: lines, orderNo, odeme, tarih: Date.now(), toplam: confirmedTotal };
      setReceipt(fis);
      setCheckout(false);
      setCart([]);
      // Fiş saklanıyor: müşteri sekmeyi kapatsa veya WhatsApp'a geçip
      // dönmese bile ödeme bilgilerine tekrar ulaşabilsin.
      try { localStorage.setItem(SON_SIPARIS_ANAHTAR, JSON.stringify(fis)); } catch { /* yok sayılır */ }
      setSonSiparis(fis);
      bildir(`Siparişin alındı. Sipariş no: ${orderNo}`, 'basari');
    } catch (error) {
      bildir(`Sipariş kaydedilemedi: ${error.message} Sepetin duruyor, tekrar deneyebilirsin.`, 'hata');
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function customSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const phone = String(formData.get('phone') || '').trim();
    const email = String(formData.get('email') || '').trim();

    if (!phone && !email) {
      bildir('Telefon veya e-posta bilgilerinden en az birini gir.', 'hata');
      return;
    }
    if (!customFiles.length && !confirm('Fotoğraf eklemeden göndermek istiyor musunuz?')) return;

    setCustomUploading(true);
    try {
      const images = [];
      for (const [sira, file] of customFiles.entries()) {
        setUploadDurum(`Fotoğraf ${sira + 1}/${customFiles.length} hazırlanıyor…`);
        // Sıkıştırma tarayıcıda yapılıyor: telefon fotoğrafları 5-12 MB
        // olabiliyor ve Vercel'in 4.5 MB istek sınırını aşıyordu.
        const hazir = await sikistir(file);
        setUploadDurum(`Fotoğraf ${sira + 1}/${customFiles.length} yükleniyor…`);
        const uploaded = await api('/api/custom-upload', {
          method: 'POST',
          body: JSON.stringify({ name: hazir.name, type: hazir.type, data: hazir.dataUrl })
        });
        images.push(uploaded.url);
      }
      setUploadDurum('');

      const data = {
        name: String(formData.get('name') || '').trim(),
        phone,
        email,
        details: String(formData.get('details') || '').trim(),
        dimensions: String(formData.get('dimensions') || '').trim(),
        color: String(formData.get('color') || '').trim(),
        quantity: Number(formData.get('quantity') || 1),
        note: String(formData.get('note') || '').trim(),
        images
      };

      const response = await api('/api/custom-orders', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const text = [
        'UMERA DESIGN 3D — ÖZEL TASARIM TALEBİ',
        '',
        `Talep No: ${response.requestNo}`,
        `İsim: ${data.name}`,
        `Telefon: ${data.phone || '-'}`,
        `E-posta: ${data.email || '-'}`,
        `Ölçü: ${data.dimensions || '-'}`,
        `Renk: ${data.color || '-'}`,
        `Adet: ${data.quantity}`,
        `Detay: ${data.details}`
      ].join('\n');

      setCustom(false);
      setCustomFiles([]);
      bildir(`Talebin alındı. Talep no: ${response.requestNo}`, 'basari');
      if (WA) window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank');
    } catch (error) {
      bildir(error.message, 'hata');
    } finally {
      setUploadDurum('');
      setCustomUploading(false);
    }
  }

  function handleCustomFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 5) return bildir('En fazla 5 fotoğraf yükleyebilirsin.', 'hata');
    const bad = files.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (bad) return bildir('Sadece JPG, PNG veya WEBP yükleyebilirsin.', 'hata');
    // Boyut sınırı yok: büyük fotoğraflar gönderilmeden önce tarayıcıda
    // küçültülüyor. Kullanıcı telefonundaki fotoğrafı olduğu gibi seçebilir.
    setCustomFiles(files);
  }

  function removeCustomFile(name) {
    setCustomFiles(files => files.filter(file => file.name !== name));
  }

  async function doLogin(event) {
    event.preventDefault();
    setLoginError('');
    try {
      await api('/api/auth-login', { method: 'POST', body: JSON.stringify(login) });
      setAdmin(true);
      setAdminLogin(false);
      setDesignerOpen(false);
      setAdminOpen(true);
      setLogin({ username: '', password: '' });
    } catch (error) {
      setLoginError(error.message);
    }
  }

  async function logout() {
    await api('/api/auth-logout', { method: 'POST' }).catch(() => {});
    setAdmin(false);
    setAdminOpen(false);
  }

  async function loadDashboard() {
    try {
      const data = await api('/api/dashboard');
      setStats(data.stats);
      setOrders(data.orders);
      setCustomOrders(data.customOrders || []);
      setOdeme(data.odeme || null);
    } catch (error) {
      if (error.message.includes('Yetkisiz')) {
        setAdmin(false);
        setAdminOpen(false);
      }
    }
  }

  function waPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('90')) return digits;
    if (digits.startsWith('0')) return `90${digits.slice(1)}`;
    return digits;
  }

  function statusMessage(order, status) {
    const messages = {
      Kargolandı: `Merhaba ${order.name},\n\nUMERA Design 3D siparişiniz (${order.orderNo}) kargoya verilmiştir.\n\nSiparişiniz: ${order.items}\nToplam: ${money(order.total)}\n\nÜrününüzü güzel günlerde kullanmanızı dileriz.`,
      Tamamlandı: `Merhaba ${order.name},\n\n${order.orderNo} numaralı UMERA Design 3D siparişiniz tamamlandı. Bizi tercih ettiğiniz için teşekkür ederiz.`
    };
    return `${messages[status] || `Merhaba ${order.name}, ${order.orderNo} numaralı siparişinizin durumu “${status}” olarak güncellendi.`}\n\nUMERA Design 3D\nHayal Et. Tasarla. Gerçekleştir.`;
  }

  async function updateOrder(order, status) {
    if (order.status === status) return;
    try {
      const response = await api('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ orderNo: order.orderNo, status })
      });
      setOrders(items => items.map(item => item.orderNo === order.orderNo ? { ...item, status } : item));
      const notification = response.notification;
      if (notification?.reason === 'status-not-notifiable') return bildir('Durum güncellendi. “Yeni” durumu için müşteri bildirimi gönderilmez.');
      const delivered = notification?.channels?.filter(item => item.sent).map(item => item.channel === 'whatsapp' ? 'WhatsApp' : 'e-posta') || [];
      if (delivered.length) return bildir(`Durum güncellendi. Müşteriye ${delivered.join(' ve ')} bildirimi gönderildi.`, 'basari');
      if (notification?.fallbackUrl) {
        window.open(notification.fallbackUrl, '_blank', 'noopener,noreferrer');
        return bildir('Durum güncellendi. Otomatik bildirim servisi bağlı değil; müşterinin hazır WhatsApp mesajı açıldı, yalnızca Gönder’e bas.');
      }
      bildir('Durum güncellendi; müşterinin iletişim bilgisi olmadığı için bildirim gönderilemedi.', 'hata');
    } catch (error) {
      bildir(error.message, 'hata');
    }
  }

  function notifyOrder(order) {
    const phone = waPhone(order.phone);
    if (!phone) return bildir('Müşterinin telefon numarası bulunamadı.', 'hata');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(statusMessage(order, order.status))}`, '_blank', 'noopener,noreferrer');
  }

  function newProduct() {
    setEdit(null);
    setForm({ name: '', category: 'Figür & Oyuncak', price: '', stock: '', image: '', description: '' });
  }

  function editProduct(product) {
    setEdit(product.id);
    setForm({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      image: product.image,
      description: product.description || ''
    });
  }

  async function saveProduct(event) {
    event.preventDefault();
    try {
      const body = { ...form, price: Number(form.price), stock: Number(form.stock) };
      await api('/api/products', {
        method: edit ? 'PUT' : 'POST',
        body: JSON.stringify(edit ? { id: edit, ...body } : body)
      });
      await loadProducts();
      newProduct();
      bildir('Ürün kaydedildi.', 'basari');
    } catch (error) {
      bildir(error.message, 'hata');
    }
  }

  async function delProduct(id) {
    if (!confirm('Bu ürünü kaldırmak istediğinize emin misiniz?')) return;
    try {
      await api('/api/products', { method: 'DELETE', body: JSON.stringify({ id }) });
      await loadProducts();
    } catch (error) {
      bildir(error.message, 'hata');
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return bildir('JPG, PNG veya WEBP görsel seç.', 'hata');
    }

    setImageUploading(true);
    try {
      const hazir = await sikistir(file, { maksKenar: 1600, hedefBayt: 600_000 });
      const response = await api('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ name: hazir.name, type: hazir.type, data: hazir.dataUrl })
      });
      setForm(current => ({ ...current, image: response.url }));
      bildir(
        hazir.sonrakiBayt < hazir.oncekiBayt
          ? `Görsel yüklendi (${boyutYazisi(hazir.oncekiBayt)} → ${boyutYazisi(hazir.sonrakiBayt)}).`
          : 'Görsel yüklendi.',
        'basari'
      );
    } catch (error) {
      bildir(error.message, 'hata');
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="app">
      <ToastKapsayici />
      <div className="glow glow1" />
      <div className="glow glow2" />

      {sonSiparis && !receipt && (
        <div className="sonSiparisSerit">
          <span>
            <b>{sonSiparis.orderNo}</b> numaralı siparişin
            {sonSiparis.odeme ? ' — ödeme bilgilerin hazır' : ' kaydedildi'}
          </span>
          <button type="button" onClick={() => setReceipt(sonSiparis)}>
            {sonSiparis.odeme ? 'Ödeme bilgilerini aç' : 'Fişi aç'}
          </button>
          <button
            type="button"
            className="kapat"
            aria-label="Gizle"
            onClick={() => {
              setSonSiparis(null);
              try { localStorage.removeItem(SON_SIPARIS_ANAHTAR); } catch { /* yok sayılır */ }
            }}
          >
            ×
          </button>
        </div>
      )}

      <header className="header">
        <div className="wrap nav">
          <button className="brand" onClick={logoTap} aria-label="UMERA Design 3D ana sayfa">
            <img src="/logo-mark.webp" alt="" width="58" height="58" />
            <div><b>UMERA</b><span>DESIGN 3D</span></div>
          </button>
          <nav aria-label="Ana menü">
            <button className={`navbtn ${!adminOpen && !designerOpen ? 'active' : ''}`} onClick={() => { setAdminOpen(false); setDesignerOpen(false); }}>Katalog</button>
            <button className={`navbtn lampNav ${designerOpen ? 'active' : ''}`} onClick={() => { setAdminOpen(false); setDesignerOpen(true); }}>Abajur Tasarla</button>
            <button className="navbtn" onClick={() => setCustom(true)}>Özel Tasarım</button>
            <button className="cartbtn" onClick={() => setCartOpen(true)}>Sepet <i>{count}</i></button>
            {admin && <button className="adminbtn" onClick={() => { setDesignerOpen(false); setAdminOpen(true); }}>Admin</button>}
          </nav>
        </div>
      </header>

      {designerOpen && !adminOpen ? (
        <main className="designerPage">
          <div className="designerTop wrap">
            <div><div className="eyebrow">CANLI 3D ABAJUR STÜDYOSU</div><h1>Işığını kendin tasarla.</h1><p>Formu, ölçüyü, yüzeyi, rengi ve duy setini seç; fiyatı anında gör ve tasarımını sepete ekle.</p></div>
            <button className="ghost" onClick={() => setDesignerOpen(false)}>← Kataloğa Dön</button>
          </div>
          <div className="abajurStudio">
            <Suspense fallback={<div className="studioYukleniyor"><span /><b>3D tasarım stüdyosu yükleniyor…</b><small>İlk açılışta birkaç saniye sürebilir.</small></div>}>
              <AbajurKonfigurator
                onAddToCart={addAbajur}
                baseUrl={typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''}
                fiyatUrl="/api/abajur-price"
                stlIndirme="kapali"
                filigran="UMERA DESIGN 3D"
                yoneticiPaneli={admin}
                onBildirim={mesaj => bildir(mesaj, 'basari')}
              />
            </Suspense>
          </div>
        </main>
      ) : !adminOpen ? (
        <main>
          <section className="hero wrap">
            <div className="heroCopy">
              <div className="eyebrow">3D TASARIM • ÜRETİM • KİŞİSELLEŞTİRME</div>
              <h1>Hayal Et.<br /><em>Tasarla.</em><br />Gerçekleştir.</h1>
              <p>Modern ve kişiye özel 3D baskı ürünlerini keşfet. Hazır koleksiyondan seç veya fotoğrafını gönder; birlikte gerçeğe dönüştürelim.</p>
              <div className="heroActions">
                <button className="primary" onClick={() => setDesignerOpen(true)}>Abajurunu Tasarla <span>→</span></button>
                <button className="ghost" onClick={() => setCustom(true)}>Özel Tasarım İste</button>
              </div>
              <div className="heroProof"><span>✓ Sipariş numarasıyla takip</span><span>✓ Türkiye geneli gönderim</span></div>
            </div>
            <div className="heroVisual">
              <picture>
                <source srcSet="/logo-hero.webp" type="image/webp" />
                <img src="/logo-transparent.png" alt="UMERA Design 3D logosu" width="560" height="560" fetchPriority="high" />
              </picture>
            </div>
          </section>

          <TrustStrip />

          <section className="lampPromo wrap">
            <div className="lampPromoVisual" aria-hidden="true"><span /><i /></div>
            <div><div className="eyebrow">YENİ · CANLI 3D TASARIM</div><h2>Hazır bir abajur seçme.<br /><em>Kendininkini oluştur.</em></h2><p>Profil, çap, yükseklik, desen, malzeme ve renk seçeneklerini gerçek zamanlı 3D önizlemede birleştir. Üretime uygun fiyatı görüp tek adımda siparişe dönüştür.</p><div className="lampPromoFacts"><span>Canlı 3D önizleme</span><span>Sunucuda doğrulanan fiyat</span><span>E14 / E27 seçenekleri</span></div><button className="primary" onClick={() => setDesignerOpen(true)}>Tasarım Stüdyosunu Aç →</button></div>
          </section>

          <section id="featured" className="wrap featuredSection">
            <SectionTitle eyebrow="ÇOK TERCİH EDİLENLER" title={<>İlk bakışta <em>öne çıkanlar.</em></>} text="Popüler tasarımları incele, sepete ekle ve siparişini dakikalar içinde oluştur." />
            {loading ? <SkeletonGrid adet={3} sinif="featuredGrid" /> : (
              <div className="featuredGrid">
                {(featured.length ? featured : DEMO).map(product => (
                  <ProductCard key={`featured-${product.id}`} product={product} onAdd={add} onDetail={setProductDetail} onImage={setSelectedImage} featured />
                ))}
              </div>
            )}
          </section>

          <section id="catalog" className="wrap catalog">
            <div className="sectionHead">
              <SectionTitle eyebrow="UMERA KOLEKSİYONU" title={<>Sen seç, biz <em>üretelim.</em></>} text="Renk ve ölçü seçenekleri için ürün detayını inceleyebilir veya bize doğrudan yazabilirsin." />
              <button className="refresh" onClick={loadProducts}>↻ Güncelle</button>
            </div>
            <div className="tools">
              <div className="search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ürün ara..." aria-label="Ürün ara" /></div>
              <div className="chips">{CATS.map(category => <button key={category} className={cat === category ? 'chip active' : 'chip'} onClick={() => setCat(category)}>{category}</button>)}</div>
            </div>
            {loading ? <SkeletonGrid adet={6} sinif="grid" /> : filtered.length ? (
              <div className="grid">
                {filtered.map(product => <ProductCard key={product.id} product={product} onAdd={add} onDetail={setProductDetail} onImage={setSelectedImage} />)}
              </div>
            ) : <div className="empty">Aradığın ürünü bulamadık.</div>}
          </section>

          <ProcessSection onStart={() => setCustom(true)} />

          <section className="customBanner wrap">
            <div>
              <div className="eyebrow">SANA ÖZEL</div>
              <h2>Aklındaki model hazır değil mi?</h2>
              <p>Fikrini, fotoğrafını veya ölçülerini gönder. Talebini inceleyip teklif ve üretim süreci için seninle iletişime geçelim.</p>
            </div>
            <button className="primary" onClick={() => setCustom(true)}>Fotoğrafını Gönder →</button>
          </section>

          <FAQSection />
        </main>
      ) : (
        <AdminPanel
          stats={stats}
          orders={orders}
          customOrders={customOrders}
          odeme={odeme}
          products={products}
          form={form}
          setForm={setForm}
          edit={edit}
          newProduct={newProduct}
          editProduct={editProduct}
          saveProduct={saveProduct}
          delProduct={delProduct}
          uploadImage={uploadImage}
          imageUploading={imageUploading}
          loadDashboard={loadDashboard}
          logout={logout}
          updateOrder={updateOrder}
          notifyOrder={notifyOrder}
        />
      )}

      <footer className="footer">
        <div className="wrap footerGrid">
          <div className="footerBrand"><img src="/logo-mark.webp" alt="UMERA Design 3D" width="90" height="90" /><p>Hayal Et, Tasarla, Gerçekleştir.</p></div>
          <div><b>Sipariş ve destek</b><span>{EMAIL}</span>{WA && <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer">WhatsApp ile iletişim</a>}<span>Türkiye geneli güvenli gönderim</span></div>
          <div><b>Üretim bilgisi</b><span>Ürünler stok ve sipariş durumuna göre hazırlanır.</span><span>Tahmini üretim süresi ürün ve adet bazında teyit edilir.</span></div>
          <div><b>Bilgilendirme</b>{HUKUK.map(b => <a key={b.id} href="#" onClick={event => { event.preventDefault(); setHukuk(b.id); }}>{b.baslik}</a>)}</div>
          <div><b>Resmî Web Sitesi</b><span>© 2026 UMERA Design 3D. Tüm hakları saklıdır.</span><span>Marka, logo, tasarım, metin ve görseller izinsiz kopyalanamaz veya ticari amaçla kullanılamaz.</span></div>
        </div>
        <div className="wrap footerYasal">
          <span>{firma.unvan}</span>
          <span>{firma.adres}</span>
          <span>{firma.vergi}</span>
          {firma.mersis && <span>MERSİS: {firma.mersis}</span>}
        </div>
      </footer>

      {WA && <a className="whatsappFloat" href={`https://wa.me/${WA}?text=${encodeURIComponent('Merhaba, UMERA Design 3D ürünleri hakkında bilgi almak istiyorum.')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp ile iletişim"><span>WhatsApp</span><b>✆</b></a>}

      {hukuk && <HukukModal acikId={hukuk} close={() => setHukuk('')} />}

      {selectedImage && <ImageLightbox image={selectedImage} close={() => setSelectedImage(null)} />}

      {productDetail && (
        <Modal title="Ürün Detayı" close={() => setProductDetail(null)} wide>
          <div className="productDetail">
            <img src={productDetail.image || '/logo-hero.webp'} alt={productDetail.name} />
            <div>
              <span className="productCategory">{productDetail.category}</span>
              <h2>{productDetail.name}</h2>
              <p>{productDetail.description}</p>
              <div className="detailFacts"><span>⏱ 2–5 iş günü*</span><span>⬡ PLA / PETG seçenekleri</span><span>🎨 Renk teyidi</span><span>📦 Güvenli paketleme</span></div>
              <div className="detailPrice"><strong>{money(productDetail.price)}</strong><small>*Üretim süresi adet ve modele göre teyit edilir.</small></div>
              <button className="primary full" disabled={productDetail.stock === 0} onClick={() => { add(productDetail); setProductDetail(null); }}>{productDetail.stock === 0 ? 'Tükendi' : 'Sepete Ekle'}</button>
            </div>
          </div>
        </Modal>
      )}

      {cartOpen && (
        <Modal title="Sepetiniz" close={() => setCartOpen(false)} wide>
          <div className="cartList">
            {cart.length ? cart.map(item => (
              <div className="cartItem" key={item.product.id}>
                <img src={item.product.image || '/logo-mark.webp'} alt={item.product.name} />
                <div><b>{item.product.name}</b>{item.product.type === 'abajur' && <small className="cartConfig">{item.product.description}</small>}<small>{money(item.product.price)}</small><div className="step"><button onClick={() => qty(item.product.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => qty(item.product.id, 1)}>+</button></div></div>
                <button className="remove" onClick={() => remove(item.product.id)}>×</button>
              </div>
            )) : <div className="empty">Sepetin boş.</div>}
          </div>
          {cart.length > 0 && <div className="cartTotal"><span>Toplam</span><strong>{money(total)}</strong><button className="primary full" onClick={() => { setCartOpen(false); setCheckout(true); }}>Sipariş Bilgilerini Gir</button></div>}
        </Modal>
      )}

      {checkout && (
        <Modal title="Sipariş Bilgileri" close={() => setCheckout(false)}>
          <form className="form" onSubmit={submitOrder}>
            <Field name="name" label="Ad Soyad *" required />
            <Field name="phone" label="Telefon *" required type="tel" placeholder="05xx xxx xx xx" />
            <Field name="email" label="E-posta" type="email" />
            <label>Adres *<textarea name="address" required rows="3" /></label>
            <label>Sipariş Notu<textarea name="note" rows="2" placeholder="Renk, teslimat veya ürün notu..." /></label>
            <label className="consent"><input type="checkbox" required /> <span><a href="#" onClick={event => { event.preventDefault(); setHukuk('mesafeli'); }}>Mesafeli Satış Sözleşmesi</a>, <a href="#" onClick={event => { event.preventDefault(); setHukuk('iade'); }}>İptal ve İade Koşulları</a> ve <a href="#" onClick={event => { event.preventDefault(); setHukuk('kvkk'); }}>KVKK Aydınlatma Metni</a>'ni okudum, kabul ediyorum.</span></label>
            <div className="notice">Sipariş önce sisteme kaydedilir ve size benzersiz bir sipariş numarası verilir. Ödeme bilgileri sipariş fişinde görünür.</div>
            <div className="notice uyari">Kişiye özel üretilen ürünlerde, üretim başladıktan sonra cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15/1-b). Üretim başlamadan önce siparişini ücretsiz iptal edebilirsin.</div>
            <button className="primary full" disabled={submittingOrder}>{submittingOrder ? 'Kaydediliyor...' : `Siparişi Oluştur — ${money(total)}`}</button>
            <small className="channelHint">Bir sonraki adımda ödeme bilgilerini göreceksin. Sipariş, sen bildirmeden de sistemimize kaydedilir.</small>
          </form>
        </Modal>
      )}

      {custom && (
        <Modal title="Özel Tasarım Talebi" close={() => { setCustom(false); setCustomFiles([]); }} wide>
          <form className="form" onSubmit={customSubmit}>
            <div className="customIntro"><b>Nasıl çalışır?</b><br />Fotoğrafını ve istediğin detayları gönder → talebini inceleyelim → fiyat teklifini iletelim → onayından sonra üretime başlayalım.</div>
            <Field name="name" label="Ad Soyad *" required />
            <div className="two"><Field name="phone" label="Telefon" type="tel" /><Field name="email" label="E-posta" type="email" /></div>
            <label>Ne tasarlayalım? *<textarea name="details" required rows="5" placeholder="Ürün, kullanım amacı, referans ve istediğiniz özellikler..." /></label>
            <div className="two"><Field name="dimensions" label="Ölçü / Boyut" placeholder="Örn. 180 × 80 × 60 mm" /><Field name="color" label="Renk / Malzeme" placeholder="Örn. Mat siyah PLA" /></div>
            <Field name="quantity" label="Adet" type="number" min="1" defaultValue="1" />
            <label>Fotoğraflar <span className="muted">(JPG, PNG, WEBP • en fazla 5 adet — büyük fotoğraflar otomatik küçültülür)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleCustomFiles} /></label>
            {customFiles.length > 0 && <div className="customFileList">{customFiles.map(file => <div className="customFile" key={file.name}><span>🖼️ {file.name}</span><button type="button" onClick={() => removeCustomFile(file.name)}>×</button></div>)}</div>}
            <label>Ek Not<textarea name="note" rows="2" placeholder="Teslim tarihi, özel istek veya başka notunuz..." /></label>
            <label className="consent"><input type="checkbox" required /> <span>İletişim ve tasarım bilgilerimin talebimin değerlendirilmesi amacıyla kaydedilmesini kabul ediyorum.</span></label>
            {customUploading && <div className="notice">{uploadDurum || 'Tasarım talebin oluşturuluyor…'}</div>}
            <button className="primary full" disabled={customUploading}>{customUploading ? 'Gönderiliyor...' : 'Özel Tasarım Talebini Gönder →'}</button>
          </form>
        </Modal>
      )}

      {receipt && (
        <Modal
          title="Siparişiniz Alındı"
          close={() => {
            if (receipt.odeme && !confirm('Ödeme bilgilerini kaydettiniz mi? Bu ekranı daha sonra sayfanın üstündeki bağlantıdan tekrar açabilirsiniz.')) return;
            setReceipt(null);
          }}
          wide
        >
          <div className="receipt">
            <div className="check">✓</div>
            <h3>Sipariş No: {receipt.orderNo}</h3>

            {receipt.odeme ? (
              <>
                <p className="receiptLead">
                  Siparişiniz kaydedildi. <b>Üretime başlamamız için ödemenizi bekliyoruz.</b>
                </p>
                <OdemeKarti odeme={receipt.odeme} />
              </>
            ) : (
              <p className="receiptLead">Siparişiniz kaydedildi. Ödeme bilgileri için sizinle iletişime geçeceğiz.</p>
            )}

            <div className="receiptAksiyon">
              {WA && (
                <button
                  className="primary"
                  onClick={() => {
                    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(receipt.text)}`, '_blank', 'noopener,noreferrer');
                    bildir('WhatsApp açıldı. Mesajı gönderdiğinde ödeme bilgileri sohbetinde kalır.', 'basari');
                  }}
                >
                  WhatsApp'tan bize bildir
                </button>
              )}
              <button
                className="ghost"
                onClick={() => window.open(`mailto:${EMAIL}?subject=${encodeURIComponent(`UMERA Design 3D - ${receipt.orderNo}`)}&body=${encodeURIComponent(receipt.text)}`, '_blank')}
              >
                E-posta ile bildir
              </button>
              <button
                className="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(receipt.text).then(
                    () => bildir('Sipariş ve ödeme bilgileri kopyalandı.', 'basari'),
                    () => bildir('Kopyalanamadı.', 'hata')
                  );
                }}
              >
                Tümünü kopyala
              </button>
            </div>

            {receipt.odeme && (
              <p className="receiptNot">
                WhatsApp mesajı ödeme bilgilerini de içerir; gönderdiğinizde IBAN kendi sohbet
                geçmişinizde kalır ve istediğiniz zaman ulaşabilirsiniz.
              </p>
            )}

            <details className="receiptDetay">
              <summary>Sipariş özetini gör</summary>
              <pre>{receipt.text}</pre>
            </details>
          </div>
        </Modal>
      )}

      {adminLogin && (
        <Modal title="Yetkili Girişi" close={() => setAdminLogin(false)}>
          <form className="form" onSubmit={doLogin}>
            <Field name="username" label="Kullanıcı adı" value={login.username} onChange={event => setLogin({ ...login, username: event.target.value })} required autoComplete="username" />
            <Field name="password" label="Şifre" type="password" value={login.password} onChange={event => setLogin({ ...login, password: event.target.value })} required autoComplete="current-password" />
            <div className="notice">Bu alan yalnızca yetkili yönetici içindir.</div>
            {loginError && <div className="error">{loginError}</div>}
            <button className="primary full">Giriş Yap</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/**
 * Havale/EFT kartı. Kritik ayrıntı açıklama satırı: gelen ödemeyi siparişle
 * eşleştirmenin tek yolu sipariş numarası olduğu için ayrıca vurgulanıyor
 * ve tek tıkla kopyalanabiliyor.
 */
function OdemeKarti({ odeme }) {
  const [kopyalanan, setKopyalanan] = useState('');

  function kopyala(anahtar, deger) {
    const yaz = navigator.clipboard?.writeText(String(deger));
    Promise.resolve(yaz).then(
      () => {
        setKopyalanan(anahtar);
        setTimeout(() => setKopyalanan(''), 1800);
      },
      () => bildir('Kopyalanamadı, elle seçebilirsin.', 'hata')
    );
  }

  const satirlar = [
    odeme.banka && ['banka', 'Banka', odeme.banka],
    ['alici', 'Alıcı', odeme.alici],
    ['iban', 'IBAN', odeme.iban],
    ['tutar', 'Tutar', money(odeme.tutar)]
  ].filter(Boolean);

  return (
    <div className="odemeKarti">
      <div className="odemeBas">
        <b>Havale / EFT ile ödeme</b>
        <span>Ödemen ulaştığında üretime başlıyoruz</span>
      </div>

      {satirlar.map(([anahtar, etiket, deger]) => (
        <div className="odemeSatir" key={anahtar}>
          <span>{etiket}</span>
          <b className={anahtar === 'iban' ? 'iban' : undefined}>{deger}</b>
          <button type="button" onClick={() => kopyala(anahtar, deger)}>
            {kopyalanan === anahtar ? '✓' : 'Kopyala'}
          </button>
        </div>
      ))}

      <div className="odemeAciklama">
        <div>
          <span>Açıklama alanına mutlaka yaz</span>
          <b>{odeme.aciklama}</b>
        </div>
        <button type="button" onClick={() => kopyala('aciklama', odeme.aciklama)}>
          {kopyalanan === 'aciklama' ? '✓ Kopyalandı' : 'Kopyala'}
        </button>
      </div>

      <p className="odemeNot">
        Ödemeni siparişinle bu numara üzerinden eşleştiriyoruz. Havaleyi yaptıktan sonra
        dekontunu WhatsApp'tan iletirsen onayı daha hızlı veririz.
      </p>
    </div>
  );
}

const HUKUK = hukukMetinleri();

/** Site altındaki hukuki metinler — tek modal, sol tarafta belge listesi. */
function HukukModal({ acikId, close }) {
  const [secili, setSecili] = useState(acikId || HUKUK[0].id);
  const belge = HUKUK.find(b => b.id === secili) || HUKUK[0];

  return (
    <Modal title="Bilgilendirme ve Sözleşmeler" close={close} wide>
      <div className="hukukKok">
        <nav className="hukukMenu">
          {HUKUK.map(b => (
            <button
              key={b.id}
              type="button"
              className={b.id === secili ? 'aktif' : ''}
              onClick={() => setSecili(b.id)}
            >
              {b.baslik}
            </button>
          ))}
        </nav>

        <article className="hukukIcerik">
          <h3>{belge.baslik}</h3>
          {belge.bolumler.map(bolum => (
            <section key={bolum.baslik} className={bolum.vurgu ? 'vurgu' : undefined}>
              <h4>{bolum.baslik}</h4>
              {bolum.paragraf && <p>{bolum.paragraf}</p>}
              {bolum.maddeler && (
                <ul>{bolum.maddeler.map(m => <li key={m}>{m}</li>)}</ul>
              )}
            </section>
          ))}
          <p className="hukukGuncelleme">Son güncelleme: {new Date().getFullYear()}</p>
        </article>
      </div>
    </Modal>
  );
}

function SkeletonGrid({ adet = 6, sinif = 'grid' }) {
  return (
    <div className={sinif} aria-hidden="true">
      {Array.from({ length: adet }, (_, i) => (
        <article className="card iskelet" key={i}>
          <div className="pic" />
          <div className="cardBody">
            <span className="iskeletSatir gen" />
            <span className="iskeletSatir" />
            <span className="iskeletSatir kisa" />
          </div>
        </article>
      ))}
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{text && <p className="sectionLead">{text}</p>}</div>;
}

function TrustStrip() {
  const items = [
    ['◇', 'Kişiye Özel Tasarım', 'Fotoğraf ve ölçünü gönder.'],
    ['⬡', 'Özenli 3D Baskı', 'Modele uygun üretim ayarları.'],
    ['✓', 'Sipariş Takibi', 'Sipariş numarasıyla kayıt.'],
    ['⌁', 'Hızlı İletişim', 'WhatsApp üzerinden destek.']
  ];
  return <section className="wrap trustStrip">{items.map(([icon, title, text]) => <div className="trustItem" key={title}><i>{icon}</i><div><b>{title}</b><span>{text}</span></div></div>)}</section>;
}

function ProductCard({ product, onAdd, onDetail, onImage, featured = false }) {
  return (
    <article className={featured ? 'card featuredCard' : 'card'}>
      <div className="pic">
        <img src={product.image || '/logo-hero.webp'} alt={product.name} loading={featured ? 'eager' : 'lazy'} onClick={() => onImage({ url: product.image || '/logo-hero.webp', name: product.name })} role="button" tabIndex="0" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onImage({ url: product.image || '/logo-hero.webp', name: product.name }); }} />
        <span>{product.category}</span>
        {product.stock === 0 && <b className="sold">Tükendi</b>}
      </div>
      <div className="cardBody">
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="productMeta"><span>⏱ 2–5 iş günü*</span><span>⬡ Siparişe göre üretim</span></div>
        <div className="cardBottom"><strong>{money(product.price)}</strong><div><button className="detailBtn" onClick={() => onDetail(product)}>İncele</button><button onClick={() => onAdd(product)} disabled={product.stock === 0}>{product.stock === 0 ? 'Tükendi' : 'Sepete Ekle'}</button></div></div>
        <small>{product.stock > 0 ? `Mevcut stok: ${product.stock}` : 'Stokta yok'} · *Tahmini süre</small>
      </div>
    </article>
  );
}

function ProcessSection({ onStart }) {
  const steps = [
    ['01', 'Fotoğrafını gönder', 'Referans görselleri, ölçüyü ve istediğin özellikleri paylaş.'],
    ['02', 'Talebini inceleyelim', 'Üretilebilirlik, malzeme ve detayları değerlendirelim.'],
    ['03', 'Teklifi onayla', 'Fiyat ve tahmini üretim süresini sana iletelim.'],
    ['04', 'Üretime başlayalım', 'Onayından sonra ürünü özenle hazırlayalım.']
  ];
  return <section className="wrap processSection"><SectionTitle eyebrow="ÖZEL TASARIM SÜRECİ" title={<>Dört adımda <em>fikrinden ürüne.</em></>} text="Fiyatı belli olmayan özel talepler satış siparişlerinden ayrı takip edilir." /><div className="processGrid">{steps.map(([number, title, text]) => <div className="processCard" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></div>)}</div><button className="primary processCta" onClick={onStart}>Özel Tasarım Talebi Oluştur →</button></section>;
}

function FAQSection() {
  const faqs = [
    ['Abajur tasarımımı nasıl sipariş veririm?', 'Abajur Tasarla alanında ölçü, profil, desen, malzeme, renk ve duy tipini seç. Üretime uygun tasarımını sepete eklediğinde fiyat sunucuda yeniden doğrulanır ve normal sipariş akışına eklenir.'],
    ['Ürünler hazır stok mu?', 'Bazı ürünler stoktan, bazı ürünler sipariş üzerine üretilir. Güncel stok bilgisi ürün kartında görünür.'],
    ['Üretim ne kadar sürer?', 'Model, adet ve baskı süresine göre değişir. Standart ürünlerde tahmini süre çoğunlukla 2–5 iş günüdür; sipariş öncesinde teyit edilir.'],
    ['Renk veya boyut değiştirebilir miyim?', 'Uygun olan modellerde renk ve ölçü değişikliği yapılabilir. Ürün detayından veya WhatsApp üzerinden bilgi alabilirsin.'],
    ['Özel tasarım fiyatı nasıl belirlenir?', 'Gönderdiğin fotoğraf, ölçü, malzeme, baskı süresi ve adet değerlendirilerek teklif oluşturulur.']
  ];
  return <section className="wrap faqSection"><SectionTitle eyebrow="SIK SORULAN SORULAR" title={<>Siparişten önce <em>merak edilenler.</em></>} /><div className="faqGrid">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>;
}

function ImageLightbox({ image, close }) {
  return <div className="imageLightbox" onClick={close} role="dialog" aria-modal="true" aria-label="Ürün görseli"><button className="imageLightboxClose" onClick={close} aria-label="Kapat">×</button><img src={image.url} alt={image.name} onClick={event => event.stopPropagation()} /><div className="imageLightboxCaption">{image.name}</div></div>;
}

function Field({ label, name, ...props }) {
  return <label>{label}<input name={name} {...props} /></label>;
}

function Modal({ title, close, children, wide = false }) {
  return <div className="modalBack" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className={wide ? 'modal wide' : 'modal'}><div className="modalHead"><h3>{title}</h3><button type="button" onClick={close} aria-label="Kapat">×</button></div>{children}</div></div>;
}

function AdminPanel({ stats, orders, customOrders, odeme, products, form, setForm, edit, newProduct, editProduct, saveProduct, delProduct, uploadImage, imageUploading, loadDashboard, logout, updateOrder, notifyOrder }) {
  const [customFilter, setCustomFilter] = useState('Tümü');
  const [selectedCustom, setSelectedCustom] = useState(null);
  const [stlLoading, setStlLoading] = useState('');
  const [isEmri, setIsEmri] = useState(null);

  async function updateCustom(order, status, quote = order.quote) {
    try {
      const response = await api('/api/custom-orders', {
        method: 'PUT',
        body: JSON.stringify({ requestNo: order.requestNo, status, quote })
      });
      const updated = { ...order, status: response.order.status, quote: response.order.quote };
      setSelectedCustom(current => current?.requestNo === order.requestNo ? updated : current);
      await loadDashboard();
      bildir('Özel tasarım talebi güncellendi.', 'basari');
    } catch (error) {
      bildir(error.message, 'hata');
    }
  }

  /** Müşteriye IBAN + sipariş no + tutarı WhatsApp'tan gönderir. */
  function odemeBilgisiGonder(order) {
    if (!odeme) {
      return bildir('Ödeme bilgisi tanımlı değil. Vercel ortam değişkenlerine ODEME_IBAN ve ODEME_ALICI ekle.', 'hata');
    }
    const digits = String(order.phone || '').replace(/\D/g, '');
    if (!digits) return bildir('Müşterinin telefon numarası bulunamadı.', 'hata');
    const phone = digits.startsWith('90') ? digits : digits.startsWith('0') ? `90${digits.slice(1)}` : digits;
    const metin = [
      `Merhaba ${order.name},`,
      '',
      `${order.orderNo} numaralı siparişiniz için ödeme bilgileri:`,
      '',
      odeme.banka ? `Banka: ${odeme.banka}` : '',
      `Alıcı: ${odeme.alici}`,
      `IBAN: ${odeme.iban}`,
      `Tutar: ${money(order.total)}`,
      `Açıklama: ${order.orderNo}`,
      '',
      'Havale/EFT açıklamasına sipariş numaranızı yazmayı unutmayın.',
      'Ödemeniz ulaştığında üretime başlıyoruz.',
      '',
      'UMERA Design 3D'
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(metin)}`, '_blank', 'noopener,noreferrer');
  }

  function customWhatsApp(order) {
    const digits = String(order.phone || '').replace(/\D/g, '');
    if (!digits) return bildir('Müşterinin telefon numarası bulunamadı.', 'hata');
    const phone = digits.startsWith('90') ? digits : digits.startsWith('0') ? `90${digits.slice(1)}` : digits;
    const text = `Merhaba ${order.name},\n\nUMERA Design 3D özel tasarım talebiniz (${order.requestNo}) incelenmiştir.\nDurum: ${order.status}${order.quote ? `\nTeklif: ${money(order.quote)}` : ''}\n\nUMERA Design 3D`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function downloadAbajurProduction(order, _configuration, index) {
    const key = `${order.orderNo}-${index}`;
    if (stlLoading) return;
    setStlLoading(key);
    try {
      const response = await fetch('/api/order-stl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: order.orderNo, configurationIndex: index })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'STL oluşturulamadı.');
      }
      const blob = await response.blob();
      if (blob.size < 84) throw new Error('STL dosyası geçersiz veya boş.');
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] || `${order.orderNo}-abajur-${index + 1}.stl`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const ucgen = response.headers.get('X-Stl-Triangles');
      const kapali = response.headers.get('X-Stl-Watertight') === '1';
      bildir(
        `${fileName} indirildi · ${(blob.size / 1048576).toFixed(1)} MB · ${Number(ucgen || 0).toLocaleString('tr-TR')} üçgen` +
          (kapali ? ' · ağ kapalı' : ' · DİKKAT: ağ kapalı değil'),
        kapali ? 'basari' : 'hata'
      );
    } catch (error) {
      bildir(error.message, 'hata');
    } finally {
      setStlLoading('');
    }
  }

  /** Dosyayı indirmeden Bambu Studio ayarlarını ve kontrol sonuçlarını göster. */
  async function showIsEmri(order, index) {
    if (stlLoading) return;
    setStlLoading(`rapor-${order.orderNo}-${index}`);
    try {
      const data = await api('/api/order-stl', {
        method: 'POST',
        body: JSON.stringify({ orderNo: order.orderNo, configurationIndex: index, rapor: true })
      });
      setIsEmri({ orderNo: order.orderNo, index, ...data });
    } catch (error) {
      bildir(error.message, 'hata');
    } finally {
      setStlLoading('');
    }
  }

  const filteredCustom = customOrders.filter(order => customFilter === 'Tümü' || order.status === customFilter);

  return (
    <main className="adminPage wrap">
      <div className="adminTop"><div><div className="eyebrow">YÖNETİM MERKEZİ</div><h1>UMERA <em>Admin</em></h1><p>Ürünlerini, siparişlerini ve özel tasarım taleplerini tek yerden yönet.</p></div><div className="adminActions"><button className="ghost" onClick={loadDashboard}>↻ Yenile</button><button className="ghost" onClick={logout}>Çıkış</button></div></div>
      {eksikBilgiVar() && (
        <div className="odemeUyari kritik">
          ⚠ Hukuki metinlerde firma bilgileri eksik; müşteriye köşeli parantezli yer tutucular
          görünüyor. Vercel ortam değişkenlerine <code>VITE_FIRMA_UNVAN</code>,{' '}
          <code>VITE_FIRMA_ADRES</code>, <code>VITE_FIRMA_VERGI</code> ve <code>VITE_FIRMA_TEL</code>{' '}
          ekleyip yeniden dağıt. Metinler taslaktır, yayına almadan avukat kontrolünden geçir.
        </div>
      )}
      {!odeme && (
        <div className="odemeUyari">
          ⚠ Havale bilgisi tanımlı değil. Müşteriler sipariş fişinde IBAN göremiyor. Vercel ortam
          değişkenlerine <code>ODEME_IBAN</code> ve <code>ODEME_ALICI</code> ekle.
        </div>
      )}
      {odeme && !odeme.gecerli && (
        <div className="odemeUyari kritik">
          ⚠ <b>{odeme.iban}</b> geçerli bir TR IBAN değil (sağlama tutmuyor). Müşteriye yanlış hesap
          gösterilmemesi için ödeme kartı gizlendi. <code>ODEME_IBAN</code> değerini kontrol et.
        </div>
      )}
      <div className="stats">{[
        ['Toplam Ürün', products.length, '📦'],
        ['Toplam Sipariş', stats?.totalOrders ?? '—', '🧾'],
        ['Bu Ay', stats?.monthOrders ?? '—', '📅'],
        ['Toplam Ciro', stats ? money(stats.totalRevenue) : '—', '₺'],
        ['Bekleyen', stats?.pending ?? '—', '⏳'],
        ['Bekleyen Tahsilat', stats ? money(stats.bekleyenTahsilat || 0) : '—', '💳'],
        ['Özel Tasarım', customOrders.length, '🎨']
      ].map(item => <div className="stat" key={item[0]}><span>{item[2]}</span><small>{item[0]}</small><b>{item[1]}</b></div>)}</div>

      <div className="adminGrid">
        <section className="panel"><div className="panelHead"><div><b>Ürün Yönetimi</b><span>Google Sheets ile senkron</span></div><button className="primary" onClick={newProduct}>+ Yeni Ürün</button></div><div className="productAdmin">{products.map(product => <div className="pRow" key={product.id}><img src={product.image || '/logo-mark.webp'} alt="" /><div><b>{product.name}</b><span>{product.category} · {money(product.price)} · Stok {product.stock}</span></div><button onClick={() => editProduct(product)}>Düzenle</button><button className="danger" onClick={() => delProduct(product.id)}>Sil</button></div>)}</div></section>
        <section className="panel editor"><div className="panelHead"><div><b>{edit ? 'Ürünü Düzenle' : 'Yeni Ürün'}</b><span>Bilgileri girip kaydet</span></div></div><form className="form" onSubmit={saveProduct}><Field label="Ürün adı *" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /><label>Kategori<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{CATS.filter(item => item !== 'Tümü').map(category => <option key={category}>{category}</option>)}</select></label><div className="two"><Field label="Fiyat (TL) *" type="number" min="0" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} required /><Field label="Stok *" type="number" min="0" value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} required /></div><label>Ürün Görseli<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} /></label>{imageUploading && <div className="notice">Görsel yükleniyor...</div>}{form.image && <img className="preview" src={form.image} alt="Önizleme" />}<Field label="Görsel URL (opsiyonel)" value={form.image} onChange={event => setForm({ ...form, image: event.target.value })} /><label>Açıklama<textarea rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><div className="two"><button className="primary">{edit ? 'Değişiklikleri Kaydet' : 'Ürünü Yayınla'}</button><button type="button" className="ghost" onClick={newProduct}>Temizle</button></div></form></section>
      </div>

      <section className="panel orders"><div className="panelHead"><div><b>Sipariş Yönetimi</b><span>Durumu değiştirdiğinizde müşteriye otomatik bildirim gönderilir · sipariş tasarımları baskıya hazır STL olarak indirilir</span></div></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Müşteri</th><th>Ürünler</th><th>Tutar</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>{orders.length ? orders.map(order => <tr key={order.orderNo}><td><b>{order.orderNo}</b><small>{new Date(order.date).toLocaleString('tr-TR')}</small></td><td><b>{order.name}</b><small>{order.phone}</small>{order.email && <small>{order.email}</small>}<small>{order.address}</small></td><td>{order.items}{order.configurations?.length > 0 && <small className="productionBadge">◈ {order.configurations.length} STL üretime hazır</small>}</td><td><b>{money(order.total)}</b>{ODEME_BEKLEYEN.includes(order.status) && <small className="odemeBekliyor">Ödeme bekliyor</small>}</td><td><select className="statusSelect" value={order.status} onChange={event => updateOrder(order, event.target.value)}>{ORDER_STATUSES.map(status => <option key={status}>{status}</option>)}</select><small>Değişiklikte bildirim gider</small></td><td><div className="orderActions">{order.configurations?.map((configuration, index) => { const key = `${order.orderNo}-${index}`; return <div className="stlGrup" key={key}><button className="productionBtn" disabled={Boolean(stlLoading)} onClick={() => downloadAbajurProduction(order, configuration, index)}>{stlLoading === key ? 'STL hazırlanıyor…' : `⬇ Abajur ${index + 1} · Baskıya Hazır STL`}</button><button className="isEmriBtn" disabled={Boolean(stlLoading)} onClick={() => showIsEmri(order, index)}>{stlLoading === `rapor-${order.orderNo}-${index}` ? 'Hazırlanıyor…' : '⚙ İş emri'}</button></div>; })}{ODEME_BEKLEYEN.includes(order.status) && <button className="odemeBtn" onClick={() => odemeBilgisiGonder(order)}>₺ Ödeme bilgisi gönder</button>}<button className="shipBtn" onClick={() => notifyOrder(order)}>Müşteriye WhatsApp aç</button></div></td></tr>) : <tr><td colSpan="6" className="empty">Henüz sipariş yok.</td></tr>}</tbody></table></div></section>

      <section className="panel customOrdersAdmin"><div className="panelHead"><div><b>Özel Tasarım Talepleri</b><span>Google Sheets → CustomOrders · müşterilerin gönderdiği fotoğraflar ve talepler</span></div><div className="customFilters">{['Tümü', ...CUSTOM_STATUSES].map(status => <button key={status} className={customFilter === status ? 'chip active' : 'chip'} onClick={() => setCustomFilter(status)}>{status}</button>)}</div></div><div className="customCards">{filteredCustom.length ? filteredCustom.map(order => <article className="customOrderCard" key={order.requestNo} onClick={() => setSelectedCustom(order)}><div className="customOrderTop"><div><b>{order.requestNo}</b><small>{new Date(order.date).toLocaleString('tr-TR')}</small></div><span className="status">{order.status}</span></div><div className="customOrderBody"><div><b>{order.name}</b><small>{order.phone || order.email || 'İletişim yok'}</small><p>{order.details}</p><small>Ölçü: {order.dimensions || '-'} · Renk: {order.color || '-'} · Adet: {order.quantity}</small></div><div className="customThumbs">{order.images?.slice(0, 3).map((url, index) => <img key={url} src={url} alt={`Referans ${index + 1}`} />)}{order.images?.length > 3 && <span>+{order.images.length - 3}</span>}</div></div><div className="customOrderActions"><select className="statusSelect" value={order.status} onClick={event => event.stopPropagation()} onChange={event => { event.stopPropagation(); updateCustom(order, event.target.value); }}>{CUSTOM_STATUSES.map(status => <option key={status}>{status}</option>)}</select>{order.phone && <button className="ghost smallBtn" onClick={event => { event.stopPropagation(); customWhatsApp(order); }}>WhatsApp</button>}</div></article>) : <div className="empty">Bu filtrede özel tasarım talebi yok.</div>}</div></section>

      {isEmri && (
        <Modal title={`İş Emri · ${isEmri.orderNo} · Abajur ${isEmri.index + 1}`} close={() => setIsEmri(null)} wide>
          <div className="isEmriIcerik">
            <div className={isEmri.kapali ? 'isEmriDurum tamam' : 'isEmriDurum sorun'}>
              {isEmri.kapali
                ? '✓ Ağ kapalı (su geçirmez). Dilimleyicide onarım gerekmez.'
                : '⚠ Ağ kapalı değil. Basmadan önce modeli kontrol et.'}
            </div>

            {isEmri.isEmri.uyarilar?.length > 0 && (
              <div className="isEmriUyari">
                {isEmri.isEmri.uyarilar.map((u, i) => <p key={i}>⚠ {u}</p>)}
              </div>
            )}

            <div className="isEmriGrid">
              {[
                ['Dosya', isEmri.isEmri.dosya],
                ['Dış ölçü', isEmri.isEmri.olcu],
                ['Tablaya sığar', isEmri.isEmri.tablayaSigar ? 'Evet' : 'HAYIR — basma'],
                ['Ağırlık', isEmri.isEmri.tahminiAgirlik],
                ['Üçgen', Number(isEmri.ucgen).toLocaleString('tr-TR')],
                ['Malzeme', `${isEmri.isEmri.malzeme} · ${isEmri.isEmri.renk}`],
                ['Yönlendirme', isEmri.isEmri.yonlendirme],
                ['Sarkma', isEmri.isEmri.sarkma],
                ['İlk kat teması', isEmri.isEmri.ilkKatTemas],
                ['Montaj', isEmri.isEmri.montaj],
                ['Paket', isEmri.isEmri.paket],
                ['Çözünürlük', isEmri.isEmri.cozunurluk]
              ].map(([k, v]) => <div key={k}><b>{k}</b><span>{v}</span></div>)}
            </div>

            <h4>Bambu Studio ayarları</h4>
            <div className="isEmriGrid dilim">
              {Object.entries(isEmri.isEmri.dilimleyici).map(([k, v]) => (
                <div key={k}><b>{k}</b><span>{v}</span></div>
              ))}
            </div>

            <button
              className="ghost full"
              onClick={() => {
                const metin = JSON.stringify(isEmri.isEmri, null, 2);
                navigator.clipboard?.writeText(metin).then(
                  () => bildir('İş emri panoya kopyalandı.', 'basari'),
                  () => bildir('Kopyalanamadı.', 'hata')
                );
              }}
            >
              İş emrini kopyala
            </button>
          </div>
        </Modal>
      )}

      {selectedCustom && (
        <Modal title={`Özel Talep ${selectedCustom.requestNo}`} close={() => setSelectedCustom(null)} wide>
          <div className="customDetail">
            <div className="customDetailGrid"><div><b>Müşteri</b><span>{selectedCustom.name}</span></div><div><b>Telefon</b><span>{selectedCustom.phone || '-'}</span></div><div><b>E-posta</b><span>{selectedCustom.email || '-'}</span></div><div><b>Adet</b><span>{selectedCustom.quantity}</span></div><div><b>Ölçü</b><span>{selectedCustom.dimensions || '-'}</span></div><div><b>Renk / Malzeme</b><span>{selectedCustom.color || '-'}</span></div></div>
            <div className="customDetailText"><b>Proje Detayı</b><p>{selectedCustom.details}</p>{selectedCustom.note && <><b>Not</b><p>{selectedCustom.note}</p></>}</div>
            <div className="customImages">{selectedCustom.images?.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Özel tasarım ${index + 1}`} /></a>)}</div>
            <div className="two"><label>Durum<select value={selectedCustom.status} onChange={event => updateCustom(selectedCustom, event.target.value, selectedCustom.quote)}>{CUSTOM_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><Field label="Teklif (TL)" type="number" min="0" value={selectedCustom.quote || ''} onChange={event => setSelectedCustom({ ...selectedCustom, quote: event.target.value })} /></div>
            <button className="primary full" onClick={() => updateCustom(selectedCustom, selectedCustom.status, selectedCustom.quote)}>Değişiklikleri Kaydet</button>
            {selectedCustom.phone && <button className="ghost full" onClick={() => customWhatsApp(selectedCustom)}>WhatsApp ile Bilgilendir</button>}
          </div>
        </Modal>
      )}
    </main>
  );
}

// Kökü sakla: Vite sıcak yenilemede bu modülü tekrar çalıştırdığında aynı
// container için ikinci bir createRoot açılmasın.
const kap = document.getElementById('root');
const kok = (globalThis.__umeraKok ||= createRoot(kap));
kok.render(SITE_OPEN ? <App /> : <MaintenancePage />);
