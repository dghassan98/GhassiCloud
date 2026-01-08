import React from 'react';
import { X, Sparkles } from 'lucide-react';

// 🎯 Update this changelog whenever you release a new version
const CHANGELOG = {
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
  const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
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
