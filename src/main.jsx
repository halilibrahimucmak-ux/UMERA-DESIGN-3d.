import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import MaintenancePage from './MaintenancePage.jsx';

const SITE_OPEN = import.meta.env.VITE_SITE_OPEN === 'true';

const WA = import.meta.env.VITE_WHATSAPP_NUMBER || '';
const EMAIL = import.meta.env.VITE_COMPANY_EMAIL || 'siparis@umeradesign3d.com';
const CATS = ['Tümü', 'Figür & Oyuncak', 'Ev Dekorasyon', 'Masaüstü Aksesuar', 'Özel Tasarım', 'Sanat & Dekor', 'Diğer'];
const ORDER_STATUSES = ['Yeni', 'Onaylandı', 'Hazırlanıyor', 'Kargoya Hazır', 'Kargolandı', 'Tamamlandı', 'İptal'];
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

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'İşlem başarısız.');
  return data;
};

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('Tümü');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [custom, setCustom] = useState(false);
  const [adminLogin, setAdminLogin] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [login, setLogin] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [edit, setEdit] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [customUploading, setCustomUploading] = useState(false);
  const [customFiles, setCustomFiles] = useState([]);
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
    api('/api/auth-me').then(() => setAdmin(true)).catch(() => {});
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

  async function submitOrder(event) {
    event.preventDefault();
    if (!cart.length || submittingOrder) return;

    const formData = new FormData(event.currentTarget);
    const channel = event.nativeEvent?.submitter?.value || 'whatsapp';
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
        price: item.product.price
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
        `TOPLAM: ${money(total)}`
      ].filter(Boolean).join('\n');

      setReceipt({ text: lines, orderNo });
      setCheckout(false);
      setCart([]);

      if (channel === 'email') {
        window.open(`mailto:${EMAIL}?subject=${encodeURIComponent(`UMERA Design 3D - ${orderNo}`)}&body=${encodeURIComponent(lines)}`, '_blank');
      } else if (WA) {
        window.open(`https://wa.me/${WA}?text=${encodeURIComponent(lines)}`, '_blank');
      } else {
        window.open(`mailto:${EMAIL}?subject=${encodeURIComponent(`UMERA Design 3D - ${orderNo}`)}&body=${encodeURIComponent(lines)}`, '_blank');
      }
    } catch (error) {
      alert(`Sipariş kaydedilemedi: ${error.message}\nLütfen tekrar deneyin.`);
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
      alert('Telefon veya e-posta bilgilerinden en az birini girin.');
      return;
    }
    if (!customFiles.length && !confirm('Fotoğraf eklemeden göndermek istiyor musunuz?')) return;

    setCustomUploading(true);
    try {
      const images = [];
      for (const file of customFiles) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const uploaded = await api('/api/custom-upload', {
          method: 'POST',
          body: JSON.stringify({ name: file.name, type: file.type, data: dataUrl })
        });
        images.push(uploaded.url);
      }

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
      alert(`Talebiniz alındı. Talep No: ${response.requestNo}`);
      if (WA) window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank');
    } catch (error) {
      alert(error.message);
    } finally {
      setCustomUploading(false);
    }
  }

  function handleCustomFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 5) return alert('En fazla 5 fotoğraf yükleyebilirsiniz.');
    const tooBig = files.find(file => file.size > 3 * 1024 * 1024);
    if (tooBig) return alert(`${tooBig.name} 3 MB sınırını aşıyor.`);
    const bad = files.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (bad) return alert('Sadece JPG, PNG veya WEBP yükleyebilirsiniz.');
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

  async function updateOrder(order, status, notify = false) {
    try {
      const response = await api('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ orderNo: order.orderNo, status })
      });
      setOrders(items => items.map(item => item.orderNo === order.orderNo ? { ...item, status } : item));
      if (notify) {
        const phone = waPhone(response.order?.phone || order.phone);
        if (!phone) return alert('Müşterinin telefon numarası bulunamadı.');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(statusMessage({ ...order, ...response.order }, status))}`, '_blank');
      }
    } catch (error) {
      alert(error.message);
    }
  }

  function notifyShipped(order) {
    if (order.status === 'Kargolandı') {
      const phone = waPhone(order.phone);
      if (!phone) return alert('Müşterinin telefon numarası bulunamadı.');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(statusMessage(order, 'Kargolandı'))}`, '_blank');
      return;
    }
    updateOrder(order, 'Kargolandı', true);
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
      alert('Ürün kaydedildi.');
    } catch (error) {
      alert(error.message);
    }
  }

  async function delProduct(id) {
    if (!confirm('Bu ürünü kaldırmak istediğinize emin misiniz?')) return;
    try {
      await api('/api/products', { method: 'DELETE', body: JSON.stringify({ id }) });
      await loadProducts();
    } catch (error) {
      alert(error.message);
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return alert('JPG, PNG veya WEBP görsel seçin.');
    if (file.size > 3 * 1024 * 1024) return alert('Görsel 3 MB altında olmalı.');

    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await api('/api/upload', {
          method: 'POST',
          body: JSON.stringify({ name: file.name, type: file.type, data: reader.result })
        });
        setForm(current => ({ ...current, image: response.url }));
      } catch (error) {
        alert(error.message);
      } finally {
        setImageUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="app">
      <div className="glow glow1" />
      <div className="glow glow2" />

      <header className="header">
        <div className="wrap nav">
          <button className="brand" onClick={logoTap} aria-label="UMERA Design 3D ana sayfa">
            <img src="/logo-mark.webp" alt="" width="58" height="58" />
            <div><b>UMERA</b><span>DESIGN 3D</span></div>
          </button>
          <nav aria-label="Ana menü">
            <button className={`navbtn ${!adminOpen ? 'active' : ''}`} onClick={() => setAdminOpen(false)}>Katalog</button>
            <button className="navbtn" onClick={() => setCustom(true)}>Özel Tasarım</button>
            <button className="cartbtn" onClick={() => setCartOpen(true)}>Sepet <i>{count}</i></button>
            {admin && <button className="adminbtn" onClick={() => setAdminOpen(true)}>Admin</button>}
          </nav>
        </div>
      </header>

      {!adminOpen ? (
        <main>
          <section className="hero wrap">
            <div className="heroCopy">
              <div className="eyebrow">3D TASARIM • ÜRETİM • KİŞİSELLEŞTİRME</div>
              <h1>Hayal Et.<br /><em>Tasarla.</em><br />Gerçekleştir.</h1>
              <p>Modern ve kişiye özel 3D baskı ürünlerini keşfet. Hazır koleksiyondan seç veya fotoğrafını gönder; birlikte gerçeğe dönüştürelim.</p>
              <div className="heroActions">
                <button className="primary" onClick={() => document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' })}>En Çok Tercih Edilenler <span>→</span></button>
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

          <section id="featured" className="wrap featuredSection">
            <SectionTitle eyebrow="ÇOK TERCİH EDİLENLER" title={<>İlk bakışta <em>öne çıkanlar.</em></>} text="Popüler tasarımları incele, sepete ekle ve siparişini dakikalar içinde oluştur." />
            {loading ? <div className="empty">Ürünler yükleniyor...</div> : (
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
            {loading ? <div className="empty">Ürünler yükleniyor...</div> : filtered.length ? (
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
          notifyShipped={notifyShipped}
        />
      )}

      <footer className="footer">
        <div className="wrap footerGrid">
          <div className="footerBrand"><img src="/logo-mark.webp" alt="UMERA Design 3D" width="90" height="90" /><p>Hayal Et, Tasarla, Gerçekleştir.</p></div>
          <div><b>Sipariş ve destek</b><span>{EMAIL}</span>{WA && <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer">WhatsApp ile iletişim</a>}<span>Türkiye geneli güvenli gönderim</span></div>
          <div><b>Üretim bilgisi</b><span>Ürünler stok ve sipariş durumuna göre hazırlanır.</span><span>Tahmini üretim süresi ürün ve adet bazında teyit edilir.</span></div>
          <div><b>Resmî Web Sitesi</b><span>© 2026 UMERA Design 3D. Tüm hakları saklıdır.</span><span>Marka, logo, tasarım, metin ve görseller izinsiz kopyalanamaz veya ticari amaçla kullanılamaz.</span></div>
        </div>
      </footer>

      {WA && <a className="whatsappFloat" href={`https://wa.me/${WA}?text=${encodeURIComponent('Merhaba, UMERA Design 3D ürünleri hakkında bilgi almak istiyorum.')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp ile iletişim"><span>WhatsApp</span><b>✆</b></a>}

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
                <div><b>{item.product.name}</b><small>{money(item.product.price)}</small><div className="step"><button onClick={() => qty(item.product.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => qty(item.product.id, 1)}>+</button></div></div>
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
            <label className="consent"><input type="checkbox" required /> <span>Sipariş bilgilerimin talebimin işlenmesi amacıyla kaydedilmesini kabul ediyorum.</span></label>
            <div className="notice">Sipariş önce sisteme kaydedilir ve size benzersiz bir sipariş numarası verilir.</div>
            <div className="two"><button className="primary" name="channel" value="whatsapp" disabled={!WA || submittingOrder}>{submittingOrder ? 'Kaydediliyor...' : 'WhatsApp'}</button><button className="ghost" name="channel" value="email" disabled={submittingOrder}>E-posta</button></div>
            <small className="channelHint">Toplam: {money(total)}</small>
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
            <label>Fotoğraflar <span className="muted">(JPG, PNG, WEBP • en fazla 5 adet / 3 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleCustomFiles} /></label>
            {customFiles.length > 0 && <div className="customFileList">{customFiles.map(file => <div className="customFile" key={file.name}><span>🖼️ {file.name}</span><button type="button" onClick={() => removeCustomFile(file.name)}>×</button></div>)}</div>}
            <label>Ek Not<textarea name="note" rows="2" placeholder="Teslim tarihi, özel istek veya başka notunuz..." /></label>
            <label className="consent"><input type="checkbox" required /> <span>İletişim ve tasarım bilgilerimin talebimin değerlendirilmesi amacıyla kaydedilmesini kabul ediyorum.</span></label>
            {customUploading && <div className="notice">Fotoğraflar yükleniyor ve tasarım talebiniz oluşturuluyor...</div>}
            <button className="primary full" disabled={customUploading}>{customUploading ? 'Gönderiliyor...' : 'Özel Tasarım Talebini Gönder →'}</button>
          </form>
        </Modal>
      )}

      {receipt && (
        <Modal title="Sipariş Fişi" close={() => setReceipt(null)}>
          <div className="receipt"><div className="check">✓</div><h3>Siparişiniz alındı</h3><p>Sipariş No: <b>{receipt.orderNo}</b></p><pre>{receipt.text}</pre><button className="ghost full" onClick={() => navigator.clipboard.writeText(receipt.text)}>Fişi Kopyala</button></div>
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

function AdminPanel({ stats, orders, customOrders, products, form, setForm, edit, newProduct, editProduct, saveProduct, delProduct, uploadImage, imageUploading, loadDashboard, logout, updateOrder, notifyShipped }) {
  const [customFilter, setCustomFilter] = useState('Tümü');
  const [selectedCustom, setSelectedCustom] = useState(null);

  async function updateCustom(order, status, quote = order.quote) {
    try {
      const response = await api('/api/custom-orders', {
        method: 'PUT',
        body: JSON.stringify({ requestNo: order.requestNo, status, quote })
      });
      const updated = { ...order, status: response.order.status, quote: response.order.quote };
      setSelectedCustom(current => current?.requestNo === order.requestNo ? updated : current);
      await loadDashboard();
      alert('Özel tasarım talebi güncellendi.');
    } catch (error) {
      alert(error.message);
    }
  }

  function customWhatsApp(order) {
    const digits = String(order.phone || '').replace(/\D/g, '');
    if (!digits) return alert('Müşterinin telefon numarası bulunamadı.');
    const phone = digits.startsWith('90') ? digits : digits.startsWith('0') ? `90${digits.slice(1)}` : digits;
    const text = `Merhaba ${order.name},\n\nUMERA Design 3D özel tasarım talebiniz (${order.requestNo}) incelenmiştir.\nDurum: ${order.status}${order.quote ? `\nTeklif: ${money(order.quote)}` : ''}\n\nUMERA Design 3D`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  const filteredCustom = customOrders.filter(order => customFilter === 'Tümü' || order.status === customFilter);

  return (
    <main className="adminPage wrap">
      <div className="adminTop"><div><div className="eyebrow">YÖNETİM MERKEZİ</div><h1>UMERA <em>Admin</em></h1><p>Ürünlerini, siparişlerini ve özel tasarım taleplerini tek yerden yönet.</p></div><div className="adminActions"><button className="ghost" onClick={loadDashboard}>↻ Yenile</button><button className="ghost" onClick={logout}>Çıkış</button></div></div>
      <div className="stats">{[
        ['Toplam Ürün', products.length, '📦'],
        ['Toplam Sipariş', stats?.totalOrders ?? '—', '🧾'],
        ['Bu Ay', stats?.monthOrders ?? '—', '📅'],
        ['Toplam Ciro', stats ? money(stats.totalRevenue) : '—', '₺'],
        ['Bekleyen', stats?.pending ?? '—', '⏳'],
        ['Özel Tasarım', customOrders.length, '🎨']
      ].map(item => <div className="stat" key={item[0]}><span>{item[2]}</span><small>{item[0]}</small><b>{item[1]}</b></div>)}</div>

      <div className="adminGrid">
        <section className="panel"><div className="panelHead"><div><b>Ürün Yönetimi</b><span>Google Sheets ile senkron</span></div><button className="primary" onClick={newProduct}>+ Yeni Ürün</button></div><div className="productAdmin">{products.map(product => <div className="pRow" key={product.id}><img src={product.image || '/logo-mark.webp'} alt="" /><div><b>{product.name}</b><span>{product.category} · {money(product.price)} · Stok {product.stock}</span></div><button onClick={() => editProduct(product)}>Düzenle</button><button className="danger" onClick={() => delProduct(product.id)}>Sil</button></div>)}</div></section>
        <section className="panel editor"><div className="panelHead"><div><b>{edit ? 'Ürünü Düzenle' : 'Yeni Ürün'}</b><span>Bilgileri girip kaydet</span></div></div><form className="form" onSubmit={saveProduct}><Field label="Ürün adı *" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /><label>Kategori<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{CATS.filter(item => item !== 'Tümü').map(category => <option key={category}>{category}</option>)}</select></label><div className="two"><Field label="Fiyat (TL) *" type="number" min="0" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} required /><Field label="Stok *" type="number" min="0" value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} required /></div><label>Ürün Görseli<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} /></label>{imageUploading && <div className="notice">Görsel yükleniyor...</div>}{form.image && <img className="preview" src={form.image} alt="Önizleme" />}<Field label="Görsel URL (opsiyonel)" value={form.image} onChange={event => setForm({ ...form, image: event.target.value })} /><label>Açıklama<textarea rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><div className="two"><button className="primary">{edit ? 'Değişiklikleri Kaydet' : 'Ürünü Yayınla'}</button><button type="button" className="ghost" onClick={newProduct}>Temizle</button></div></form></section>
      </div>

      <section className="panel orders"><div className="panelHead"><div><b>Sipariş Yönetimi</b><span>Google Sheets · son 100 kayıt · durum değişiklikleri anında kaydedilir</span></div></div><div className="tableWrap"><table><thead><tr><th>Sipariş</th><th>Müşteri</th><th>Ürünler</th><th>Tutar</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>{orders.length ? orders.map(order => <tr key={order.orderNo}><td><b>{order.orderNo}</b><small>{new Date(order.date).toLocaleString('tr-TR')}</small></td><td><b>{order.name}</b><small>{order.phone}</small>{order.email && <small>{order.email}</small>}<small>{order.address}</small></td><td>{order.items}</td><td><b>{money(order.total)}</b></td><td><select className="statusSelect" value={order.status} onChange={event => updateOrder(order, event.target.value)}>{ORDER_STATUSES.map(status => <option key={status}>{status}</option>)}</select></td><td><div className="orderActions"><button className="shipBtn" onClick={() => notifyShipped(order)}>📦 Kargolandı + WhatsApp</button>{order.status !== 'Tamamlandı' && <button className="ghost smallBtn" onClick={() => updateOrder(order, 'Tamamlandı', true)}>✓ Tamamlandı + WhatsApp</button>}</div></td></tr>) : <tr><td colSpan="6" className="empty">Henüz sipariş yok.</td></tr>}</tbody></table></div></section>

      <section className="panel customOrdersAdmin"><div className="panelHead"><div><b>Özel Tasarım Talepleri</b><span>Google Sheets → CustomOrders · müşterilerin gönderdiği fotoğraflar ve talepler</span></div><div className="customFilters">{['Tümü', ...CUSTOM_STATUSES].map(status => <button key={status} className={customFilter === status ? 'chip active' : 'chip'} onClick={() => setCustomFilter(status)}>{status}</button>)}</div></div><div className="customCards">{filteredCustom.length ? filteredCustom.map(order => <article className="customOrderCard" key={order.requestNo} onClick={() => setSelectedCustom(order)}><div className="customOrderTop"><div><b>{order.requestNo}</b><small>{new Date(order.date).toLocaleString('tr-TR')}</small></div><span className="status">{order.status}</span></div><div className="customOrderBody"><div><b>{order.name}</b><small>{order.phone || order.email || 'İletişim yok'}</small><p>{order.details}</p><small>Ölçü: {order.dimensions || '-'} · Renk: {order.color || '-'} · Adet: {order.quantity}</small></div><div className="customThumbs">{order.images?.slice(0, 3).map((url, index) => <img key={url} src={url} alt={`Referans ${index + 1}`} />)}{order.images?.length > 3 && <span>+{order.images.length - 3}</span>}</div></div><div className="customOrderActions"><select className="statusSelect" value={order.status} onClick={event => event.stopPropagation()} onChange={event => { event.stopPropagation(); updateCustom(order, event.target.value); }}>{CUSTOM_STATUSES.map(status => <option key={status}>{status}</option>)}</select>{order.phone && <button className="ghost smallBtn" onClick={event => { event.stopPropagation(); customWhatsApp(order); }}>WhatsApp</button>}</div></article>) : <div className="empty">Bu filtrede özel tasarım talebi yok.</div>}</div></section>

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

createRoot(document.getElementById('root')).render(
  SITE_OPEN ? <App /> : <MaintenancePage />
);
