import React from 'react';
import { X, Sparkles } from 'lucide-react';

// 🎯 Update this changelog whenever you release a new version
const CHANGELOG = {
  '1.5.0': {
    date: 'January 15, 2026',
    changes: [
      'Update Dockerfile to use Node 22 LTS for compatibility and adjust CSS class selector for stats-trend',
    ],
  },
  '1.4.11': {
    date: 'January 15, 2026',
    changes: [
      'Ensure mobile header is hidden on wide screens and improve role select width on mobile settings',
    ],
  },
  '1.4.10': {
    date: 'January 15, 2026',
    changes: [
      'Enhance session expiration warning with error handling and countdown suppression during session extension',
      'Enhance PWA experience by disabling back swipe on mobile, improve haptic feedback handling, and optimize reporting styles for small screens',
      'feat: Improve user management table layout for better mobile responsiveness and accessibility',
    ],
  },
  '1.4.9': {
    date: 'January 14, 2026',
    changes: [
      'Backend Changes',
    ],
  },
  '1.4.8': {
    date: 'January 13, 2026',
    changes: [
      'Enhance F5/Ctrl+R reload confirmation for installed desktop PWAs with active webview overlay check',
    ],
  },
  '1.4.7': {
    date: 'January 13, 2026',
    changes: [
      'Refactor WebViewModal to improve iframe handling and overlay visibility logic',
    ],
  },
  '1.4.6': {
    date: 'January 13, 2026',
    changes: [
      'Update German localization with enhanced welcome message and add make-admin script for user role management',
    ],
  },
  '1.4.5': {
    date: 'January 13, 2026',
    changes: [
      'Improve background scrolling lock logic in WebViewModal and enhance dashboard styles for better layout and alignment',
    ],
  },
  '1.4.4': {
    date: 'January 13, 2026',
    changes: [
      'Improve background scrolling behavior for installed desktop PWAs by locking overflow only when overlay is visible',
    ],
  },
  '1.4.3': {
    date: 'January 13, 2026',
    changes: [
      'Enhance PWA behavior by adding conditions for reload confirmation and background scrolling prevention',
    ],
  },
  '1.4.2': {
    date: 'January 13, 2026',
    changes: [
      'Add refresh confirmation dialog before reloading the app',
      'enhance webview context with clearAllWebviews function',
      'and update localization for refresh confirmation messages',
    ],
  },
  '1.4.1': {
    date: 'January 13, 2026',
    changes: [
      'Enhance webview functionality with minimize, maximize, and restore features',
      'add close confirmation',
      'improve localization for webview actions',
    ],
  },
  '1.4.0': {
    date: 'January 12, 2026',
    changes: [
      'Enhance authentication UI and add SSO registration flow, update localization for multiple languages',
    ],
  },
  '1.3.0': {
    date: 'January 12, 2026',
    changes: [
      'Enhance login functionality to support Keycloak SSO',
      'Restrict SSO editor access to admin users in settings',
    ],
  },
  '1.2.5': {
    date: 'January 12, 2026',
    changes: [
      'Add admin settings for PWA DevTools',
    ],
  },
  '1.2.4': {
    date: 'January 10, 2026',
    changes: [
      'adapted bump-version script',
    ],
  },
  '1.2.3': {
    date: 'January 10, 2026',
    changes: [
      'Add isMobile detection to improve link handling in PWAs and update dependencies',
    ],
  },
  '1.2.2': {
    date: 'January 9, 2026',
    changes: [
      'Implement webview functionality for PWA',
      'add WebViewModal and WebviewContext',
      'update routing and links',
    ],
  },
  '1.2.1': {
    date: 'January 9, 2026',
    changes: [
      'feat: Update useSSOSessionMonitor to include refreshTimeoutMs and refreshCooldownMs parameters',
    ],
  },
  '1.2.0': {
    date: 'January 9, 2026',
    changes: [
      'feat(locales): update French and Russian translations for improved clarity and consistency',
      'feat(settings): add sync preferences toggle and reset defaults functionality in settings page',
      'fix(SSOCallback): prevent auto-application of server preferences on SSO redirect login',
      'chore(package): bump frontend version to 1.1.13 and remove unused @capacitor/android dependency',
    ],
  },
  '1.1.13': {
    date: 'January 9, 2026',
    changes: [
      'Integrate user authentication in NowPlayingCard, update username handling on user change',
    ],
  },
  '1.1.12': {
    date: 'January 8, 2026',
    changes: [
      'Remove Android native app support and associated resources',
      'Deleted all Android resource files including icons, splash screens, and layout files.',
      'Removed Android-specific Gradle files and configurations.',
      'Updated icon generation script to reflect the removal of Android support.',
      'Cleaned up package.json by removing Android-related commands and dependencies.',
    ],
  },
  '1.1.11': {
    date: 'January 8, 2026',
    changes: [
      'Implement force refresh functionality',
      'Update localization for refresh prompts',
    ],
  },
  '1.1.10': {
    date: 'January 8, 2026',
    changes: [
      'Add androidSpinnerStyle to SplashScreen configuration',
    ],
  },
  '1.1.9': {
    date: 'January 8, 2026',
    changes: [
      'Enhance user experience by conditionally displaying changelog for logged-in users',
      'Improve PWA update handling',
    ],
  },
  '1.1.8': {
    date: 'January 8, 2026',
    changes: [
      'Enhance PWA update handling by tracking changelog visibility',
      'Update Vite config to include app version',
    ],
  },
  '1.1.7': {
    date: 'January 8, 2026',
    changes: [
      'Refactor Update Handling',
      'Enhance Localization for Updates',
      'Improve UI consistency for Now Playing',
      'Remove PWA Update Debugger',
    ],
  },
  '1.1.6': {
    date: 'January 8, 2026',
    changes: [
      'Remove extra comma in Vite configuration scope property',
    ],
  },
  '1.1.5': {
    date: 'January 8, 2026',
    changes: [
      'Add update check functionality',
      'Lock screen orientation to portrait',
      'Enhance localization for update messages',
    ],
  },
  '1.1.4': {
    date: 'January 8, 2026',
    changes: [
      'Add offline notification banner',
      'Update localization for offline messages',
    ],
  },
  '1.1.3': {
    date: 'January 8, 2026',
    changes: [
      'Fixed ChangeLog PLUS added current version debugger',
    ],
  },
  '1.1.2': {
    date: 'January 8, 2026',
    changes: [
      'TEST PATCH TEST PATCH 🍉🍉',
    ],
  },
  '1.1.1': {
    date: 'January 8, 2026',
    changes: [
      'TEST PATCH 🍉',
    ],
  },
  '1.1.0': {
    date: 'January 8, 2026',
    changes: [
      'Added automated version management system',
      'PWA update notifications with changelog modal',
      'Version tracking for seamless updates',
    ],
  },
  '1.0.0': {
    date: 'January 8, 2026',
    changes: [
      'Initial release of GhassiCloud',
      'Dashboard with service management',
      'SSO authentication support',
      'Real-time Navidrome integration',
      'Mobile app support via Capacitor',
    ],
  },
  '1.0.1': {
    date: 'January 9, 2026',
    changes: [
      'Added PWA update notifications',
      'Improved session management',
      'Bug fixes and performance improvements',
    ],
  },
  // Add new versions here as you release them
};

export default function ChangelogModal({ onClose }) {
  const currentVersion = import.meta.env.VITE_APP_VERSION || '1.5.0';
  const changelog = CHANGELOG[currentVersion];

  if (!changelog) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--card-bg)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          zIndex: 9999,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          animation: 'scaleIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                backgroundColor: 'var(--accent)',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={24} color="white" />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                }}
              >
                What's New
              </h2>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                }}
              >
                Version {currentVersion}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Date */}
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '16px',
            fontStyle: 'italic',
          }}
        >
          Released on {changelog.date}
        </p>

        {/* Changes List */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {changelog.changes.map((change, index) => (
            <li
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '12px',
                fontSize: '15px',
                color: 'var(--text-primary)',
                lineHeight: '1.5',
              }}
            >
              <span
                style={{
                  color: 'var(--accent)',
                  fontSize: '20px',
                  lineHeight: '1',
                  marginTop: '2px',
                }}
              >
                •
              </span>
              <span>{change}</span>
            </li>
          ))}
        </ul>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            marginTop: '24px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Got it!
        </button>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from {
              transform: translate(-50%, -50%) scale(0.9);
              opacity: 0;
            }
            to {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
}
