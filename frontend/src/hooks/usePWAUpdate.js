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
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Check if this is a new version on app load
  useEffect(() => {
    const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
    const lastSeenVersion = localStorage.getItem('lastSeenVersion');

    if (lastSeenVersion && lastSeenVersion !== currentVersion) {
      // New version detected, show changelog
      setShowChangelog(true);
      localStorage.setItem('lastSeenVersion', currentVersion);
    } else if (!lastSeenVersion) {
      // First time user
      localStorage.setItem('lastSeenVersion', currentVersion);
    }
  }, []);

  // Show update modal when SW has new content
  useEffect(() => {
    if (needRefresh) {
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
