import {
  BarChart3,
  Bug,
  ClipboardList,
  Copy,
  Database,
  Download,
  Github,
  Heart,
  KeyRound,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Wand2,
  Vote,
  Wifi
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { summarizeWithDuckDB, type DuckDbSummary } from "./features/analytics/duckdb";
import { encodeInvite, encodeRoom, inviteBelongsToRoom, roomShareUrl } from "./features/polls/room";
import { tallyVotes } from "./features/polls/tally";
import type { Invite, RoomManifest, VerifiedQuestion, VerifiedVote } from "./features/polls/types";
import { loadRecentRoom, saveRecentRoom } from "./features/storage/localStore";
import { parseInviteInput } from "./features/substance/inviteInput";
import { inferPolls, type PollPreview } from "./features/substance/pollInference";
import { buildExportPayload } from "./features/substance/provenance";
import { inferRoster, type RosterPreview } from "./features/substance/rosterInference";
import { safeDecodeRoomInput, type SafeRoomResult } from "./features/substance/roomLink";
import { useSyncedRoom } from "./features/sync/useSyncedRoom";
import { appConfig } from "./shared/config";
import { sanitizeError } from "./shared/logger";

type BusyState = {
  label: string;
  detail: string;
} | null;

type Toast = {
  tone: "good" | "warn" | "bad";
  message: string;
} | null;

type RoomSeed = {
  manifest: RoomManifest | null;
  invites: Invite[];
  invite: Invite | null;
  roomError?: Extract<SafeRoomResult, { ok: false }>;
};
type LoadedRoomSeed = { manifest: RoomManifest; invites: Invite[]; invite: Invite | null };
type ActivityEvent = { at: string; label: string; detail: string };

function initialRoom(): RoomSeed {
  if (!window.location.hash.includes("room=")) {
    return { manifest: null, invites: [], invite: null };
  }

  const decoded = safeDecodeRoomInput(window.location.hash);

  if (decoded.ok) {
    return { manifest: decoded.manifest, invites: [], invite: null };
  }

  return { manifest: null, invites: [], invite: null, roomError: decoded };
}

export default function App() {
  const seed = useMemo(initialRoom, []);
  const [bootstrap, setBootstrap] = useState<RoomSeed>(seed);

  useEffect(() => {
    if (bootstrap.manifest || bootstrap.roomError) {
      return;
    }

    let cancelled = false;

    void import("./features/proofs/attendees").then(({ createGeneratedRoom }) => {
      if (cancelled) {
        return;
      }

      const generated = createGeneratedRoom(24);
      window.history.replaceState(null, "", `#${encodeRoom(generated.manifest)}`);
      setBootstrap({
        manifest: generated.manifest,
        invites: generated.invites,
        invite: generated.invites[0] ?? null
      });
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrap.manifest]);

  if (bootstrap.roomError) {
    return (
      <DamagedRoomScreen
        error={bootstrap.roomError}
        onCreateNew={() => {
          void createDefaultRoom().then(setBootstrap);
        }}
      />
    );
  }

  if (!bootstrap.manifest) {
    return <BootScreen />;
  }

  return <RoomExperience seed={bootstrap as LoadedRoomSeed} />;
}

async function createDefaultRoom(): Promise<LoadedRoomSeed> {
  const { createGeneratedRoom } = await import("./features/proofs/attendees");
  const generated = createGeneratedRoom(24);
  window.history.replaceState(null, "", `#${encodeRoom(generated.manifest)}`);

  return {
    manifest: generated.manifest,
    invites: generated.invites,
    invite: generated.invites[0] ?? null
  };
}

function RoomExperience({ seed }: { seed: LoadedRoomSeed }) {
  const [manifest, setManifest] = useState(seed.manifest);
  const [organizerInvites, setOrganizerInvites] = useState(seed.invites);
  const [activeInvite, setActiveInvite] = useState<Invite | null>(seed.invite);
  const [attendeeCount, setAttendeeCount] = useState(seed.manifest.attendeeCommitments.length);
  const [roomTitle, setRoomTitle] = useState(seed.manifest.title);
  const [rosterInput, setRosterInput] = useState("");
  const [pollInput, setPollInput] = useState("");
  const [rosterPreview, setRosterPreview] = useState<RosterPreview | null>(null);
  const [pollPreview, setPollPreview] = useState<PollPreview | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [verifiedVotes, setVerifiedVotes] = useState<VerifiedVote[]>([]);
  const [verifiedQuestions, setVerifiedQuestions] = useState<VerifiedQuestion[]>([]);
  const [localVotedPollIds, setLocalVotedPollIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<BusyState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [analytics, setAnalytics] = useState<DuckDbSummary | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const { votes, questions, status, peers, publishVote, publishQuestion } = useSyncedRoom(manifest);
  const debugEnabled = useMemo(() => isDebugEnabled(), []);

  const tallies = useMemo(() => tallyVotes(manifest, verifiedVotes), [manifest, verifiedVotes]);

  useEffect(() => {
    void loadRecentRoom().then((recent) => {
      if (!recent) {
        return;
      }

      if (!window.location.hash.includes("room=")) {
        setManifest(recent.manifest);
        setActiveInvite(recent.invite);
        setRoomTitle(recent.manifest.title);
        window.history.replaceState(null, "", `#${encodeRoom(recent.manifest)}`);
      } else if (recent.manifest.roomId === manifest.roomId && !activeInvite) {
        setActiveInvite(recent.invite);
      }
    });
  }, []);

  useEffect(() => {
    void saveRecentRoom(manifest, activeInvite);
  }, [manifest, activeInvite]);

  useEffect(() => {
    if (!rosterInput.trim()) {
      setRosterPreview(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const preview = inferRoster(rosterInput);
      setRosterPreview(preview);

      if (preview.eligibleRows > 0) {
        setAttendeeCount(preview.eligibleRows);
      }

      recordActivity(
        "Roster inferred",
        `${preview.eligibleRows} eligible, ${preview.duplicateRows} duplicate, ${preview.excludedRows} excluded`
      );
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [rosterInput]);

  useEffect(() => {
    if (!pollInput.trim()) {
      setPollPreview(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const preview = inferPolls(pollInput);
      setPollPreview(preview);
      recordActivity(
        "Poll draft inferred",
        `${preview.pollCount} poll(s), ${preview.confidence} confidence`
      );
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [pollInput]);

  useEffect(() => {
    let cancelled = false;

    if (votes.length === 0) {
      setVerifiedVotes([]);
      return () => {
        cancelled = true;
      };
    }

    void import("./features/proofs/semaphore").then(({ verifyVoteRecord }) => {
      void Promise.all(
        votes.map((voteRecord) =>
          verifyVoteRecord(manifest, voteRecord).catch((error: unknown) => ({
            ...voteRecord,
            verified: false,
            reason: sanitizeError(error)
          }))
        )
      ).then((nextVotes) => {
        if (!cancelled) {
          setVerifiedVotes(nextVotes);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [manifest, votes]);

  useEffect(() => {
    let cancelled = false;

    if (questions.length === 0) {
      setVerifiedQuestions([]);
      return () => {
        cancelled = true;
      };
    }

    void import("./features/proofs/semaphore").then(({ verifyQuestionRecord }) => {
      void Promise.all(
        questions.map((questionRecord) =>
          verifyQuestionRecord(manifest, questionRecord).catch((error: unknown) => ({
            ...questionRecord,
            verified: false,
            reason: sanitizeError(error)
          }))
        )
      ).then((nextQuestions) => {
        if (!cancelled) {
          setVerifiedQuestions(nextQuestions);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [manifest, questions]);

  function startNewRoom() {
    setBusy({ label: "Generating commitments", detail: "Creating local Semaphore identities." });
    void import("./features/proofs/attendees")
      .then(({ createGeneratedRoom }) => {
        const inferredPolls = pollPreview?.polls.filter((poll) => poll.options.length >= 2);
        const generated = createGeneratedRoom(
          attendeeCount,
          roomTitle.trim() || "Anonymous Conference Poll",
          inferredPolls && inferredPolls.length > 0 ? inferredPolls : undefined
        );
        setManifest(generated.manifest);
        setOrganizerInvites(generated.invites);
        setActiveInvite(generated.invites[0] ?? null);
        setSelectedOptions({});
        setLocalVotedPollIds(new Set());
        setVerifiedVotes([]);
        setVerifiedQuestions([]);
        setAnalytics(null);
        window.history.replaceState(null, "", `#${encodeRoom(generated.manifest)}`);
        recordActivity(
          "Room created",
          `${generated.manifest.attendeeCommitments.length} invite(s), ${generated.manifest.polls.length} poll(s)`
        );
        setToast({ tone: "good", message: "Room created with fresh commitments." });
      })
      .catch((error: unknown) => {
        setToast({ tone: "bad", message: sanitizeError(error) });
      })
      .finally(() => setBusy(null));
  }

  function recordActivity(label: string, detail: string) {
    setActivity((current) =>
      [
        {
          at: new Date().toISOString(),
          label,
          detail
        },
        ...current
      ].slice(0, 12)
    );
  }

  async function copyText(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setToast({ tone: "good", message });
  }

  function importInvite() {
    const parsed = parseInviteInput(inviteInput);

    if (!parsed.ok) {
      setToast({ tone: "bad", message: `${parsed.message} ${parsed.suggestion}` });
      recordActivity("Invite rejected", parsed.message);
      return;
    }

    if (!inviteBelongsToRoom(parsed.invite, manifest)) {
      setToast({
        tone: "bad",
        message: "Invite is valid, but it belongs to a different room. Ask for this room's invite."
      });
      recordActivity("Invite rejected", `Different room: ${parsed.roomId}`);
      return;
    }

    setActiveInvite(parsed.invite);
    setInviteInput("");
    recordActivity(
      "Invite loaded",
      `${parsed.confidence} confidence; ${parsed.normalizations.join(", ") || "raw token"}`
    );
    setToast({ tone: "good", message: "Invite loaded for this browser." });
  }

  async function castVote(pollId: string) {
    const optionId = selectedOptions[pollId];

    if (!activeInvite || !optionId) {
      setToast({ tone: "warn", message: "Load an invite and choose an option first." });
      return;
    }

    if (localVotedPollIds.has(pollId)) {
      setToast({ tone: "warn", message: "This invite already has a counted vote for this poll." });
      return;
    }

    try {
      setBusy({
        label: "Generating zk proof",
        detail: "Semaphore artifacts may load on first use."
      });
      const { createVoteRecord, verifyVoteRecord } = await import("./features/proofs/semaphore");
      const voteRecord = await createVoteRecord(manifest, activeInvite, pollId, optionId);
      const verified = await verifyVoteRecord(manifest, voteRecord);

      if (!verified.verified) {
        setToast({ tone: "bad", message: verified.reason ?? "Proof verification failed." });
        return;
      }

      if (
        verifiedVotes.some(
          (vote) =>
            vote.verified && vote.pollId === pollId && vote.nullifier === voteRecord.nullifier
        )
      ) {
        setToast({
          tone: "warn",
          message: "This invite already has a counted vote for this poll."
        });
        recordActivity("Duplicate vote blocked", pollId);
        return;
      }

      publishVote(voteRecord);
      setLocalVotedPollIds((current) => new Set(current).add(pollId));
      recordActivity("Vote counted", pollId);
      setToast({ tone: "good", message: "Anonymous vote published." });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function submitQuestion() {
    if (!activeInvite || questionText.trim().length < 3) {
      setToast({ tone: "warn", message: "Load an invite and enter a question." });
      return;
    }

    try {
      setBusy({ label: "Generating Q&A proof", detail: "The question is signed anonymously." });
      const { createQuestionRecord, verifyQuestionRecord } =
        await import("./features/proofs/semaphore");
      const questionRecord = await createQuestionRecord(manifest, activeInvite, questionText);
      const verified = await verifyQuestionRecord(manifest, questionRecord);

      if (!verified.verified) {
        setToast({ tone: "bad", message: verified.reason ?? "Question proof failed." });
        return;
      }

      if (
        verifiedQuestions.some(
          (question) => question.verified && question.nullifier === questionRecord.nullifier
        )
      ) {
        setToast({ tone: "warn", message: "This invite already has a verified Q&A submission." });
        recordActivity("Duplicate question blocked", "One anonymous question already counted");
        return;
      }

      publishQuestion(questionRecord);
      setQuestionText("");
      recordActivity("Question submitted", "Anonymous Q&A proof verified");
      setToast({ tone: "good", message: "Anonymous question published." });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function runAnalytics() {
    try {
      setBusy({ label: "Starting DuckDB-WASM", detail: "Loading the local SQL engine." });
      const summary = await summarizeWithDuckDB(manifest, verifiedVotes);
      setAnalytics(summary);
      recordActivity("DuckDB summary", `${summary.rows.length} result row(s)`);
      setToast({ tone: "good", message: "DuckDB summary refreshed." });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  function downloadResults(kind: "json" | "csv") {
    const exportPayload = buildExportPayload({
      manifest,
      votes: verifiedVotes,
      questions: verifiedQuestions,
      rosterPreview,
      pollPreview
    });
    const payload = kind === "json" ? JSON.stringify(exportPayload, null, 2) : toCsv(verifiedVotes);
    const blob = new Blob([payload], { type: kind === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${manifest.roomId}-results.${kind}`;
    anchor.click();
    URL.revokeObjectURL(url);
    recordActivity("Results exported", `${kind.toUpperCase()} with provenance metadata`);
  }

  const currentInviteCode = activeInvite ? encodeInvite(activeInvite) : "";
  const verifiedQuestionList = uniqueQuestions(verifiedQuestions);

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <header className="topbar">
        <div className="brand">
          <img src="/anon-conf-poll/icon.svg" alt="" className="brand-mark" />
          <div>
            <h1>anon-conf-poll</h1>
            <p>
              v{appConfig.version} · {appConfig.commit}
            </p>
          </div>
        </div>
        <nav className="top-actions" aria-label="Project links">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer" className="icon-link">
            <Github size={18} aria-hidden="true" />
            Star
          </a>
          <a
            href={appConfig.paypalUrl}
            target="_blank"
            rel="noreferrer"
            className="icon-link accent"
          >
            <Heart size={18} aria-hidden="true" />
            PayPal
          </a>
        </nav>
      </header>

      <section className="status-strip" aria-label="Room status">
        <Status icon={<Radio size={18} />} label="Room" value={manifest.roomId} />
        <Status icon={<Wifi size={18} />} label="Mesh" value={`${status} · ${peers} peer(s)`} />
        <Status
          icon={<ShieldCheck size={18} />}
          label="Proofs"
          value={manifest.proofProfile.replaceAll("-", " ")}
        />
        <Status icon={<Database size={18} />} label="Analytics" value="DuckDB-WASM local" />
      </section>

      {toast ? <div className={`toast ${toast.tone}`}>{toast.message}</div> : null}
      {busy ? (
        <div className="busy" role="status" aria-live="polite">
          <RefreshCw size={18} aria-hidden="true" className="spin" />
          <span>
            <strong>{busy.label}</strong>
            {busy.detail}
          </span>
        </div>
      ) : null}

      <div className="workspace">
        <section className="panel controls-panel" aria-labelledby="room-controls">
          <div className="panel-heading">
            <h2 id="room-controls">Room Control</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => void copyText(roomShareUrl(manifest), "Room URL copied.")}
              title="Copy room URL"
            >
              <Copy size={18} aria-hidden="true" />
            </button>
          </div>

          <label>
            <span>Title</span>
            <input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} />
          </label>
          <label>
            <span>Attendees</span>
            <input
              type="number"
              min={4}
              max={256}
              value={attendeeCount}
              onChange={(event) => setAttendeeCount(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Roster CSV</span>
            <textarea
              value={rosterInput}
              onChange={(event) => setRosterInput(event.target.value)}
              placeholder="Paste attendee roster CSV"
              rows={4}
            />
          </label>
          {rosterPreview ? (
            <InferenceSummary
              icon={<ClipboardList size={16} />}
              title={`${rosterPreview.eligibleRows} eligible attendee(s)`}
              confidence={rosterPreview.confidence}
              detail={`${rosterPreview.sourceKind} shape · ${rosterPreview.duplicateRows} duplicate · ${rosterPreview.excludedRows} excluded`}
              issues={rosterPreview.issues.slice(0, 3).map((issue) => issue.message)}
            />
          ) : null}
          <label>
            <span>Poll draft</span>
            <textarea
              value={pollInput}
              onChange={(event) => setPollInput(event.target.value)}
              placeholder="Paste poll text or poll CSV"
              rows={4}
            />
          </label>
          {pollPreview ? (
            <InferenceSummary
              icon={<Wand2 size={16} />}
              title={`${pollPreview.pollCount} inferred poll(s)`}
              confidence={pollPreview.confidence}
              detail={pollPreview.optionCounts.map((count) => `${count} options`).join(", ")}
              issues={pollPreview.issues.slice(0, 3).map((issue) => issue.message)}
            />
          ) : null}
          <button type="button" className="primary" onClick={startNewRoom}>
            <RefreshCw size={18} aria-hidden="true" />
            New room
          </button>

          <div className="divider" />

          <h3>Invite</h3>
          <textarea
            value={inviteInput}
            onChange={(event) => setInviteInput(event.target.value)}
            placeholder="Paste invite code"
            rows={4}
          />
          <div className="button-row">
            <button type="button" onClick={importInvite}>
              <KeyRound size={18} aria-hidden="true" />
              Load
            </button>
            <button
              type="button"
              disabled={!currentInviteCode}
              onClick={() => void copyText(currentInviteCode, "Invite copied.")}
            >
              <Copy size={18} aria-hidden="true" />
              Copy mine
            </button>
          </div>

          {organizerInvites.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                downloadBlob(
                  `${manifest.roomId}-invites.json`,
                  JSON.stringify(organizerInvites.map(encodeInvite), null, 2),
                  "application/json"
                )
              }
            >
              <Download size={18} aria-hidden="true" />
              Invite roster
            </button>
          ) : null}
        </section>

        <section className="poll-grid" aria-label="Polls">
          {manifest.polls.map((poll) => {
            const pollTallies = tallies.filter((tally) => tally.pollId === poll.id);
            const total = pollTallies.reduce((sum, tally) => sum + tally.votes, 0);
            const alreadyVoted = localVotedPollIds.has(poll.id);

            return (
              <article className="poll-card" key={poll.id}>
                <div className="poll-card-heading">
                  <h2>{poll.title}</h2>
                  <span>{total} verified</span>
                </div>
                <div className="options">
                  {poll.options.map((option) => {
                    const tally = pollTallies.find((candidate) => candidate.optionId === option.id);
                    const votesForOption = tally?.votes ?? 0;
                    const percent = total === 0 ? 0 : Math.round((votesForOption / total) * 100);

                    return (
                      <label className="option" key={option.id}>
                        <input
                          type="radio"
                          name={poll.id}
                          value={option.id}
                          disabled={alreadyVoted}
                          checked={selectedOptions[poll.id] === option.id}
                          onChange={() =>
                            setSelectedOptions((current) => ({
                              ...current,
                              [poll.id]: option.id
                            }))
                          }
                        />
                        <span>{option.label}</span>
                        <meter min={0} max={100} value={percent} />
                        <b>{votesForOption}</b>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="primary"
                  disabled={alreadyVoted}
                  onClick={() => void castVote(poll.id)}
                >
                  <Vote size={18} aria-hidden="true" />
                  {alreadyVoted ? "Vote verified" : "Cast anonymous vote"}
                </button>
              </article>
            );
          })}
        </section>

        <section className="panel qa-panel" aria-labelledby="qa-heading">
          <div className="panel-heading">
            <h2 id="qa-heading">Anonymous Q&A</h2>
            <span>{verifiedQuestionList.length}</span>
          </div>
          <textarea
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            placeholder="Ask a question"
            rows={3}
          />
          <button type="button" className="primary" onClick={() => void submitQuestion()}>
            <Send size={18} aria-hidden="true" />
            Submit
          </button>
          <div className="question-list">
            {verifiedQuestionList.map((question) => (
              <p key={question.id}>{question.text}</p>
            ))}
          </div>
        </section>

        <section className="panel analytics-panel" aria-labelledby="analytics-heading">
          <div className="panel-heading">
            <h2 id="analytics-heading">Results</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => void runAnalytics()}
              title="Run DuckDB"
            >
              <BarChart3 size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => downloadResults("json")}>
              <Download size={18} aria-hidden="true" />
              JSON
            </button>
            <button type="button" onClick={() => downloadResults("csv")}>
              <Download size={18} aria-hidden="true" />
              CSV
            </button>
          </div>
          {analytics ? (
            <div className="duckdb-summary">
              <p>DuckDB {analytics.duckdbVersion}</p>
              {analytics.rows.map((row) => (
                <span key={`${row.pollId}:${row.optionId}`}>
                  {row.label}: {row.votes}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Run DuckDB for a local SQL summary.</p>
          )}
        </section>
      </div>
      {debugEnabled ? (
        <section className="debug-panel" aria-label="Debug state">
          <h2>
            <Bug size={18} aria-hidden="true" />
            Debug
          </h2>
          <pre>
            {JSON.stringify(
              {
                version: appConfig.version,
                commit: appConfig.commit,
                roomId: manifest.roomId,
                roster: rosterPreview
                  ? {
                      sourceKind: rosterPreview.sourceKind,
                      confidence: rosterPreview.confidence,
                      eligibleRows: rosterPreview.eligibleRows,
                      duplicateRows: rosterPreview.duplicateRows,
                      excludedRows: rosterPreview.excludedRows,
                      checksum: rosterPreview.meta.sourceChecksum
                    }
                  : null,
                polls: pollPreview
                  ? {
                      confidence: pollPreview.confidence,
                      pollCount: pollPreview.pollCount,
                      checksum: pollPreview.meta.sourceChecksum
                    }
                  : null,
                activity
              },
              null,
              2
            )}
          </pre>
        </section>
      ) : null}
    </main>
  );
}

function BootScreen() {
  return (
    <main className="boot-screen">
      <img src="/anon-conf-poll/icon.svg" alt="" className="brand-mark" />
      <h1>anon-conf-poll</h1>
      <div className="busy" role="status" aria-live="polite">
        <RefreshCw size={18} aria-hidden="true" className="spin" />
        <span>
          <strong>Preparing room</strong>
          Generating local anonymous credentials.
        </span>
      </div>
    </main>
  );
}

function DamagedRoomScreen({
  error,
  onCreateNew
}: {
  error: Extract<SafeRoomResult, { ok: false }>;
  onCreateNew: () => void;
}) {
  return (
    <main className="boot-screen">
      <img src="/anon-conf-poll/icon.svg" alt="" className="brand-mark" />
      <h1>Room link needs attention</h1>
      <div className="toast bad">
        <strong>{error.message}</strong>
        <span>{error.suggestion}</span>
        {error.fieldIssues.length > 0 ? <code>{error.fieldIssues.join(", ")}</code> : null}
      </div>
      <button type="button" className="primary" onClick={onCreateNew}>
        <RefreshCw size={18} aria-hidden="true" />
        Create new room
      </button>
    </main>
  );
}

function InferenceSummary({
  icon,
  title,
  confidence,
  detail,
  issues
}: {
  icon: ReactNode;
  title: string;
  confidence: string;
  detail: string;
  issues: string[];
}) {
  return (
    <div className={`inference-summary ${confidence}`}>
      <div>
        {icon}
        <strong>{title}</strong>
        <span>{confidence}</span>
      </div>
      <p>{detail}</p>
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Status({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="status">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function isDebugEnabled(): boolean {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return query.get("debug") === "1" || hash.get("debug") === "1";
}

function uniqueQuestions(questions: VerifiedQuestion[]): VerifiedQuestion[] {
  const seen = new Set<string>();

  return [...questions]
    .filter((question) => question.verified)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .filter((question) => {
      if (seen.has(question.nullifier)) {
        return false;
      }

      seen.add(question.nullifier);
      return true;
    });
}

function toCsv(votes: VerifiedVote[]): string {
  const header = "id,poll_id,option_id,nullifier,verified,created_at";
  const rows = votes.map((voteRecord) =>
    [
      voteRecord.id,
      voteRecord.pollId,
      voteRecord.optionId,
      voteRecord.nullifier,
      String(voteRecord.verified),
      voteRecord.createdAt
    ]
      .map((value) => `"${value.replaceAll('"', '""')}"`)
      .join(",")
  );

  return [header, ...rows].join("\n");
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
