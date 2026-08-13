import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import MaintenancePage from './MaintenancePage.jsx';
import AbajurKonfigurator from './components/AbajurKonfigurator.jsx';

const SITE_OPEN = import.meta.env.VITE_SITE_OPEN !== 'false';

const WA = import.meta.env.VITE_WHATSAPP_NUMBER || '';
const EMAIL = import.meta.env.VITE_COMPANY_EMAIL || 'siparis@umeradesign3d.com';
const CATS = ['TÃ¼mÃ¼', 'FigÃ¼r & Oyuncak', 'Ev Dekorasyon', 'MasaÃ¼stÃ¼ Aksesuar', 'Ã–zel TasarÄ±m', 'Sanat & Dekor', 'DiÄŸer'];
const ORDER_STATUSES = ['Yeni', 'OnaylandÄ±', 'HazÄ±rlanÄ±yor', 'Kargoya HazÄ±r', 'KargolandÄ±', 'TamamlandÄ±', 'Ä°ptal'];
const CUSTOM_STATUSES = ['Yeni', 'Ä°nceleniyor', 'Fiyat Verildi', 'OnaylandÄ±', 'Ãœretimde', 'TamamlandÄ±', 'Ä°ptal'];
const DEMO = [
  {
    id: 'demo-1',
    name: 'MafsallÄ± Ejderha FigÃ¼rÃ¼',
    category: 'FigÃ¼r & Oyuncak',
    price: 350,
    stock: 8,
    image: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&q=80&w=900',
    description: 'Hareketli eklemli, dekoratif ve eÄŸlenceli 3D baskÄ± model.'
  },
  {
    id: 'demo-2',
    name: 'Geometrik Modern SaksÄ±',
    category: 'Ev Dekorasyon',
    price: 180,
    stock: 12,
    image: 'https://images.unsplash.com/photo-1577900232427-18219b9166a0?auto=format&fit=crop&q=80&w=900',
    description: 'Modern masaÃ¼stÃ¼ ve raf dekorasyonu iÃ§in minimal tasarÄ±m.'
  },
  {
    id: 'demo-3',
    name: 'KulaklÄ±k StandÄ±',
    category: 'MasaÃ¼stÃ¼ Aksesuar',
    price: 220,
    stock: 5,
    image: 'https://images.unsplash.com/photo-1599669500515-b3e1f5b08c90?auto=format&fit=crop&q=80&w=900',
    description: 'Ã‡alÄ±ÅŸma ve oyun masanÄ±zÄ± dÃ¼zenleyen ÅŸÄ±k stand.'
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
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ä°ÅŸlem baÅŸarÄ±sÄ±z.');
  return data;
};

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('TÃ¼mÃ¼');
  const [cart, setCart] = useState([]);
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
  const [edit, setEdit] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [customUploading, setCustomUploading] = useState(false);
  const [customFiles, setCustomFiles] = useState([]);
  const [form, setForm] = useState({
    name: '',
    category: 'FigÃ¼r & Oyuncak',
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
    const categoryMatch = cat === 'TÃ¼mÃ¼' || product.category === cat;
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
    const quantity = Math.max(1, Math.min(20, Number(quote.config.adet) || 1));
    const product = {
      id: `abajur-${configId(quote.config)}`,
      type: 'abajur',
      name: quote.name,
      category: 'Abajur TasarÄ±mÄ±',
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
      const lines = [
        'UMERA DESIGN 3D â€” YENÄ° SÄ°PARÄ°Åž',
        `SipariÅŸ No: ${orderNo}`,
        `MÃ¼ÅŸteri: ${data.name}`,
        `Telefon: ${data.phone}`,
        data.email ? `E-posta: ${data.email}` : '',
        `Adres: ${data.address}`,
        data.note ? `Not: ${data.note}` : '',
        '',
        ...data.items.map(item => `${item.name} x${item.quantity} â€” ${money(item.price * item.quantity)}`),
        '',
        `TOPLAM: ${money(confirmedTotal)}`
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
      alert(`SipariÅŸ kaydedilemedi: ${error.message}\nLÃ¼tfen tekrar deneyin.`);
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
    if (!customFiles.length && !confirm('FotoÄŸraf eklemeden gÃ¶ndermek istiyor musunuz?')) return;

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
        'UMERA DESIGN 3D â€” Ã–ZEL TASARIM TALEBÄ°',
        '',
        `Talep No: ${response.requestNo}`,
        `Ä°sim: ${data.name}`,
        `Telefon: ${data.phone || '-'}`,
        `E-posta: ${data.email || '-'}`,
        `Ã–lÃ§Ã¼: ${data.dimensions || '-'}`,
        `Renk: ${data.color || '-'}`,
        `Adet: ${data.quantity}`,
        `Detay: ${data.details}`
      ].join('\n');

      setCustom(false);
      setCustomFiles([]);
      alert(`Talebiniz alÄ±ndÄ±. Talep No: ${response.requestNo}`);
      if (WA) window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank');
    } catch (error) {
      alert(error.message);
    } finally {
      setCustomUploading(false);
    }
  }

  function handleCustomFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 5) return alert('En fazla 5 fotoÄŸraf yÃ¼kleyebilirsiniz.');
    const tooBig = files.find(file => file.size > 3 * 1024 * 1024);
    if (tooBig) return alert(`${tooBig.name} 3 MB sÄ±nÄ±rÄ±nÄ± aÅŸÄ±yor.`);
    const bad = files.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (bad) return alert('Sadece JPG, PNG veya WEBP yÃ¼kleyebilirsiniz.');
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
      KargolandÄ±: `Merhaba ${order.name},\n\nUMERA Design 3D sipariÅŸiniz (${order.orderNo}) kargoya verilmiÅŸtir.\n\nSipariÅŸiniz: ${order.items}\nToplam: ${money(order.total)}\n\nÃœrÃ¼nÃ¼nÃ¼zÃ¼ gÃ¼zel gÃ¼nlerde kullanmanÄ±zÄ± dileriz.`,
      TamamlandÄ±: `Merhaba ${order.name},\n\n${order.orderNo} numaralÄ± UMERA Design 3D sipariÅŸiniz tamamlandÄ±. Bizi tercih ettiÄŸiniz iÃ§in teÅŸekkÃ¼r ederiz.`
    };
    return `${messages[status] || `Merhaba ${order.name}, ${order.orderNo} numaralÄ± sipariÅŸinizin durumu â€œ${status}â€ olarak gÃ¼ncellendi.`}\n\nUMERA Design 3D\nHayal Et. Tasarla. GerÃ§ekleÅŸtir.`;
  }

  async function updateOrder(order, status) {
    if (order.status === status) return;
    try {
      const response = await api('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ë¾¶¶‰žËkºwµçEµ”ô¤ìõô€¼ø(€€€€€€€€ñÍÁ…¸ùíÁÉ½‘ÕÐ¹…Ñ•½Éåôð½ÍÁ…¸ø(€€€€€€€íÁÉ½‘ÕÐ¹ÍÑ½¬€ôôô€À€˜˜€ñˆ±…ÍÍ9…µ”ô‰Í½±ˆùSñ­•¹‘¤ð½ˆùô(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…É‘	½‘äˆø(€€€€€€€€ñ ÌùíÁÉ½‘ÕÐ¹¹…µ•ôð½ Ìø(€€€€€€€€ñÀùíÁÉ½‘ÕÐ¹‘•ÍÉ¥ÁÑ¥½¹ôð½Àø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ½‘ÕÑ5•Ñ„ˆøñÍÁ…¸ûŠ>Ä€ËŠLÔ§|Ÿñ»ð¨ð½ÍÁ…¸øñÍÁ…¸ûŠ²„M¥Á…É§}”ŸÙÉ”ƒñÉ•Ñ¥´ð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…É‘	½ÑÑ½´ˆøñÍÑÉ½¹œùíµ½¹•ä¡ÁÉ½‘ÕÐ¹ÁÉ¥”¥ôð½ÍÑÉ½¹œøñ‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘•Ñ…¥±	Ñ¸ˆ½¹±¥¬õì ¤€ôø½¹•Ñ…¥°¡ÁÉ½‘ÕÐ¥ôûÁ¹•±”ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø½¹‘¡ÁÉ½‘ÕÐ¥ô‘¥Í…‰±•õíÁÉ½‘ÕÐ¹ÍÑ½¬€ôôô€ÁôùíÁÉ½‘ÕÐ¹ÍÑ½¬€ôôô€À€ü€Sñ­•¹‘¤œ€è€M•Á•Ñ”­±”ôð½‰ÕÑÑ½¸øð½‘¥Øøð½‘¥Øø(€€€€€€€€ñÍµ…±°ùíÁÉ½‘ÕÐ¹ÍÑ½¬€ø€À€ü5•ÙÕÐÍÑ½¬è€‘íÁÉ½‘ÕÐ¹ÍÑ½­õ€€è€MÑ½­Ñ„å½¬ôƒ
Ü€©Q…¡µ¥¹¤ÏñÉ”ð½Íµ…±°ø(€€€€€€ð½‘¥Øø(€€€€ð½…ÉÑ¥±”ø(€€¤ì)ô()™Õ¹Ñ¥½¸AÉ½•ÍÍM•Ñ¥½¸¡ì½¹MÑ…ÉÐô¤ì(€½¹ÍÐÍÑ•ÁÌ€ôl(€€€lœÀÄœ°€½Ñ¿}É…›Å»ÄŸÙ¹‘•Èœ°€I•™•É…¹ÌŸÙÉÍ•±±•É¤°ƒÙ³ŸñçðÙ”¥ÍÑ•‘§}¥¸ƒÙé•±±¥­±•É¤Á…å±‡|¸t°(€€€lœÀÈœ°€Q…±•‰¥¹¤¥¹•±•å•±¥´œ°€ŸqÉ•Ñ¥±•‰¥±¥É±¥¬°µ…±é•µ”Ù”‘•Ñ…å±…ËÄ‘—}•É±•¹‘¥É•±¥´¸t°(€€€lœÀÌœ°€Q•­±¥™¤½¹…å±„œ°€¥å…ÐÙ”Ñ…¡µ¥¹¤ƒñÉ•Ñ¥´ÏñÉ•Í¥¹¤Í…¹„¥±•Ñ•±¥´¸t°(€€€lœÀÐœ°€ŸqÉ•Ñ¥µ”‰‡}±…å…³Å´œ°€=¹…çÅ¹‘…¸Í½¹É„ƒñËñ»ðƒÙé•¹±”¡…ëÅÉ±…å…³Å´¸t(€tì(€É•ÑÕÉ¸€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰ÝÉ…ÀÁÉ½•ÍÍM•Ñ¥½¸ˆøñM•Ñ¥½¹Q¥Ñ±”•å•‰É½Üô‹Yi0QMI%4OqIÀˆÑ¥Ñ±”õìðùÙÉÐ…“Åµ‘„€ñ•´ù™¥­É¥¹‘•¸ƒñËñ¹”¸ð½•´øð¼ùôÑ•áÐô‰¥å…ÓÄ‰•±±¤½±µ…å…¸ƒÙé•°Ñ…±•Á±•ÈÍ…ÓÇ|Í¥Á…É§}±•É¥¹‘•¸…åËÄÑ…­¥À•‘¥±¥È¸ˆ€¼øñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ½•ÍÍÉ¥ˆùíÍÑ•ÁÌ¹µ…À ¡m¹Õµ‰•È°Ñ¥Ñ±”°Ñ•áÑt¤€ôø€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ½•ÍÍ…Éˆ­•äõí¹Õµ‰•ÉôøñÍÁ…¸ùí¹Õµ‰•Éôð½ÍÁ…¸øñ ÌùíÑ¥Ñ±•ôð½ ÌøñÀùíÑ•áÑôð½Àøð½‘¥Øø¥ôð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…ÉäÁÉ½•ÍÍÑ„ˆ½¹±¥¬õí½¹MÑ…ÉÑôûYé•°Q…Í…ËÅ´Q…±•‰¤=±×}ÑÕÈƒŠHð½‰ÕÑÑ½¸øð½Í•Ñ¥½¸øì)ô()™Õ¹Ñ¥½¸EM•Ñ¥½¸ ¤ì(€½¹ÍÐ™…ÅÌ€ôl(€€€l‰…©ÕÈÑ…Í…ËÅ·Å·Ä¹…ÏÅ°Í¥Á…É§|Ù•É¥É¥´üœ°€‰…©ÕÈQ…Í…É±„…±…»Å¹‘„ƒÙ³Ÿð°ÁÉ½™¥°°‘•Í•¸°µ…±é•µ”°É•¹¬Ù”‘ÕäÑ¥Á¥¹¤Í—œ¸ƒqÉ•Ñ¥µ”ÕåÕ¸Ñ…Í…ËÅ·Å»ÄÍ•Á•Ñ”•­±•‘§}¥¹‘”™¥å…ÐÍÕ¹ÕÕ‘„å•¹¥‘•¸‘¿}ÉÕ±…»ÅÈÙ”¹½Éµ…°Í¥Á…É§|…¯ÇÅ¹„•­±•¹¥È¸t°(€€€lŸqËñ¹±•È¡…ëÅÈÍÑ½¬µÔüœ°€	…ëÄƒñËñ¹±•ÈÍÑ½­Ñ…¸°‰…ëÄƒñËñ¹±•ÈÍ¥Á…É§|ƒñé•É¥¹”ƒñÉ•Ñ¥±¥È¸ñ¹•°ÍÑ½¬‰¥±¥Í¤ƒñËñ¸­…ÉÓÅ¹‘„ŸÙËñ»ñÈ¸t°(€€€lŸqÉ•Ñ¥´¹”­…‘…ÈÏñÉ•Èüœ°€5½‘•°°…‘•ÐÙ”‰…Í¯ÄÏñÉ•Í¥¹”ŸÙÉ”‘—}§}¥È¸MÑ…¹‘…ÉÐƒñËñ¹±•É‘”Ñ…¡µ¥¹¤ÏñÉ”ƒ¿}Õ¹±Õ­±„€ËŠLÔ§|Ÿñ»ñ“ñÈìÍ¥Á…É§|ƒÙ¹•Í¥¹‘”Ñ•å¥Ð•‘¥±¥È¸t°(€€€lI•¹¬Ù•å„‰½åÕÐ‘—}§}Ñ¥É•‰¥±¥Èµ¥å¥´üœ°€UåÕ¸½±…¸µ½‘•±±•É‘”É•¹¬Ù”ƒÙ³Ÿð‘—}§}¥­±§}¤å…ÃÅ±…‰¥±¥È¸ƒqËñ¸‘•Ñ…çÅ¹‘…¸Ù•å„]¡…ÑÍÁÀƒñé•É¥¹‘•¸‰¥±¤…±…‰¥±¥ÉÍ¥¸¸t°(€€€lŸYé•°Ñ…Í…ËÅ´™¥å…ÓÄ¹…ÏÅ°‰•±¥É±•¹¥Èüœ°€Ù¹‘•É‘§}¥¸™½Ñ¿}É…˜°ƒÙ³Ÿð°µ…±é•µ”°‰…Í¯ÄÏñÉ•Í¤Ù”…‘•Ð‘—}•É±•¹‘¥É¥±•É•¬Ñ•­±¥˜½±×}ÑÕÉÕ±ÕÈ¸t(€tì(€É•ÑÕÉ¸€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰ÝÉ…À™…ÅM•Ñ¥½¸ˆøñM•Ñ¥½¹Q¥Ñ±”•å•‰É½Üô‰M%,M=IU18M=IU1HˆÑ¥Ñ±”õìðùM¥Á…É§}Ñ•¸ƒÙ¹”€ñ•´ùµ•É…¬•‘¥±•¹±•È¸ð½•´øð¼ùô€¼øñ‘¥Ø±…ÍÍ9…µ”ô‰™…ÅÉ¥ˆùí™…ÅÌ¹µ…À ¡mÅÕ•ÍÑ¥½¸°…¹ÍÝ•Ét¤€ôø€ñ‘•Ñ…¥±Ì­•äõíÅÕ•ÍÑ¥½¹ôøñÍÕµµ…ÉäùíÅÕ•ÍÑ¥½¹ôñÍÁ…¸ø¬ð½ÍÁ…¸øð½ÍÕµµ…ÉäøñÀùí…¹ÍÝ•Éôð½Àøð½‘•Ñ…¥±Ìø¥ôð½‘¥Øøð½Í•Ñ¥½¸øì)ô()™Õ¹Ñ¥½¸%µ…•1¥¡Ñ‰½à¡ì¥µ…”°±½Í”ô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰¥µ…•1¥¡Ñ‰½àˆ½¹±¥¬õí±½Í•ôÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•°ô‹qËñ¸ŸÙÉÍ•±¤ˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¥µ…•1¥¡Ñ‰½á±½Í”ˆ½¹±¥¬õí±½Í•ô…É¥„µ±…‰•°ô‰-…Á…Ðˆû\ð½‰ÕÑÑ½¸øñ¥µœÍÉŒõí¥µ…”¹ÕÉ±ô…±Ðõí¥µ…”¹¹…µ•ô½¹±¥¬õí•Ù•¹Ð€ôø•Ù•¹Ð¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¥ô€¼øñ‘¥Ø±…ÍÍ9…µ”ô‰¥µ…•1¥¡Ñ‰½á…ÁÑ¥½¸ˆùí¥µ…”¹¹…µ•ôð½‘¥Øøð½‘¥Øøì)ô()™Õ¹Ñ¥½¸¥•±¡ì±…‰•°°¹…µ”°€¸¸¹ÁÉ½ÁÌô¤ì(€É•ÑÕÉ¸€ñ±…‰•°ùí±…‰•±ôñ¥¹ÁÕÐ¹…µ”õí¹…µ•ôì¸¸¹ÁÉ½ÁÍô€¼øð½±…‰•°øì)ô()™Õ¹Ñ¥½¸5½‘…°¡ìÑ¥Ñ±”°±½Í”°¡¥±‘É•¸°Ý¥‘”€ô™…±Í”ô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…±	…¬ˆ½¹5½ÕÍ•½Ý¸õí•Ù•¹Ð€ôøì¥˜€¡•Ù•¹Ð¹Ñ…É•Ð€ôôô•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¤±½Í” ¤ìõôøñ‘¥Ø±…ÍÍ9…µ”õíÝ¥‘”€ü€µ½‘…°Ý¥‘”œ€è€µ½‘…°ôøñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…±!•…ˆøñ ÌùíÑ¥Ñ±•ôð½ Ìøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí±½Í•ô…É¥„µ±…‰•°ô‰-…Á…Ðˆû\ð½‰ÕÑÑ½¸øð½‘¥Øùí¡¥±‘É•¹ôð½‘¥Øøð½‘¥Øøì)ô()™Õ¹Ñ¥½¸‘µ¥¹A…¹•°¡ìÍÑ…ÑÌ°½É‘•ÉÌ°ÕÍÑ½µ=É‘•ÉÌ°ÁÉ½‘ÕÑÌ°™½É´°Í•Ñ½É´°•‘¥Ð°¹•ÝAÉ½‘ÕÐ°•‘¥ÑAÉ½‘ÕÐ°Í…Ù•AÉ½‘ÕÐ°‘•±AÉ½‘ÕÐ°ÕÁ±½…‘%µ…”°¥µ…•UÁ±½…‘¥¹œ°±½…‘…Í¡‰½…É°±½½ÕÐ°ÕÁ‘…Ñ•=É‘•È°¹½Ñ¥™åM¡¥ÁÁ•ô¤ì(€½¹ÍÐmÕÍÑ½µ¥±Ñ•È°Í•ÑÕÍÑ½µ¥±Ñ•Ét€ôÕÍ•MÑ…Ñ” Sñ·ðœ¤ì(€½¹ÍÐmÍ•±•Ñ•‘ÕÍÑ½´°Í•ÑM•±•Ñ•‘ÕÍÑ½µt€ôÕÍ•MÑ…Ñ”¡¹Õ±°¤ì((€…Íå¹Œ™Õ¹Ñ¥½¸ÕÁ‘…Ñ•ÕÍÑ½´¡½É‘•È°ÍÑ…ÑÕÌ°ÅÕ½Ñ”€ô½É‘•È¹ÅÕ½Ñ”¤ì(€€€ÑÉäì(€€€€€½¹ÍÐÉ•ÍÁ½¹Í”€ô…Ý…¥Ð…Á¤ œ½…Á¤½ÕÍÑ½´µ½É‘•ÉÌœ°ì(€€€€€€€µ•Ñ¡½è€AUPœ°(€€€€€€€‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ìÉ•ÅÕ•ÍÑ9¼è½É‘•È¹É•ÅÕ•ÍÑ9¼°ÍÑ…ÑÕÌ°ÅÕ½Ñ”ô¤(€€€€€ô¤ì(€€€€€½¹ÍÐÕÁ‘…Ñ•€ôì€¸¸¹½É‘•È°ÍÑ…ÑÕÌèÉ•ÍÁ½¹Í”¹½É‘•È¹ÍÑ…ÑÕÌ°ÅÕ½Ñ”èÉ•ÍÁ½¹Í”¹½É‘•È¹ÅÕ½Ñ”ôì(€€€€€Í•ÑM•±•Ñ•‘ÕÍÑ½´¡ÕÉÉ•¹Ð€ôøÕÉÉ•¹Ðü¹É•ÅÕ•ÍÑ9¼€ôôô½É‘•È¹É•ÅÕ•ÍÑ9¼€üÕÁ‘…Ñ•€èÕÉÉ•¹Ð¤ì(€€€€€…Ý…¥Ð±½…‘…Í¡‰½…É ¤ì(€€€€€…±•ÉÐ ŸYé•°Ñ…Í…ËÅ´Ñ…±•‰¤Ÿñ¹•±±•¹‘¤¸œ¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€…±•ÉÐ¡•ÉÉ½È¹µ•ÍÍ…”¤ì(€€€ô(€ô((€™Õ¹Ñ¥½¸ÕÍÑ½µ]¡…ÑÍÁÀ¡½É‘•È¤ì(€€€½¹ÍÐ‘¥¥ÑÌ€ôMÑÉ¥¹œ¡½É‘•È¹Á¡½¹”ñð€œœ¤¹É•Á±…” ½q½œ°€œœ¤ì(€€€¥˜€ …‘¥¥ÑÌ¤É•ÑÕÉ¸…±•ÉÐ 7ó}Ñ•É¥¹¥¸Ñ•±•™½¸¹Õµ…É…ÏÄ‰Õ±Õ¹…µ…“Ä¸œ¤ì(€€€½¹ÍÐÁ¡½¹”€ô‘¥¥ÑÌ¹ÍÑ…ÉÑÍ]¥Ñ  œäÀœ¤€ü‘¥¥ÑÌ€è‘¥¥ÑÌ¹ÍÑ…ÉÑÍ]¥Ñ  œÀœ¤€ü€äÀ‘í‘¥¥ÑÌ¹Í±¥” Ä¥õ€€è‘¥¥ÑÌì(€€€½¹ÍÐÑ•áÐ€ô5•É¡…‰„€‘í½É‘•È¹¹…µ•ô±q¹q¹U5I•Í¥¸€ÍƒÙé•°Ñ…Í…ËÅ´Ñ…±•‰¥¹¥è€ ‘í½É‘•È¹É•ÅÕ•ÍÑ9½ô¤¥¹•±•¹µ§}Ñ¥È¹q¹ÕÉÕ´è€‘í½É‘•È¹ÍÑ…ÑÕÍô‘í½É‘•È¹ÅÕ½Ñ”€üq¹Q•­±¥˜è€‘íµ½¹•ä¡½É‘•È¹ÅÕ½Ñ”¥õ€€è€œõq¹q¹U5I•Í¥¸€Í€ì(€€€Ý¥¹‘½Ü¹½Á•¸¡¡ÑÑÁÌè¼½Ý„¹µ”¼‘íÁ¡½¹•ôýÑ•áÐô‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ•áÐ¥õ€°€}‰±…¹¬œ¤ì(€ô((€™Õ¹Ñ¥½¸‘½Ý¹±½…‘‰…©ÕÉAÉ½‘ÕÑ¥½¸¡½É‘•È°½¹™¥ÕÉ…Ñ¥½¸°¥¹‘•à¤ì(€€€½¹ÍÐÁ…å±½…€ôì(€€€€€Í¥Á…É¥Í9¼è½É‘•È¹½É‘•É9¼°(€€€€€µÕÍÑ•É¤è½É‘•È¹¹…µ”°(€€€€€…‘•Ðè½¹™¥ÕÉ…Ñ¥½¸¹ÅÕ…¹Ñ¥Ñä°(€€€€€•½MÕÉÕ´è½¹™¥ÕÉ…Ñ¥½¸¹•½MÕÉÕ´°(€€€€€½¹™¥œèì€¸¸¹½¹™¥ÕÉ…Ñ¥½¸¹½¹™¥œ°…‘•Ðè½¹™¥ÕÉ…Ñ¥½¸¹ÅÕ…¹Ñ¥Ñäô°(€€€€€½é•Ðè½¹™¥ÕÉ…Ñ¥½¸¹ÍÕµµ…Éä°(€€€€€¥ÍµÉ¤è½¹™¥ÕÉ…Ñ¥½¸¹¥ÍµÉ¤(€€€ôì(€€€½¹ÍÐ‰±½ˆ€ô¹•Ü	±½ˆ¡m)M=8¹ÍÑÉ¥¹¥™ä¡Á…å±½…°¹Õ±°°€È¥t°ìÑåÁ”è€…ÁÁ±¥…Ñ¥½¸½©Í½¸œô¤ì(€€€½¹ÍÐÕÉ°€ôUI0¹É•…Ñ•=‰©•ÑUI0¡‰±½ˆ¤ì(€€€½¹ÍÐ±¥¹¬€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð „œ¤ì(€€€±¥¹¬¹¡É•˜€ôÕÉ°ì(€€€±¥¹¬¹‘½Ý¹±½…€ô€‘í½É‘•È¹½É‘•É9½ôµ…‰…©ÕÈ´‘í¥¹‘•à€¬€Åô¹©Í½¹€ì(€€€±¥¹¬¹±¥¬ ¤ì(€€€Í•ÑQ¥µ•½ÕÐ  ¤€ôøUI0¹É•Ù½­•=‰©•ÑUI0¡ÕÉ°¤°€ÄÀÀÀ¤ì(€ô((€½¹ÍÐ™¥±Ñ•É•‘ÕÍÑ½´€ôÕÍÑ½µ=É‘•ÉÌ¹™¥±Ñ•È¡½É‘•È€ôøÕÍÑ½µ¥±Ñ•È€ôôô€Sñ·ðœñð½É‘•È¹ÍÑ…ÑÕÌ€ôôôÕÍÑ½µ¥±Ñ•È¤ì((€É•ÑÕÉ¸€ (€€€€ñµ…¥¸±…ÍÍ9…µ”ô‰…‘µ¥¹A…”ÝÉ…Àˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¹Q½Àˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùgY9SÁ45I-kÀð½‘¥Øøñ ÄùU5I€ñ•´ù‘µ¥¸ð½•´øð½ ÄøñÀûqËñ¹±•É¥¹¤°Í¥Á…É§}±•É¥¹¤Ù”ƒÙé•°Ñ…Í…ËÅ´Ñ…±•Á±•É¥¹¤Ñ•¬å•É‘•¸çÙ¹•Ð¸ð½Àøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¹Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½ÍÐˆ½¹±¥¬õí±½…‘…Í¡‰½…É‘ôûŠìe•¹¥±”ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½ÍÐˆ½¹±¥¬õí±½½ÕÑôûÅ¯Ç|ð½‰ÕÑÑ½¸øð½‘¥Øøð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ…ÑÌˆùíl(€€€€€€€lQ½Á±…´ƒqËñ¸œ°ÁÉ½‘ÕÑÌ¹±•¹Ñ °€ŸÂ~N˜t°(€€€€€€€lQ½Á±…´M¥Á…É§|œ°ÍÑ…ÑÌü¹Ñ½Ñ…±=É‘•ÉÌ€üü€ŸŠPœ°€ŸÂ~žøt°(€€€€€€€l	Ôäœ°ÍÑ…ÑÌü¹µ½¹Ñ¡=É‘•ÉÌ€üü€ŸŠPœ°€ŸÂ~Nt°(€€€€€€€lQ½Á±…´¥É¼œ°ÍÑ…ÑÌ€üµ½¹•ä¡ÍÑ…ÑÌ¹Ñ½Ñ…±I•Ù•¹Õ”¤€è€ŸŠPœ°€ŸŠ
èt°(€€€€€€€l	•­±•å•¸œ°ÍÑ…ÑÌü¹Á•¹‘¥¹œ€üü€ŸŠPœ°€ŸŠ>Ìt°(€€€€€€€lŸYé•°Q…Í…ËÅ´œ°ÕÍÑ½µ=É‘•ÉÌ¹±•¹Ñ °€ŸÂ~: t(€€€€€t¹µ…À¡¥Ñ•´€ôø€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ…Ðˆ­•äõí¥Ñ•µlÁuôøñÍÁ…¸ùí¥Ñ•µlÉuôð½ÍÁ…¸øñÍµ…±°ùí¥Ñ•µlÁuôð½Íµ…±°øñˆùí¥Ñ•µlÅuôð½ˆøð½‘¥Øø¥ôð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‘µ¥¹É¥ˆø(€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•±!•…ˆøñ‘¥ØøñˆûqËñ¸gÙ¹•Ñ¥µ¤ð½ˆøñÍÁ…¸ù½½±”M¡••ÑÌ¥±”Í•¹­É½¸ð½ÍÁ…¸øð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ½¹±¥¬õí¹•ÝAÉ½‘ÕÑôø¬e•¹¤ƒqËñ¸ð½‰ÕÑÑ½¸øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ½‘ÕÑ‘µ¥¸ˆùíÁÉ½‘ÕÑÌ¹µ…À¡ÁÉ½‘ÕÐ€ôø€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÁI½Üˆ­•äõíÁÉ½‘ÕÐ¹¥‘ôøñ¥µœÍÉŒõíÁÉ½‘ÕÐ¹¥µ…”ñð€œ½±½¼µµ…É¬¹Ý•‰Àô…±Ðôˆˆ€¼øñ‘¥ØøñˆùíÁÉ½‘ÕÐ¹¹…µ•ôð½ˆøñÍÁ…¸ùíÁÉ½‘ÕÐ¹…Ñ•½Éåôƒ
Üíµ½¹•ä¡ÁÉ½‘ÕÐ¹ÁÉ¥”¥ôƒ
ÜMÑ½¬íÁÉ½‘ÕÐ¹ÍÑ½­ôð½ÍÁ…¸øð½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø•‘¥ÑAÉ½‘ÕÐ¡ÁÉ½‘ÕÐ¥ôùñé•¹±”ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…¹•Èˆ½¹±¥¬õì ¤€ôø‘•±AÉ½‘ÕÐ¡ÁÉ½‘ÕÐ¹¥¥ôùM¥°ð½‰ÕÑÑ½¸øð½‘¥Øø¥ôð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°•‘¥Ñ½Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•±!•…ˆøñ‘¥Øøñˆùí•‘¥Ð€ü€ŸqËñ»ðñé•¹±”œ€è€e•¹¤ƒqËñ¸ôð½ˆøñÍÁ…¸ù	¥±¥±•É¤¥É¥À­…å‘•Ðð½ÍÁ…¸øð½‘¥Øøð½‘¥Øøñ™½É´±…ÍÍ9…µ”ô‰™½É´ˆ½¹MÕ‰µ¥ÐõíÍ…Ù•AÉ½‘ÕÑôøñ¥•±±…‰•°ô‹qËñ¸…“Ä€¨ˆÙ…±Õ”õí™½É´¹¹…µ•ô½¹¡…¹”õí•Ù•¹Ð€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°¹…µ”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÉ•ÅÕ¥É•€¼øñ±…‰•°ù-…Ñ•½É¤ñÍ•±•ÐÙ…±Õ”õí™½É´¹…Ñ•½Éåô½¹¡…¹”õí•Ù•¹Ð€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°…Ñ•½Éäè•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ôùíQL¹™¥±Ñ•È¡¥Ñ•´€ôø¥Ñ•´€„ôô€Sñ·ðœ¤¹µ…À¡…Ñ•½Éä€ôø€ñ½ÁÑ¥½¸­•äõí…Ñ•½Éåôùí…Ñ•½Éåôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðøð½±…‰•°øñ‘¥Ø±…ÍÍ9…µ”ô‰ÑÝ¼ˆøñ¥•±±…‰•°ô‰¥å…Ð€¡Q0¤€¨ˆÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÙ…±Õ”õí™½É´¹ÁÉ¥•ô½¹¡…¹”õí•Ù•¹Ð€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°ÁÉ¥”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÉ•ÅÕ¥É•€¼øñ¥•±±…‰•°ô‰MÑ½¬€¨ˆÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÙ…±Õ”õí™½É´¹ÍÑ½­ô½¹¡…¹”õí•Ù•¹Ð€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°ÍÑ½¬è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÉ•ÅÕ¥É•€¼øð½‘¥Øøñ±…‰•°ûqËñ¸ÙÉÍ•±¤ñ¥¹ÁÕÐÑåÁ”ô‰™¥±”ˆ…•ÁÐô‰¥µ…”½©Á•œ±¥µ…”½Á¹œ±¥µ…”½Ý•‰Àˆ½¹¡…¹”õíÕÁ±½…‘%µ…•ô€¼øð½±…‰•°ùí¥µ…•UÁ±½…‘¥¹œ€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰¹½Ñ¥”ˆùÙÉÍ•°çñ­±•¹¥å½È¸¸¸ð½‘¥Øùõí™½É´¹¥µ…”€˜˜€ñ¥µœ±…ÍÍ9…µ”ô‰ÁÉ•Ù¥•ÜˆÍÉŒõí™½É´¹¥µ…•ô…±Ðô‹Y¹¥é±•µ”ˆ€¼ùôñ¥•±±…‰•°ô‰ÙÉÍ•°UI0€¡½ÁÍ¥å½¹•°¤ˆÙ…±Õ”õí™½É´¹¥µ…•ô½¹¡…¹”õí•Ù•¹Ð€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°¥µ…”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øñ±…‰•°ùŸÅ­±…µ„ñÑ•áÑ…É•„É½ÝÌôˆÐˆÙ…±Õ”õí™½É´¹‘•ÍÉ¥ÁÑ¥½¹ô½¹¡…¹”õí•Ù•¹Ð€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°‘•ÍÉ¥ÁÑ¥½¸è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½±…‰•°øñ‘¥Ø±…ÍÍ9…µ”ô‰ÑÝ¼ˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆùí•‘¥Ð€ü€—}§}¥­±¥­±•É¤-…å‘•Ðœ€è€ŸqËñ»ðe…çÅ¹±„ôð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰¡½ÍÐˆ½¹±¥¬õí¹•ÝAÉ½‘ÕÑôùQ•µ¥é±”ð½‰ÕÑÑ½¸øð½‘¥Øøð½™½É´øð½Í•Ñ¥½¸ø(€€€€€€ð½‘¥Øø((€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°½É‘•ÉÌˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•±!•…ˆøñ‘¥ØøñˆùM¥Á…É§|gÙ¹•Ñ¥µ¤ð½ˆøñÍÁ…¸ùÕÉÕµÔ‘—}§}Ñ¥É‘§}¥¹¥é‘”·ó}Ñ•É¥å”½Ñ½µ…Ñ¥¬‰¥±‘¥É¥´ŸÙ¹‘•É¥±¥Èƒ
Ü…‰…©ÕÈƒñÉ•Ñ¥´…å…É±…ËÄÍ¥Á…É§}±”‰¥É±¥­Ñ”Í…­±…»ÅÈð½ÍÁ…¸øð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ…‰±•]É…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ ùM¥Á…É§|ð½Ñ øñÑ ù7ó}Ñ•É¤ð½Ñ øñÑ ûqËñ¹±•Èð½Ñ øñÑ ùQÕÑ…Èð½Ñ øñÑ ùÕÉÕ´ð½Ñ øñÑ ûÃ}±•´ð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äùí½É‘•ÉÌ¹±•¹Ñ €ü½É‘•ÉÌ¹µ…À¡½É‘•È€ôø€ñÑÈ­•äõí½É‘•È¹½É‘•É9½ôøñÑøñˆùí½É‘•È¹½É‘•É9½ôð½ˆøñÍµ…±°ùí¹•Ü…Ñ”¡½É‘•È¹‘…Ñ”¤¹Ñ½1½…±•MÑÉ¥¹œ ÑÈµQHœ¥ôð½Íµ…±°øð½ÑøñÑøñˆùí½É‘•È¹¹…µ•ôð½ˆøñÍµ…±°ùí½É‘•È¹Á¡½¹•ôð½Íµ…±°ùí½É‘•È¹•µ…¥°€˜˜€ñÍµ…±°ùí½É‘•È¹•µ…¥±ôð½Íµ…±°ùôñÍµ…±°ùí½É‘•È¹…‘‘É•ÍÍôð½Íµ…±°øð½ÑøñÑùí½É‘•È¹¥Ñ•µÍõí½É‘•È¹½¹™¥ÕÉ…Ñ¥½¹Ìü¹±•¹Ñ €ø€À€˜˜€ñÍµ…±°±…ÍÍ9…µ”ô‰ÁÉ½‘ÕÑ¥½¹	…‘”ˆûŠ^ í½É‘•È¹½¹™¥ÕÉ…Ñ¥½¹Ì¹±•¹Ñ¡ôƒñÉ•Ñ¥´‘½Íå…ÏÄ¡…ëÅÈð½Íµ…±°ùôð½ÑøñÑøñˆùíµ½¹•ä¡½É‘•È¹Ñ½Ñ…°¥ôð½ˆøð½ÑøñÑøñÍ•±•Ð±…ÍÍ9…µ”ô‰ÍÑ…ÑÕÍM•±•ÐˆÙ…±Õ”õí½É‘•È¹ÍÑ…ÑÕÍô½¹¡…¹”õí•Ù•¹Ð€ôøÕÁ‘…Ñ•=É‘•È¡½É‘•È°•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ôùí=II}MQQUML¹µ…À¡ÍÑ…ÑÕÌ€ôø€ñ½ÁÑ¥½¸­•äõíÍÑ…ÑÕÍôùíÍÑ…ÑÕÍôð½½ÁÑ¥½¸ø¥ôð½Í•±•ÐøñÍµ…±°ù—}§}¥­±¥­Ñ”‰¥±‘¥É¥´¥‘•Èð½Íµ…±°øð½ÑøñÑøñ‘¥Ø±…ÍÍ9…µ”ô‰½É‘•ÉÑ¥½¹Ìˆùí½É‘•È¹½¹™¥ÕÉ…Ñ¥½¹Ìü¹µ…À ¡½¹™¥ÕÉ…Ñ¥½¸°¥¹‘•à¤€ôø€ñ‰ÕÑÑ½¸­•äõí€‘í½É‘•È¹½É‘•É9½ô´‘í¥¹‘•áõô±…ÍÍ9…µ”ô‰ÁÉ½‘ÕÑ¥½¹	Ñ¸ˆ½¹±¥¬õì ¤€ôø‘½Ý¹±½…‘‰…©ÕÉAÉ½‘ÕÑ¥½¸¡½É‘•È°½¹™¥ÕÉ…Ñ¥½¸°¥¹‘•à¥ôûŠ^ ‰…©ÕÈí¥¹‘•à€¬€ÅôƒqÉ•Ñ¥´)M=8ð½‰ÕÑÑ½¸ø¥ôñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í¡¥Á	Ñ¸ˆ½¹±¥¬õì ¤€ôø¹½Ñ¥™åM¡¥ÁÁ•¡½É‘•È¥ôù7ó}Ñ•É¥å”]¡…ÑÍÁÀ‡œð½‰ÕÑÑ½¸øð½‘¥Øøð½Ñøð½ÑÈø¤€è€ñÑÈøñÑ½±MÁ…¸ôˆØˆ±…ÍÍ9…µ”ô‰•µÁÑäˆù!•»ñèÍ¥Á…É§|å½¬¸ð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øøð½Í•Ñ¥½¸ø((€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°ÕÍÑ½µ=É‘•ÉÍ‘µ¥¸ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•±!•…ˆøñ‘¥ØøñˆûYé•°Q…Í…ËÅ´Q…±•Á±•É¤ð½ˆøñÍÁ…¸ù½½±”M¡••ÑÌƒŠHÕÍÑ½µ=É‘•ÉÌƒ
Ü·ó}Ñ•É¥±•É¥¸ŸÙ¹‘•É‘§}¤™½Ñ¿}É…™±…ÈÙ”Ñ…±•Á±•Èð½ÍÁ…¸øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ¥±Ñ•ÉÌˆùílSñ·ðœ°€¸¸¹UMQ=5}MQQUMMt¹µ…À¡ÍÑ…ÑÕÌ€ôø€ñ‰ÕÑÑ½¸­•äõíÍÑ…ÑÕÍô±…ÍÍ9…µ”õíÕÍÑ½µ¥±Ñ•È€ôôôÍÑ…ÑÕÌ€ü€¡¥À…Ñ¥Ù”œ€è€¡¥Àô½¹±¥¬õì ¤€ôøÍ•ÑÕÍÑ½µ¥±Ñ•È¡ÍÑ…ÑÕÌ¥ôùíÍÑ…ÑÕÍôð½‰ÕÑÑ½¸ø¥ôð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ…É‘Ìˆùí™¥±Ñ•É•‘ÕÍÑ½´¹±•¹Ñ €ü™¥±Ñ•É•‘ÕÍÑ½´¹µ…À¡½É‘•È€ôø€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰ÕÍÑ½µ=É‘•É…Éˆ­•äõí½É‘•È¹É•ÅÕ•ÍÑ9½ô½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•‘ÕÍÑ½´¡½É‘•È¥ôøñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ=É‘•ÉQ½Àˆøñ‘¥Øøñˆùí½É‘•È¹É•ÅÕ•ÍÑ9½ôð½ˆøñÍµ…±°ùí¹•Ü…Ñ”¡½É‘•È¹‘…Ñ”¤¹Ñ½1½…±•MÑÉ¥¹œ ÑÈµQHœ¥ôð½Íµ…±°øð½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰ÍÑ…ÑÕÌˆùí½É‘•È¹ÍÑ…ÑÕÍôð½ÍÁ…¸øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ=É‘•É	½‘äˆøñ‘¥Øøñˆùí½É‘•È¹¹…µ•ôð½ˆøñÍµ…±°ùí½É‘•È¹Á¡½¹”ñð½É‘•È¹•µ…¥°ñð€ŸÁ±•Ñ§}¥´å½¬ôð½Íµ…±°øñÀùí½É‘•È¹‘•Ñ…¥±Íôð½ÀøñÍµ…±°ûY³Ÿðèí½É‘•È¹‘¥µ•¹Í¥½¹Ìñð€œ´ôƒ
ÜI•¹¬èí½É‘•È¹½±½Èñð€œ´ôƒ
Ü‘•Ðèí½É‘•È¹ÅÕ…¹Ñ¥Ñåôð½Íµ…±°øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µQ¡Õµ‰Ìˆùí½É‘•È¹¥µ…•Ìü¹Í±¥” À°€Ì¤¹µ…À ¡ÕÉ°°¥¹‘•à¤€ôø€ñ¥µœ­•äõíÕÉ±ôÍÉŒõíÕÉ±ô…±ÐõíI•™•É…¹Ì€‘í¥¹‘•à€¬€Åõô€¼ø¥õí½É‘•È¹¥µ…•Ìü¹±•¹Ñ €ø€Ì€˜˜€ñÍÁ…¸ø­í½É‘•È¹¥µ…•Ì¹±•¹Ñ €´€Íôð½ÍÁ…¸ùôð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ=É‘•ÉÑ¥½¹ÌˆøñÍ•±•Ð±…ÍÍ9…µ”ô‰ÍÑ…ÑÕÍM•±•ÐˆÙ…±Õ”õí½É‘•È¹ÍÑ…ÑÕÍô½¹±¥¬õí•Ù•¹Ð€ôø•Ù•¹Ð¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¥ô½¹¡…¹”õí•Ù•¹Ð€ôøì•Ù•¹Ð¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ìÕÁ‘…Ñ•ÕÍÑ½´¡½É‘•È°•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¤ìõôùíUMQ=5}MQQUML¹µ…À¡ÍÑ…ÑÕÌ€ôø€ñ½ÁÑ¥½¸­•äõíÍÑ…ÑÕÍôùíÍÑ…ÑÕÍôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðùí½É‘•È¹Á¡½¹”€˜˜€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½ÍÐÍµ…±±	Ñ¸ˆ½¹±¥¬õí•Ù•¹Ð€ôøì•Ù•¹Ð¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ìÕÍÑ½µ]¡…ÑÍÁÀ¡½É‘•È¤ìõôù]¡…ÑÍÁÀð½‰ÕÑÑ½¸ùôð½‘¥Øøð½…ÉÑ¥±”ø¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäˆù	Ô™¥±ÑÉ•‘”ƒÙé•°Ñ…Í…ËÅ´Ñ…±•‰¤å½¬¸ð½‘¥Øùôð½‘¥Øøð½Í•Ñ¥½¸ø((€€€€€íÍ•±•Ñ•‘ÕÍÑ½´€˜˜€ (€€€€€€€€ñ5½‘…°Ñ¥Ñ±”õíƒYé•°Q…±•À€‘íÍ•±•Ñ•‘ÕÍÑ½´¹É•ÅÕ•ÍÑ9½õô±½Í”õì ¤€ôøÍ•ÑM•±•Ñ•‘ÕÍÑ½´¡¹Õ±°¥ôÝ¥‘”ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ•Ñ…¥°ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ•Ñ…¥±É¥ˆøñ‘¥Øøñˆù7ó}Ñ•É¤ð½ˆøñÍÁ…¸ùíÍ•±•Ñ•‘ÕÍÑ½´¹¹…µ•ôð½ÍÁ…¸øð½‘¥Øøñ‘¥ØøñˆùQ•±•™½¸ð½ˆøñÍÁ…¸ùíÍ•±•Ñ•‘ÕÍÑ½´¹Á¡½¹”ñð€œ´ôð½ÍÁ…¸øð½‘¥Øøñ‘¥ØøñˆùµÁ½ÍÑ„ð½ˆøñÍÁ…¸ùíÍ•±•Ñ•‘ÕÍÑ½´¹•µ…¥°ñð€œ´ôð½ÍÁ…¸øð½‘¥Øøñ‘¥Øøñˆù‘•Ðð½ˆøñÍÁ…¸ùíÍ•±•Ñ•‘ÕÍÑ½´¹ÅÕ…¹Ñ¥Ñåôð½ÍÁ…¸øð½‘¥Øøñ‘¥ØøñˆûY³Ÿðð½ˆøñÍÁ…¸ùíÍ•±•Ñ•‘ÕÍÑ½´¹‘¥µ•¹Í¥½¹Ìñð€œ´ôð½ÍÁ…¸øð½‘¥Øøñ‘¥ØøñˆùI•¹¬€¼5…±é•µ”ð½ˆøñÍÁ…¸ùíÍ•±•Ñ•‘ÕÍÑ½´¹½±½Èñð€œ´ôð½ÍÁ…¸øð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ•Ñ…¥±Q•áÐˆøñˆùAÉ½©”•Ñ…çÄð½ˆøñÀùíÍ•±•Ñ•‘ÕÍÑ½´¹‘•Ñ…¥±Íôð½ÀùíÍ•±•Ñ•‘ÕÍÑ½´¹¹½Ñ”€˜˜€ðøñˆù9½Ðð½ˆøñÀùíÍ•±•Ñ•‘ÕÍÑ½´¹¹½Ñ•ôð½Àøð¼ùôð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ%µ…•ÌˆùíÍ•±•Ñ•‘ÕÍÑ½´¹¥µ…•Ìü¹µ…À ¡ÕÉ°°¥¹‘•à¤€ôø€ñ„­•äõíÕÉ±ô¡É•˜õíÕÉ±ôÑ…É•Ðô‰}‰±…¹¬ˆÉ•°ô‰¹½É•™•ÉÉ•Èˆøñ¥µœÍÉŒõíÕÉ±ô…±ÐõíƒYé•°Ñ…Í…ËÅ´€‘í¥¹‘•à€¬€Åõô€¼øð½„ø¥ôð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÑÝ¼ˆøñ±…‰•°ùÕÉÕ´ñÍ•±•ÐÙ…±Õ”õíÍ•±•Ñ•‘ÕÍÑ½´¹ÍÑ…ÑÕÍô½¹¡…¹”õí•Ù•¹Ð€ôøÕÁ‘…Ñ•ÕÍÑ½´¡Í•±•Ñ•‘ÕÍÑ½´°•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”°Í•±•Ñ•‘ÕÍÑ½´¹ÅÕ½Ñ”¥ôùíUMQ=5}MQQUML¹µ…À¡ÍÑ…ÑÕÌ€ôø€ñ½ÁÑ¥½¸­•äõíÍÑ…ÑÕÍôùíÍÑ…ÑÕÍôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðøð½±…‰•°øñ¥•±±…‰•°ô‰Q•­±¥˜€¡Q0¤ˆÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÙ…±Õ”õíÍ•±•Ñ•‘ÕÍÑ½´¹ÅÕ½Ñ”ñð€œô½¹¡…¹”õí•Ù•¹Ð€ôøÍ•ÑM•±•Ñ•‘ÕÍÑ½´¡ì€¸¸¹Í•±•Ñ•‘ÕÍÑ½´°ÅÕ½Ñ”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ô€¼øð½‘¥Øø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éä™Õ±°ˆ½¹±¥¬õì ¤€ôøÕÁ‘…Ñ•ÕÍÑ½´¡Í•±•Ñ•‘ÕÍÑ½´°Í•±•Ñ•‘ÕÍÑ½´¹ÍÑ…ÑÕÌ°Í•±•Ñ•‘ÕÍÑ½´¹ÅÕ½Ñ”¥ôù—}§}¥­±¥­±•É¤-…å‘•Ðð½‰ÕÑÑ½¸ø(€€€€€€€€€€€íÍ•±•Ñ•‘ÕÍÑ½´¹Á¡½¹”€˜˜€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½ÍÐ™Õ±°ˆ½¹±¥¬õì ¤€ôøÕÍÑ½µ]¡…ÑÍÁÀ¡Í•±•Ñ•‘ÕÍÑ½´¥ôù]¡…ÑÍÁÀ¥±”	¥±¥±•¹‘¥Èð½‰ÕÑÑ½¸ùô(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½5½‘…°ø(€€€€€€¥ô(€€€€ð½µ…¥¸ø(€€¤ì)ô()É•…Ñ•I½½Ð¡‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% É½½Ðœ¤¤¹É•¹‘•È (€M%Q}=A8€ü€ñÁÀ€¼ø€è€ñ5…¥¹Ñ•¹…¹•A…”€¼ø(¤ì(