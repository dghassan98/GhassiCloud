import React from 'react';
import { Download, X } from 'lucide-react';

export default function UpdateNotification({ onUpdate, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'var(--card-bg)',
        border: '2px solid var(--accent)',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        zIndex: 9999,
        maxWidth: '350px',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{
            backgroundColor: 'var(--accent)',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Download size={20} color="white" />
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: '0 0 4px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)',
            }}
          >
            Update Available
          </h3>
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: '1.4',
            }}
          >
            A new version is ready. Refresh to get the latest features.
          </p>
          <button
            onClick={onUpdate}
            style={{
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Update Now
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(400px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}
