'use client';

// Replaces the root layout when the layout itself throws, so it must render its own
// <html>/<body>. globals.css may not be applied here — use inline styles to stay safe.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          color: '#1e293b',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: '0.5rem', maxWidth: '28rem', fontSize: '0.875rem', color: '#64748b' }}>
          Sorry — an unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: '#0f766e',
            color: '#fff',
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <p style={{ marginTop: '2.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          In an emergency call 911. In crisis, call or text 988 — anytime.
        </p>
      </body>
    </html>
  );
}
