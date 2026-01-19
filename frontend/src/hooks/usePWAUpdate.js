import { useEffect, useState, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import logger from '../logger'

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
      logger.info('SW Registered:', r);
      swRegistrationRef.current = r;
      if (r) {
        r.update();
        setInterval(() => {
          logger.info('Checking for SW updates...');
          r.update();
        }, 3600000); // 1 hour
      }
    },
    onRegisterError(error) {
      logger.error('SW registration error', error);
    },
  });

  useEffect(() => {
    const currentVersion = import.meta.env.VITE_APP_VERSION || '1.6.0';
    const lastSeenVersion = localStorage.getItem('lastSeenVersion');
    const changelogShownThisSession = sessionStorage.getItem('changelogShown');
    const runningAsPWA = isPWA();

    logger.info('📦 Version check:', {
      currentVersion,
      lastSeenVersion,
      changelogShownThisSession,
      isPWA: runningAsPWA,
      userAgent: navigator.userAgent.substring(0, 50)
    });

    const checkDelay = runningAsPWA ? 500 : 0;

    setTimeout(() => {
      if (lastSeenVersion && lastSeenVersion !== currentVersion && !changelogShownThisSession) {
        logger.info('🎉 New version detected! Showing changelog...');
        setShowChangelog(true);
        localStorage.setItem('lastSeenVersion', currentVersion);
        sessionStorage.setItem('changelogShown', 'true');
      } else if (!lastSeenVersion) {
        logger.info('👋 First time user, saving version');
        localStorage.setItem('lastSeenVersion', currentVersion);
      } else {
        logger.info('✅ Version unchanged or changelog already shown this session');
      }
    }, checkDelay);
  }, []);

  useEffect(() => {
    if (needRefresh) {
      logger.info('🔄 Service worker has new content, showing update modal');
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

  const checkForUpdate = async () => {
    return new Promise((resolve) => {
      if (swRegistrationRef.current) {
        logger.info('🔍 Manual update check triggered');
        swRegistrationRef.current.update();

        setTimeout(() => {
          resolve(needRefresh);
        }, 2000);
      } else {
        logger.warn('⚠️ No service worker registration found');
        resolve(false);
      }
    });
  };

  const forceRefresh = async () => {
    logger.info('🔄 Force refresh triggered');

    const token = localStorage.getItem('ghassicloud-token');
    const user = localStorage.getItem('ghassicloud-user');

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        logger.info('✅ Service worker unregistered');
      }
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      logger.info('✅ All caches cleared');
    }

    const itemsToPreserve = {
      'ghassicloud-token': token,
      'ghassicloud-user': user,
    };
    localStorage.clear();
    Object.entries(itemsToPreserve).forEach(([key, value]) => {
      if (value) localStorage.setItem(key, value);
    });

    window.location.reload(true);
  };

  return {
    showUpdateModal,
    showChangelog,
    updateNow,
    dismissUpdate,
    dismissChangelog,
    checkForUpdate,
    forceRefresh,
  };
}
