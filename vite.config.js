import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const kok = dirname(fileURLToPath(import.meta.url));

/**
 * Yerel geliştirmede api/ klasöründeki Vercel fonksiyonlarını çalıştırır.
 *
 * Vite tek başına yalnızca statik dosyaları sunar; bu köprü olmadan
 * /api/* istekleri index.html döner ve sepet, fiyat doğrulama, admin
 * paneli yerelde denenemez. Yalnızca `vite dev` sırasında devreye girer —
 * üretim derlemesini ve Vercel'deki davranışı etkilemez.
 *
 * Google Sheets kullanan uçlar (ürün, sipariş, dashboard) ilgili
 * environment değişkenleri yoksa hata döner; bu beklenen davranıştır.
 * /api/abajur-price hiçbir ayar gerektirmez, doğrudan çalışır.
 */
function yerelApi() {
  return {
    name: 'umera-yerel-api',
    apply: 'serve',
    configureServer(server) {
      const uclar = new Set(
        readdirSync(resolve(kok, 'api'))
          .filter((f) => f.endsWith('.js'))
          .map((f) => f.replace(/\.js$/, ''))
      );

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();

        const ad = url.pathname.slice(5).replace(/\/$/, '');
        if (!uclar.has(ad)) return next();

        try {
          const modul = await server.ssrLoadModule(`/api/${ad}.js`);
          const handler = modul.default;

          // Vercel'in req.body / res.json davranışını taklit et
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            const parcalar = [];
            for await (const p of req) parcalar.push(p);
            const ham = Buffer.concat(parcalar).toString('utf8');
            try {
              req.body = ham ? JSON.parse(ham) : {};
            } catch {
              req.body = {};
            }
          }
          req.query = Object.fromEntries(url.searchParams);

          res.status = (kod) => { res.statusCode = kod; return res; };
          res.json = (veri) => {
            if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(veri));
            return res;
          };
          res.send = (veri) => { res.end(veri); return res; };

          await handler(req, res);
        } catch (hata) {
          server.config.logger.error(`[yerel-api] /api/${ad}: ${hata.stack || hata.message}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          res.end(JSON.stringify({ error: hata.message || 'Yerel API hatası.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), yerelApi()],
  build: { outDir: 'dist' }
});
