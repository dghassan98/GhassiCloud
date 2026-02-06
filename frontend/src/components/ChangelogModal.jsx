import React from 'react';
import { X, Sparkles } from 'lucide-react';

const CHANGELOG = {
  '1.9.3': {
    date: 'February 6, 2026',
    changes: [
      'feat: store idToken in localStorage for improved SSO session management',
    ],
  },
  '1.9.2': {
    date: 'February 6, 2026',
    changes: [
      'feat: implement Keycloak token storage and session refresh for SSO integration',
    ],
  },
  '1.9.1': {
    date: 'February 6, 2026',
    changes: [
      'style: update global CSS variables for dark theme and add new midnight theme',
      'feat: add Portuguese localization file with translations for various app sections',
    ],
  },
  '1.9.0': {
    date: 'February 6, 2026',
    changes: [
      'add Event Spotlight configuration and display on dashboard',
      'added ultra dark and beige theme',
    ],
  },
  '1.8.0': {
    date: 'February 3, 2026',
    changes: [
      'Added Formal Thesis documents',
      'Added entire Appendix',
    ],
  },
  '1.7.2': {
    date: 'February 3, 2026',
    changes: [
      'hide stats cards with placeholder comments in Dashboard component',
    ],
  },
  '1.7.1': {
    date: 'February 3, 2026',
    changes: [
      'Developed test-health.ps1 for health check performance testing, measuring response times for the health endpoint.',
      'Created test-docker.ps1 for monitoring Docker container performance, capturing resource usage over a specified duration.',
      'Developed test-concurrent.ps1 to check concurrent API requests',
    ],
  },
  '1.7.0': {
    date: 'February 2, 2026',
    changes: [
      'Hidden Notifications button',
      'Added Requirements Traceability Matrix',
    ],
  },
  '1.6.3': {
    date: 'January 23, 2026',
    changes: [
      'Enhance login statistics to include SSO and keycloak-related attempts',
    ],
  },
  '1.6.2': {
    date: 'January 22, 2026',
    changes: [
      'update authentication messages for clarity and registration options in multiple languages',
    ],
  },
  '1.6.1': {
    date: 'January 20, 2026',
    changes: [
      'enhance avatar handling in user management by improving placeholder visibility and preventing broken image icons#',
    ],
  },
  '1.6.0': {
    date: 'January 19, 2026',
    changes: [
      'enhance error handling and logging in Settings component',
      'Improved error handling for localStorage operations in syncPreferences toggle.',
      'Added logging for failures when applying server preferences and during user refresh.',
      'Cleaned up comments and improved code readability in the Settings component.',
      'Updated language selection to use a labels object for better maintainability.',
      'Removed unnecessary comments and consolidated related code sections.',
      'build: adjust Vite configuration',
      'Removed commented-out code for manualChunks in Vite config.',
      'Kept the chunkSizeWarningLimit setting for better CI log management',
      'chore: streamline version bump script',
      'Removed unnecessary console outputs and comments in bump-version.js.',
      'Simplified the logic for updating package.json and package-lock.json files.',
      'Enhanced the changelog entry creation process for better clarity and maintainability.',
    ],
  },
  '1.5.12': {
    date: 'January 19, 2026',
    changes: [
      'expose logger globally and update current version in settings',
    ],
  },
  '1.5.11': {
    date: 'January 19, 2026',
    changes: [
      'integrate logging system across scripts and backend',
      'Added a logger utility using pino for structured logging in the backend',
      'Updated various scripts to replace console.log with logger methods for consistent logging.',
      'Enhanced the bump-version script to log version changes and errors using the new logger.',
      'Modified avatar URL check and user role check scripts to utilize the logger for output.',
      'Introduced logging in user column checks and admin role assignment scripts for better traceability.',
      'Ensured all logging is colorized and formatted for improved readability in the console.',
    ],
  },
  '1.5.10': {
    date: 'January 18, 2026',
    changes: [
      'Enhance iframe functionality to allow modals/print popups',
    ],
  },
  '1.5.9': {
    date: 'January 18, 2026',
    changes: [
      'Enhance iframe functionality to allow clipboard access and downloads initiated by user interaction',
    ],
  },
  '1.5.8': {
    date: 'January 18, 2026',
    changes: [
      'Add export and import functionality for user data in JSON and CSV formats',
      'Allow Downloads in PWA',
    ],
  },
  '1.5.7': {
    date: 'January 16, 2026',
    changes: [
      'Remove SSO session behavior preferences from Settings and streamline session management',
    ],
  },
  '1.5.6': {
    date: 'January 16, 2026',
    changes: [
      'Add SSO session behavior preferences for silent refresh and warning suppression',
    ],
  },
  '1.5.5': {
    date: 'January 16, 2026',
    changes: [
      'Improve password change link handling for PWA and mobile responsiveness',
    ],
  },
  '1.5.4': {
    date: 'January 15, 2026',
    changes: [
      'Temporarily remove NowPlayingCard from Dashboard component',
    ],
  },
  '1.5.3': {
    date: 'January 15, 2026',
    changes: [
      'Improve users table layout for small screens with compact user info',
    ],
  },
  '1.5.2': {
    date: 'January 15, 2026',
    changes: [
      'feat: Add full width styling for role select on mobile devices',
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
};

export default function ChangelogModal({ onClose }) {
  const currentVersion = import.meta.env.VITE_APP_VERSION || '1.9.3';
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
