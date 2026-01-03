import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ghassicloud.app',
  appName: 'GhassiCloud',
  webDir: 'dist',
  server: {
    // For development, you can point to your local server
    // url: 'http://YOUR_LOCAL_IP:3000',
    // cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f172a'
  },
  ios: {
    backgroundColor: '#0f172a',
    contentInset: 'automatic'
  }
};

export default config;
