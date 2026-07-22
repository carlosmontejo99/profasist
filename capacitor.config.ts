import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carlos.profasist',
  appName: 'ProfAsist',
  webDir: 'dist',
  server: {
    allowNavigation: ['*.google.com']
  }
};

export default config;
