import { requireAdmin } from '../lib/auth.js';
import { getDashboard, getOrders, getCustomOrders } from '../lib/sheets.js';
import { odemeBilgisi } from '../lib/odeme.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method === 'GET') {
      return res.json({
        stats: await getDashboard(),
        orders: await getOrders(),
        customOrders: await getCustomOrders(),
        // Yönetici panelindeki "Ödeme bilgisi gönder" bunu kullanıyor;
        // ayarlanmamışsa panel uyarı gösterir.
        odeme: odemeBilgisi()
      });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    res.status(e.message === 'UNAUTHORIZED' ? 401 : 500).json({
      error: e.message === 'UNAUTHORIZED' ? 'Yetkisiz erişim.' : 'Dashboard alınamadı.'
    });
  }
}
