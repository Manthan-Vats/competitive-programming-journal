"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Root error boundary - catches errors in the root layout itself, so it must render its own
// <html>/<body> and cannot use the app's providers/fonts. Reports to Sentry and offers a reload.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1812",
          color: "#e8e0cf",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <p style={{ fontSize: 48, color: "#b3271e", margin: 0 }}>!</p>
          <p style={{ fontSize: 16, marginTop: 12 }}>everything in its wrong place</p>
          <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6 }}>
            the page failed to load
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              fontSize: 14,
              color: "#e8e0cf",
              background: "transparent",
              border: "1px solid #e8e0cf",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </div>
      </body>
    </html>
  );
}
