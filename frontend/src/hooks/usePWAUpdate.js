import { useEffect, useState, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Helper to detect if running as PWA
const isPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
};

export function usePWAUpdate() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const swRegistrationRef = useRef(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
      swRegistrationRef.current = r;
      // Check for updates immediately on load
      if (r) {
        r.update();
        // Then check for updates every hour
        setInterval(() => {
          console.log('Checking for SW updates...');
          r.update();
        }, 3600000); // 1 hour
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Check if this is a new version on app load (for changelog)
  useEffect(() => {
    const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
    const lastSeenVersion = localStorage.getItem('lastSeenVersion');
    const changelogShownThisSession = sessionStorage.getItem('changelogShown');
    const runningAsPWA = isPWA();
    
    console.log('📦 Version check:', { 
      currentVersion, 
      lastSeenVersion, 
      changelogShownThisSession,
      isPWA: runningAsPWA,
      userAgent: navigator.userAgent.substring(0, 50)
    });

    // Delay check slightly on mobile/PWA to ensure localStorage is ready
    const checkDelay = runningAsPWA ? 500 : 0;
    
    setTimeout(() => {
      if (lastSeenVersion && lastSeenVersion !== currentVersion && !changelogShownThisSession) {
        // New version detected, show changelog
        console.log('🎉 New version detected! Showing changelog...');
        setShowChangelog(true);
        localStorage.setItem('lastSeenVersion', currentVersion);
        sessionStorage.setItem('changelogShown', 'true');
      } else if (!lastSeenVersion) {
        // First time user
        console.log('👋 First time user, saving version');
        localStorage.setItem('lastSeenVersion', currentVersion);
      } else {
        console.log('✅ Version unchanged or changelog already shown this session');
      }
    }, checkDelay);
  }, []);

  // Show update modal when SW has new content
  useEffect(() => {
    if (needRefresh) {
      console.log('🔄 Service worker has new content, showing update modal');
      setShowUpdateModal(true);
    }
  }, [needRefresh]);

  const updateNow = () => {
    updateServiceWorker(true);
    setShowUpdateModal(false);
  };

  const dismissUpdate = () => {
    setNeedRefresh(false);
    setShowUpdateModal(false);
  };

  const dismissChangelog = () => {
    setShowChangelog(false);
  };

  // Manual update check function
  const checkForUpdate = async () => {
    return new Promise((resolve) => {
      if (swRegistrationRef.current) {
        console.log('🔍 Manual update check triggered');
        swRegistrationRef.current.update();
        
        // Wait a bit to see if update is found
        setTimeout(() => {
          resolve(needRefresh);
        }, 2000);
      } else {
        console.log('⚠️ No service worker registration found');
        resolve(false);
      }
    });
  };

  return {
    showUpdateModal,
    showChangelog,
    updateNow,
    dismissUpdate,
    dismissChangelog,
    checkForUpdate,
  };
}
