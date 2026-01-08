import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
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
    
    console.log('📦 Version check:', { currentVersion, lastSeenVersion });

    if (lastSeenVersion && lastSeenVersion !== currentVersion) {
      // New version detected, show changelog
      console.log('🎉 New version detected! Showing changelog...');
      setShowChangelog(true);
      localStorage.setItem('lastSeenVersion', currentVersion);
    } else if (!lastSeenVersion) {
      // First time user
      console.log('👋 First time user, saving version');
      localStorage.setItem('lastSeenVersion', currentVersion);
    } else {
      console.log('✅ Version unchanged');
    }
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

  return {
    showUpdateModal,
    showChangelog,
    updateNow,
    dismissUpdate,
    dismissChangelog,
  };
}
