import { google } from 'googleapis';

const PRODUCTS = 'Products';
const ORDERS = 'Orders';
const PRODUCT_HEADERS = ['id','urun','kategori','fiyat','stok','gorsel','aciklama','aktif','olusturma_tarihi'];
const ORDER_HEADERS = ['siparis_no','tarih','musteri','telefon','email','adres','not','urunler','toplam','durum','yapilandirma_json'];
const CUSTOM_ORDERS = 'CustomOrders';
const CUSTOM_HEADERS = ['talep_no','tarih','musteri','telefon','email','aciklama','olcu','renk','adet','gorseller','durum','teklif','not'];

function client() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Google service account env eksik.');
  const auth = new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: key }, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}
function id() { return crypto.randomUUID(); }

function safeCell(value, max = 2500) {
  const text = String(value ?? '').trim().slice(0, max);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
function columnName(n) {
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
async function ensureSheet(sheets, title, headers) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID });
  const exists = meta.data.sheets?.some(s => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: process.env.GOOGLE_SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  }
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${title}!A1:${columnName(headers.length)}1` }).catch(() => ({ data: {} }));
  const currentHeaders = r.data.values?.[0] || [];
  if (headers.some((header, index) => currentHeaders[index] !== header)) {
    await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${title}!A1:${columnName(headers.length)}1`, valueInputOption: 'RAW', requestBody: { values: [headers] } });
  }
}
export async function getProducts() {
  const sheets = client();
  await ensureSheet(sheets, PRODUCTS, PRODUCT_HEADERS);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${PRODUCTS}!A2:I` });
  return (r.data.values || []).filter(row => row[0]).map(row => ({ id: row[0], name: row[1] || '', category: row[2] || 'Diğer', price: Number(row[3] || 0), stock: Number(row[4] ?? 0), image: row[5] || '', description: row[6] || '', active: row[7] !== 'false', createdAt: row[8] || '' })).filter(p => p.active);
}
async function allProductRows() {
  const sheets = client();
  await ensureSheet(sheets, PRODUCTS, PRODUCT_HEADERS);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${PRODUCTS}!A2:I` });
  return { sheets, rows: r.data.values || [] };
}
export async function createProduct(p) {
  const { sheets } = await allProductRows();
  const row = [id(), p.name, p.category, Number(p.price), Number(p.stock), p.image, p.description || '', 'true', new Date().toISOString()];
  await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${PRODUCTS}!A:I`, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
  return row;
}
export async function updateProduct(productId, p) {
  const { sheets, rows } = await allProductRows();
  const idx = rows.findIndex(r => r[0] === productId);
  if (idx < 0) throw new Error('NOT_FOUND');
  const rowNo = idx + 2;
  const row = [productId, p.name, p.category, Number(p.price), Number(p.stock), p.image, p.description || '', String(p.active !== false), rows[idx][8] || new Date().toISOString()];
  await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${PRODUCTS}!A${rowNo}:I${rowNo}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
  return row;
}
export async function deleteProduct(productId) { return updateProduct(productId, { name:'', category:'', price:0, stock:0, image:'', description:'', active:false }); }
export async function appendOrder(o) {
  const sheets = client();
  await ensureSheet(sheets, ORDERS, ORDER_HEADERS);
  // Üretim yapılandırması saklanır; iş emri STL indirilirken config'ten
  // yeniden üretilir (hücreyi şişirmemek ve bayatlamasını önlemek için).
  const configurations = o.items.filter(item => item.type === 'abajur').map(item => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    summary: item.summary,
    geoSurum: item.geoSurum,
    config: item.config
  }));
  const row = [safeCell(o.orderNo, 120), new Date().toISOString(), safeCell(o.name, 120), safeCell(o.phone, 30), safeCell(o.email || '', 160), safeCell(o.address, 500), safeCell(o.note || '', 500), safeCell(o.items.map(i => `${i.name} x${i.quantity}${i.summary ? ` (${i.summary})` : ''}`).join(' | '), 5000), Number(o.total), 'Yeni', configurations.length ? safeCell(JSON.stringify(configurations), 45000) : ''];
  await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${ORDERS}!A:K`, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
  return row;
}
export async function getDashboard() {
  const sheets = client();
  await ensureSheet(sheets, ORDERS, ORDER_HEADERS);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${ORDERS}!A2:J` });
  const rows = r.data.values || [];
  const activeRows = rows.filter(r => (r[9] || 'Yeni') !== 'İptal');
  const totalRevenue = activeRows.reduce((s,r) => s + Number(r[8] || 0), 0);
  const today = new Date().toISOString().slice(0,10);
  const todayOrders = rows.filter(r => String(r[1] || '').slice(0,10) === today).length;
  const month = today.slice(0,7);
  const monthOrders = rows.filter(r => String(r[1] || '').slice(0,7) === month);
  return { totalOrders: rows.length, todayOrders, monthOrders: monthOrders.length, totalRevenue, monthRevenue: monthOrders.filter(r => (r[9] || 'Yeni') !== 'İptal').reduce((s,r)=>s+Number(r[8]||0),0), pending: rows.filter(r => ['Yeni','Ödeme Bekleniyor','Ödeme Alındı','Onaylandı','Hazırlanıyor','Kargoya Hazır'].includes(r[9] || 'Yeni')).length,
    bekleyenTahsilat: rows.filter(r => ['Yeni','Ödeme Bekleniyor'].includes(r[9] || 'Yeni')).reduce((s,r)=>s+Number(r[8]||0),0) };
}
export async function getOrders() {
  const sheets = client();
  await ensureSheet(sheets, ORDERS, ORDER_HEADERS);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${ORDERS}!A2:K` });
  return (r.data.values || []).reverse().slice(0,100).map(r => {
    let configurations = [];
    try { configurations = r[10] ? JSON.parse(String(r[10]).replace(/^'/, '')) : []; } catch { configurations = []; }
    return { orderNo:r[0], date:r[1], name:r[2], phone:r[3], email:r[4], address:r[5], note:r[6], items:r[7], total:Number(r[8]||0), status:r[9]||'Yeni', configurations };
  });
}

export async function getOrder(orderNo) {
  const sheets = client();
  await ensureSheet(sheets, ORDERS, ORDER_HEADERS);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${ORDERS}!A2:K` });
  const row = (r.data.values || []).find(candidate => candidate[0] === orderNo);
  if (!row) throw new Error('NOT_FOUND');
  let configurations = [];
  try { configurations = row[10] ? JSON.parse(String(row[10]).replace(/^'/, '')) : []; } catch { configurations = []; }
  return {
    orderNo: row[0], date: row[1], name: row[2], phone: row[3], email: row[4],
    address: row[5], note: row[6], items: row[7], total: Number(row[8] || 0),
    status: row[9] || 'Yeni', configurations
  };
}

export async function updateOrderStatus(orderNo, status) {
  const allowed = ['Yeni','Ödeme Bekleniyor','Ödeme Alındı','Onaylandı','Hazırlanıyor','Kargoya Hazır','Kargolandı','Tamamlandı','İptal'];
  if (!allowed.includes(status)) throw new Error('GEÇERSİZ_DURUM');
  const sheets = client();
  await ensureSheet(sheets, ORDERS, ORDER_HEADERS);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${ORDERS}!A2:K` });
  const rows = r.data.values || [];
  const idx = rows.findIndex(row => row[0] === orderNo);
  if (idx < 0) throw new Error('NOT_FOUND');
  const previousStatus = rows[idx][9] || 'Yeni';
  const rowNo = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${ORDERS}!J${rowNo}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] }
  });
  return {
    orderNo,
    status,
    previousStatus,
    name: rows[idx][2] || '',
    phone: rows[idx][3] || '',
    email: rows[idx][4] || '',
    address: rows[idx][5] || '',
    items: rows[idx][7] || '',
    total: Number(rows[idx][8] || 0)
  };
}


export async function appendCustomOrder(o) {
  const sheets = client();
  await ensureSheet(sheets, CUSTOM_ORDERS, CUSTOM_HEADERS);
  const row = [
    safeCell(o.requestNo, 120), new Date().toISOString(), safeCell(o.name, 120), safeCell(o.phone || '', 30), safeCell(o.email || '', 160),
    safeCell(o.details || '', 2500), safeCell(o.dimensions || '', 160), safeCell(o.color || '', 160), Number(o.quantity || 1),
    safeCell(Array.isArray(o.images) ? o.images.join(' | ') : '', 5000), 'Yeni', '', safeCell(o.note || '', 1000)
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${CUSTOM_ORDERS}!A:M`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
  return row;
}

export async function getCustomOrders() {
  const sheets = client();
  await ensureSheet(sheets, CUSTOM_ORDERS, CUSTOM_HEADERS);
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${CUSTOM_ORDERS}!A2:M`
  });
  return (r.data.values || []).reverse().slice(0, 100).map(r => ({
    requestNo: r[0], date: r[1], name: r[2], phone: r[3], email: r[4],
    details: r[5], dimensions: r[6], color: r[7], quantity: Number(r[8] || 1),
    images: r[9] ? r[9].split(' | ').filter(Boolean) : [],
    status: r[10] || 'Yeni', quote: r[11] || '', note: r[12] || ''
  }));
}

export async function updateCustomOrderStatus(requestNo, status, quote) {
  const allowed = ['Yeni','İnceleniyor','Fiyat Verildi','Onaylandı','Üretimde','Tamamlandı','İptal'];
  if (!allowed.includes(status)) throw new Error('GEÇERSİZ_DURUM');
  const sheets = client();
  await ensureSheet(sheets, CUSTOM_ORDERS, CUSTOM_HEADERS);
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${CUSTOM_ORDERS}!A2:M`
  });
  const rows = r.data.values || [];
  const idx = rows.findIndex(row => row[0] === requestNo);
  if (idx < 0) throw new Error('NOT_FOUND');
  const rowNo = idx + 2;
  const updates = [{ range: `${CUSTOM_ORDERS}!K${rowNo}`, values: [[status]] }];
  if (quote !== undefined) updates.push({ range: `${CUSTOM_ORDERS}!L${rowNo}`, values: [[quote]] });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
  });
  return {
    requestNo, status, quote: quote !== undefined ? quote : (rows[idx][11] || ''),
    name: rows[idx][2] || '', phone: rows[idx][3] || '', email: rows[idx][4] || '',
    images: rows[idx][9] ? rows[idx][9].split(' | ').filter(Boolean) : []
  };
}
