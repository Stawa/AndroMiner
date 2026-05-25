import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const gradleBuildFile = path.join(rootDir, 'android', 'app', 'build.gradle');

const readGradleVersionName = (): string => {
  const gradleBuild = fs.readFileSync(gradleBuildFile, 'utf8');
  const versionNameMatch = gradleBuild.match(
    /versionName\s+(?:versionNameOverride\s*\?:\s*)?["']([^"']+)["']/
  );
  return versionNameMatch?.[1] ?? '1.0';
};

const appVersion = process.env.VITE_APP_VERSION || readGradleVersionName();
const appVariant = process.env.VITE_APP_VARIANT || 'download';

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VARIANT__: JSON.stringify(appVariant),
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true
  }
});
