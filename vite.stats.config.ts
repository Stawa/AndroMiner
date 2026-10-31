import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Separate build so the public dashboard is never bundled into the Android app.
export default defineConfig({
  plugins: [vue()],
  define: { __APP_VARIANT__: JSON.stringify('web'), __APP_VERSION__: JSON.stringify('stats') },
  build: {
    target: 'es2020',
    outDir: 'dist-stats',
    emptyOutDir: true,
    rollupOptions: { input: 'stats.html' }
  }
});
