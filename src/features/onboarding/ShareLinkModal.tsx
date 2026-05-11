import { useState } from "react";
import { Check, Copy, QrCode as QrIcon, X } from "lucide-react";
import { QrCode } from "./QrCode";
import { copyToClipboard } from "../io/downloads";

/**
 * Shown ONCE right after the user creates a new room. The room URL IS the
 * product — if they don't realize they need to send it to attendees, nothing
 * works. Single big copy button, optional QR, compact layout that doesn't
 * dominate the screen even when the URL is ~3 KB (room manifests get long).
 */
export function ShareLinkModal({
  url,
  onDismiss,
}: {
  url: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // QR codes for very long URLs become unscannably dense at any reasonable
  // size. Hide the QR by default past ~1200 chars and let the user opt in.
  const isDenseUrl = url.length > 1200;
  const [showQr, setShowQr] = useState(!isDenseUrl);

  async function copy() {
    try {
      await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // copyToClipboard already logs / falls back internally
    }
  }

  return (
    <div
      className="share-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="share-modal">
        <button
          type="button"
          className="share-modal-close"
          onClick={onDismiss}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h2 id="share-modal-title">Your room is ready</h2>
        <p className="share-modal-lede">
          Share this link with attendees. Anyone with the link can join and vote
          anonymously — there's no other access control.
        </p>

        <div className="share-modal-url-row">
          <input
            type="text"
            readOnly
            className="share-modal-url-input"
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Room URL"
          />
          <button type="button" className="primary share-modal-copy" onClick={() => void copy()}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="share-modal-url-meta">
          {url.length.toLocaleString()} characters · the room manifest travels in the URL fragment, never sent to a server
        </p>

        <button
          type="button"
          className="ghost share-modal-qr-toggle"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrIcon size={16} /> {showQr ? "Hide QR" : "Show QR"}
        </button>

        {showQr && (
          <div className="share-modal-qr">
            {isDenseUrl ? (
              <p className="share-modal-qr-warn">
                This room URL is long ({url.length.toLocaleString()} chars), so the QR is
                very dense and may not scan reliably. Sending the link by message or AirDrop
                is more reliable.
              </p>
            ) : null}
            <QrCode text={url} size={isDenseUrl ? 320 : 220} />
            <p className="share-modal-qr-hint">
              Project from a slide or print on a handout — attendees can scan to join.
            </p>
          </div>
        )}

        <div className="share-modal-actions">
          <button type="button" className="primary" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
