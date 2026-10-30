import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.androminer.app',
  appName: 'AndroMiner',
  webDir: 'dist',
  android: {
    backgroundColor: '#11171c'
  },
  plugins: { SystemBars: { style: 'DARK', insetsHandling: 'css' } }
};

export default config;
