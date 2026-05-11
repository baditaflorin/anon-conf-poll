import { useState, type ReactNode } from "react";
import { Link2, PlusCircle, Sparkles, RotateCcw } from "lucide-react";
import { appConfig } from "../../shared/config";

export type WelcomeChoice =
  | { kind: "host" }
  | { kind: "join"; url: string }
  | { kind: "demo" }
  | { kind: "restore" };

/**
 * Replaces the busy auto-generating boot screen with a clear "what do you
 * want to do?" decision card. Shown only on a true cold start (no room in URL,
 * no saved session — or the user chose to start over).
 */
export function WelcomeScreen({
  hasSavedSession,
  onChoose,
  busy
}: {
  hasSavedSession: boolean;
  onChoose: (choice: WelcomeChoice) => void;
  busy: boolean;
}) {
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [mode, setMode] = useState<"choose" | "join">("choose");

  function submitJoin() {
    const trimmed = pasted.trim();
    if (!trimmed) {
      setPasteError("Paste a room URL or invite link.");
      return;
    }
    onChoose({ kind: "join", url: trimmed });
  }

  return (
    <main className="welcome-screen">
      <div className="welcome-header">
        <img src={`${import.meta.env.BASE_URL ?? "/"}icon.svg`} alt="" className="brand-mark" />
        <h1>anon-conf-poll</h1>
        <p className="welcome-tagline">
          Anonymous live polling for in-person events. No server stores your votes.
        </p>
      </div>

      {mode === "choose" && (
        <div className="welcome-options">
          {hasSavedSession && (
            <WelcomeOption
              icon={<RotateCcw size={28} />}
              title="Continue your last session"
              description="Pick up where you left off — your room, roster, and votes are still in this browser."
              cta="Continue"
              disabled={busy}
              accent
              onClick={() => onChoose({ kind: "restore" })}
            />
          )}
          <WelcomeOption
            icon={<PlusCircle size={28} />}
            title="Host a new session"
            description="Create a fresh room with anonymous invites you can hand out before the event."
            cta="Create room"
            disabled={busy}
            accent={!hasSavedSession}
            onClick={() => onChoose({ kind: "host" })}
          />
          <WelcomeOption
            icon={<Link2 size={28} />}
            title="Join with a link"
            description="An organizer sent you a room URL — paste it to join."
            cta="Paste link"
            disabled={busy}
            onClick={() => setMode("join")}
          />
          <WelcomeOption
            icon={<Sparkles size={28} />}
            title="Try the demo"
            description="Spin up a room with sample roster, polls, and questions so you can poke around."
            cta="Open demo"
            disabled={busy}
            onClick={() => onChoose({ kind: "demo" })}
          />
        </div>
      )}

      {mode === "join" && (
        <form
          className="welcome-join"
          onSubmit={(e) => {
            e.preventDefault();
            submitJoin();
          }}
        >
          <label htmlFor="welcome-join-url">
            Paste the room URL or invite link the organizer sent you.
          </label>
          <textarea
            id="welcome-join-url"
            autoFocus
            rows={3}
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setPasteError(null);
            }}
            placeholder="https://baditaflorin.github.io/anon-conf-poll/#room=…"
          />
          {pasteError && <div className="welcome-join-error">{pasteError}</div>}
          <div className="welcome-join-actions">
            <button type="button" className="ghost" onClick={() => setMode("choose")}>
              Back
            </button>
            <button type="submit" className="primary" disabled={busy}>
              Join room
            </button>
          </div>
        </form>
      )}

      <footer className="welcome-footer">
        <span>v{appConfig.version}</span>
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          Source
        </a>
      </footer>
    </main>
  );
}

function WelcomeOption({
  icon,
  title,
  description,
  cta,
  onClick,
  accent,
  disabled
}: {
  icon: ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`welcome-option ${accent ? "welcome-option-accent" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="welcome-option-icon">{icon}</span>
      <span className="welcome-option-title">{title}</span>
      <span className="welcome-option-description">{description}</span>
      <span className="welcome-option-cta">{cta} →</span>
    </button>
  );
}
