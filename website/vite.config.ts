import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import type { Connect, Plugin } from 'vite';

// The public website (landing, docs, statistics). Built from this folder, never bundled into the Android app.
// Mirrors the rewrites in vercel.json so `vite` and `vite preview` serve the same routes.
const routes = (): Plugin => {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? '').split('?')[0]!;
    if (path === '/') req.url = '/landing.html';
    else if (path === '/stats') req.url = '/stats.html';
    else if (path === '/privacy' || path === '/terms') req.url = '/legal.html';
    else if (path === '/docs' || path.startsWith('/docs/')) req.url = '/docs.html';
    next();
  };
  return {
    name: 'site-routes',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite)
  };
};

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), routes()],
  define: { __APP_VARIANT__: JSON.stringify('web'), __APP_VERSION__: JSON.stringify('stats') },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: 'landing.html',
        stats: 'stats.html',
        docs: 'docs.html',
        legal: 'legal.html'
      }
    }
  }
});
