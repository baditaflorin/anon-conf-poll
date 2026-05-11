import { useState } from "react";
import { Check, Copy, QrCode as QrIcon, X } from "lucide-react";
import { QrCode } from "./QrCode";
import { copyToClipboard } from "../io/downloads";

/**
 * Shown ONCE right after the user creates a new room. The room URL IS the
 * product — if they don't realize they need to send it to attendees, nothing
 * works. Big text, big copy button, QR for "scan from a slide" use.
 */
export function ShareLinkModal({
  url,
  onDismiss,
}: {
  url: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(true);

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
          <code className="share-modal-url">{url}</code>
          <button type="button" className="primary share-modal-copy" onClick={() => void copy()}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <button
          type="button"
          className="ghost share-modal-qr-toggle"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrIcon size={16} /> {showQr ? "Hide QR" : "Show QR code"}
        </button>

        {showQr && (
          <div className="share-modal-qr">
            <QrCode text={url} size={240} />
            <p className="share-modal-qr-hint">
              Project this from a slide or print it on a handout — attendees can scan to join.
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
