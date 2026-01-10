import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';

// Check if running on native platform
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

// Detect if running as an installed PWA (standalone/display modes) or iOS standalone
export function isPWA() {
  try {
    const mm = window.matchMedia
    if (mm) {
      if (mm('(display-mode: standalone)').matches) return true
      if (mm('(display-mode: fullscreen)').matches) return true
      if (mm('(display-mode: minimal-ui)').matches) return true
    }

    // iOS Safari standalone
    try {
      if (window.navigator && window.navigator.standalone === true) return true
    } catch (e) {}

    // Allow forcing PWA mode via query param for testing (e.g. ?pwa=1)
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('pwa') === '1' || url.searchParams.get('standalone') === '1') return true
    } catch (e) {}

    return false
  } catch (e) {
    return false
  }
}

// Detect if running on a mobile device (touch device or small screen). Used to
// avoid opening the in-app WebView for mobile PWAs; instead we open external
// tabs (normal browser behavior) on mobile.
export function isMobile() {
  try {
    const ua = navigator.userAgent || ''
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
    const smallScreen = typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 768
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    return Boolean(mobileUA || touch || smallScreen)
  } catch (e) {
    return false
  }
}

/**
 * Hook to manage the status bar on native platforms
 */
export function useStatusBar() {
  const setStatusBarStyle = useCallback(async (isDark = true) => {
    if (!isNative) return;
    
    try {
      await StatusBar.setStyle({ 
        style: isDark ? Style.Dark : Style.Light 
      });
    } catch (error) {
      console.warn('StatusBar not available:', error);
    }
  }, []);

  const setStatusBarColor = useCallback(async (color) => {
    if (!isNative || platform !== 'android') return;
    
    try {
      await StatusBar.setBackgroundColor({ color });
    } catch (error) {
      console.warn('StatusBar color not available:', error);
    }
  }, []);

  const hideStatusBar = useCallback(async () => {
    if (!isNative) return;
    
    try {
      await StatusBar.hide();
    } catch (error) {
      console.warn('StatusBar hide not available:', error);
    }
  }, []);

  const showStatusBar = useCallback(async () => {
    if (!isNative) return;
    
    try {
      await StatusBar.show();
    } catch (error) {
      console.warn('StatusBar show not available:', error);
    }
  }, []);

  return { setStatusBarStyle, setStatusBarColor, hideStatusBar, showStatusBar };
}

/**
 * Hook to manage the splash screen
 */
export function useSplashScreen() {
  const hideSplash = useCallback(async () => {
    if (!isNative) return;
    
    try {
      await SplashScreen.hide();
    } catch (error) {
      console.warn('SplashScreen not available:', error);
    }
  }, []);

  const showSplash = useCallback(async () => {
    if (!isNative) return;
    
    try {
      await SplashScreen.show({
        autoHide: false
      });
    } catch (error) {
      console.warn('SplashScreen not available:', error);
    }
  }, []);

  return { hideSplash, showSplash };
}

/**
 * Hook for haptic feedback
 */
export function useHaptics() {
  const impact = useCallback(async (style = 'medium') => {
    if (!isNative) return;
    
    try {
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      };
      await Haptics.impact({ style: styleMap[style] || ImpactStyle.Medium });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  const notification = useCallback(async (type = 'success') => {
    if (!isNative) return;
    
    try {
      const typeMap = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error
      };
      await Haptics.notification({ type: typeMap[type] || NotificationType.Success });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  const vibrate = useCallback(async (duration = 300) => {
    if (!isNative) return;
    
    try {
      await Haptics.vibrate({ duration });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  const selectionStart = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionStart();
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  const selectionChanged = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionChanged();
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  const selectionEnd = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionEnd();
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  return { impact, notification, vibrate, selectionStart, selectionChanged, selectionEnd };
}

/**
 * Hook to handle keyboard events on native platforms
 */
export function useNativeKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!isNative) return;

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight);
      setIsKeyboardVisible(true);
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showListener.then(l => l.remove());
      hideListener.then(l => l.remove());
    };
  }, []);

  const hideKeyboard = useCallback(async () => {
    if (!isNative) return;
    try {
      await Keyboard.hide();
    } catch (error) {
      console.warn('Keyboard hide not available:', error);
    }
  }, []);

  return { keyboardHeight, isKeyboardVisible, hideKeyboard };
}

/**
 * Hook to handle app lifecycle events
 */
export function useAppLifecycle(callbacks = {}) {
  const { onResume, onPause, onBackButton } = callbacks;

  useEffect(() => {
    if (!isNative) return;

    const listeners = [];

    if (onResume) {
      listeners.push(App.addListener('resume', onResume));
    }

    if (onPause) {
      listeners.push(App.addListener('pause', onPause));
    }

    if (onBackButton) {
      listeners.push(App.addListener('backButton', onBackButton));
    }

    return () => {
      listeners.forEach(listenerPromise => {
        listenerPromise.then(listener => listener.remove());
      });
    };
  }, [onResume, onPause, onBackButton]);
}

/**
 * Hook to monitor network status
 */
export function useNetwork() {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    // Get initial status
    Network.getStatus().then(status => {
      setIsConnected(status.connected);
      setConnectionType(status.connectionType);
    });

    // Listen for changes
    const listener = Network.addListener('networkStatusChange', (status) => {
      setIsConnected(status.connected);
      setConnectionType(status.connectionType);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  return { isConnected, connectionType };
}

/**
 * Hook to handle safe area insets (notch, etc.)
 */
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  useEffect(() => {
    if (!isNative) {
      // Use CSS env() variables for PWA
      const computeInsets = () => {
        const style = getComputedStyle(document.documentElement);
        setSafeArea({
          top: parseInt(style.getPropertyValue('--sat') || '0', 10),
          bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
          left: parseInt(style.getPropertyValue('--sal') || '0', 10),
          right: parseInt(style.getPropertyValue('--sar') || '0', 10)
        });
      };
      
      computeInsets();
      window.addEventListener('resize', computeInsets);
      return () => window.removeEventListener('resize', computeInsets);
    }
  }, []);

  return safeArea;
}

/**
 * Initialize native features on app start
 */
export async function initializeNativeFeatures(options = {}) {
  const { 
    statusBarColor = '#0f172a',
    statusBarStyle = 'dark',
    hideSplashDelay = 500 
  } = options;

  if (!isNative) return;

  try {
    // Set status bar
    await StatusBar.setStyle({ 
      style: statusBarStyle === 'dark' ? Style.Dark : Style.Light 
    });
    
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: statusBarColor });
    }

    // Hide splash screen after a short delay
    setTimeout(async () => {
      await SplashScreen.hide();
    }, hideSplashDelay);

  } catch (error) {
    console.warn('Error initializing native features:', error);
  }
}

export default {
  isNative,
  platform,
  useStatusBar,
  useSplashScreen,
  useHaptics,
  useNativeKeyboard,
  useAppLifecycle,
  useNetwork,
  useSafeArea,
  initializeNativeFeatures
};
