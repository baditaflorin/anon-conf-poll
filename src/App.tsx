import {
  BarChart3,
  Bug,
  ClipboardList,
  ClipboardPaste,
  Copy,
  Crown,
  Database,
  Download,
  FileUp,
  Github,
  Heart,
  KeyRound,
  Link,
  Lock,
  Pencil,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Vote,
  Wand2,
  Wifi,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { summarizeWithDuckDB, type DuckDbSummary } from "./features/analytics/duckdb";
import { loadHostKey, parseHostKey, saveHostKey, serializeHostKey } from "./features/host/keyStore";
import {
  signPhase,
  signPoll,
  verifySignedPhase,
  verifySignedPoll,
  type Phase
} from "./features/host/signing";
import { classifyImport, readTextFiles } from "./features/io/fileRouting";
import {
  copyToClipboard,
  downloadTextFile,
  printReport,
  readClipboardText
} from "./features/io/downloads";
import {
  attendeeShareUrl,
  decodeInviteFromHash,
  encodeInvite,
  encodeRoom,
  inviteBelongsToRoom,
  makeId,
  roomShareUrl
} from "./features/polls/room";
import { tallyVotes } from "./features/polls/tally";
import type {
  Invite,
  Poll,
  RoomManifest,
  VerifiedQuestion,
  VerifiedVote
} from "./features/polls/types";
import type { HostKeyPair } from "./features/proofs/crypto";
import {
  createAppStateSnapshot,
  parseAppStateSnapshot,
  serializeAppState,
  type ActivityEvent,
  type AppStateSnapshot
} from "./features/state/appState";
import { clearAppState, loadAppState, saveAppState } from "./features/storage/localStore";
import { WelcomeScreen, type WelcomeChoice } from "./features/onboarding/WelcomeScreen";
import { ShareLinkModal } from "./features/onboarding/ShareLinkModal";
import { parseInviteInput } from "./features/substance/inviteInput";
import { inferPolls, type PollPreview } from "./features/substance/pollInference";
import { buildExportPayload } from "./features/substance/provenance";
import { inferRoster, type RosterPreview } from "./features/substance/rosterInference";
import { safeDecodeRoomInput, type SafeRoomResult } from "./features/substance/roomLink";
import { useSyncedRoom, type SyncStatus } from "./features/sync/useSyncedRoom";
import {
  DEFAULT_ICE_SERVERS,
  loadIceServers,
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
  type IceServer
} from "./features/sync/iceConfig";
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
  hostKey: HostKeyPair | null;
  seedPolls: Poll[];
  roomError?: Extract<SafeRoomResult, { ok: false }>;
};

type LoadedRoomSeed = {
  manifest: RoomManifest;
  invites: Invite[];
  invite: Invite | null;
  hostKey: HostKeyPair | null;
  seedPolls: Poll[];
};

function initialRoom(): RoomSeed {
  if (!window.location.hash.includes("room=")) {
    return { manifest: null, invites: [], invite: null, hostKey: null, seedPolls: [] };
  }

  const decoded = safeDecodeRoomInput(window.location.hash);

  if (decoded.ok) {
    const invite = decodeInviteFromHash(window.location.hash);
    return {
      manifest: decoded.manifest,
      invites: [],
      invite,
      hostKey: null,
      seedPolls: []
    };
  }

  return {
    manifest: null,
    invites: [],
    invite: null,
    hostKey: null,
    seedPolls: [],
    roomError: decoded
  };
}

export default function App() {
  const seed = useMemo(initialRoom, []);
  const [bootstrap, setBootstrap] = useState<RoomSeed>(seed);
  const [hasSavedSession, setHasSavedSession] = useState<boolean | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [welcomeBusy, setWelcomeBusy] = useState(false);

  // Warm the Semaphore zk-SNARK proving artifacts in the background.
  // Without this, the first vote / first question stalls the UI for
  // 10+ seconds while ~hundreds of MB of circuit blobs download.
  useEffect(() => {
    let cancelled = false;
    void import("./features/proofs/semaphore").then(({ preloadSemaphore }) => {
      if (cancelled) return;
      preloadSemaphore().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the URL has a v2 room manifest, try to load the matching host key
  // from this browser's storage — that's how we recognise "first browser
  // to create this room" as the host across reloads.
  useEffect(() => {
    if (!bootstrap.manifest || bootstrap.hostKey) {
      return;
    }
    let cancelled = false;
    void loadHostKey(bootstrap.manifest.roomId).then((kp) => {
      if (cancelled || !kp) return;
      // The stored privkey must match the manifest's pubkey to count.
      if (kp.publicKey === bootstrap.manifest!.hostPubKey) {
        setBootstrap((prev) =>
          prev.manifest && prev.manifest.roomId === bootstrap.manifest!.roomId
            ? { ...prev, hostKey: kp }
            : prev
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bootstrap.manifest, bootstrap.hostKey]);

  // Saved-session probe for the welcome "Continue" option.
  useEffect(() => {
    if (bootstrap.manifest || bootstrap.roomError) {
      return;
    }
    let cancelled = false;
    void loadAppState().then((saved) => {
      if (!cancelled) setHasSavedSession(!!saved);
    });
    return () => {
      cancelled = true;
    };
  }, [bootstrap.manifest, bootstrap.roomError]);

  async function handleWelcomeChoice(choice: WelcomeChoice) {
    setWelcomeBusy(true);
    try {
      if (choice.kind === "restore") {
        const saved = await loadAppState();
        if (saved) {
          const kp = await loadHostKey(saved.manifest.roomId);
          window.history.replaceState(null, "", `#${encodeRoom(saved.manifest)}`);
          setBootstrap({
            manifest: saved.manifest,
            invites: [],
            invite: saved.activeInvite,
            hostKey: kp && kp.publicKey === saved.manifest.hostPubKey ? kp : null,
            seedPolls: []
          });
          return;
        }
        // Saved session vanished — fall through to host flow.
      }

      if (choice.kind === "join") {
        const decoded = safeDecodeRoomInput(choice.url);
        if (decoded.ok) {
          const invite = decodeInviteFromHash(choice.url);
          const kp = await loadHostKey(decoded.manifest.roomId);
          window.history.replaceState(null, "", `#${encodeRoom(decoded.manifest)}`);
          setBootstrap({
            manifest: decoded.manifest,
            invites: [],
            invite,
            hostKey: kp && kp.publicKey === decoded.manifest.hostPubKey ? kp : null,
            seedPolls: []
          });
        } else {
          setBootstrap({
            manifest: null,
            invites: [],
            invite: null,
            hostKey: null,
            seedPolls: [],
            roomError: decoded
          });
        }
        return;
      }

      // Host or demo — both create a fresh room. Demo seeds sample polls.
      const next = await createDefaultRoom(choice.kind === "demo" ? demoSeedPolls : []);
      setBootstrap(next);
      setShowShareModal(true);
    } finally {
      setWelcomeBusy(false);
    }
  }

  if (bootstrap.roomError) {
    return (
      <DamagedRoomScreen
        error={bootstrap.roomError}
        onCreateNew={() => {
          void createDefaultRoom([]).then((next) => {
            setBootstrap(next);
            setShowShareModal(true);
          });
        }}
      />
    );
  }

  if (!bootstrap.manifest) {
    if (hasSavedSession === null) {
      return <BootScreen />;
    }
    return (
      <WelcomeScreen
        hasSavedSession={hasSavedSession}
        onChoose={(c) => void handleWelcomeChoice(c)}
        busy={welcomeBusy}
      />
    );
  }

  return (
    <>
      <RoomExperience seed={bootstrap as LoadedRoomSeed} />
      {showShareModal && (
        <ShareLinkModal
          url={roomShareUrl(bootstrap.manifest)}
          onDismiss={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}

async function createDefaultRoom(seedPolls: Poll[]): Promise<LoadedRoomSeed> {
  const { createGeneratedRoom } = await import("./features/proofs/attendees");
  const generated = await createGeneratedRoom(DEFAULT_ATTENDEE_COUNT);
  await saveHostKey(generated.manifest.roomId, generated.hostKey);
  window.history.replaceState(null, "", `#${encodeRoom(generated.manifest)}`);

  return {
    manifest: generated.manifest,
    invites: generated.invites,
    invite: generated.invites[0] ?? null,
    hostKey: generated.hostKey,
    seedPolls
  };
}

function RoomExperience({ seed }: { seed: LoadedRoomSeed }) {
  const [manifest, setManifest] = useState(seed.manifest);
  const [hostKey, setHostKey] = useState<HostKeyPair | null>(seed.hostKey);
  const [organizerInvites, setOrganizerInvites] = useState(seed.invites);
  const [activeInvite, setActiveInvite] = useState<Invite | null>(seed.invite);
  const [attendeeCount, setAttendeeCount] = useState(seed.manifest.attendeeCommitments.length);
  const [roomTitle, setRoomTitle] = useState(seed.manifest.title);
  const [rosterInput, setRosterInput] = useState("");
  const [pollDraftInput, setPollDraftInput] = useState("");
  const [rosterPreview, setRosterPreview] = useState<RosterPreview | null>(null);
  const [pollPreview, setPollPreview] = useState<PollPreview | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [livePolls, setLivePolls] = useState<Poll[]>([]);
  const [currentPhase, setCurrentPhase] = useState<Phase>("draft");
  const [verifiedVotes, setVerifiedVotes] = useState<VerifiedVote[]>([]);
  const [verifiedQuestions, setVerifiedQuestions] = useState<VerifiedQuestion[]>([]);
  const [localVotedPollIds, setLocalVotedPollIds] = useState<Set<string>>(new Set());
  const [storageReady, setStorageReady] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [busy, setBusy] = useState<BusyState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [analytics, setAnalytics] = useState<DuckDbSummary | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [showConnection, setShowConnection] = useState(false);
  const [showHostControls, setShowHostControls] = useState(false);
  const [iceServers, setIceServers] = useState<IceServer[]>(() => loadIceServers());
  const [signalingInput, setSignalingInput] = useState(() => loadSignalingUrl());
  const [turnTokenInput, setTurnTokenInput] = useState(() => loadTurnTokenUrl());
  const [turnUrl, setTurnUrl] = useState("");
  const [turnUsername, setTurnUsername] = useState("");
  const [turnCredential, setTurnCredential] = useState("");
  const {
    votes,
    questions,
    signedPolls,
    signedPhase,
    status,
    peers,
    signalingUrl,
    activeIceServers,
    announcedPeers,
    webrtcPeers,
    reannounceCount,
    forceReannounce,
    publishVote,
    publishQuestion,
    publishSignedPoll,
    removePoll,
    publishSignedPhase
  } = useSyncedRoom(manifest);
  const debugEnabled = useMemo(() => isDebugEnabled(), []);

  const isHost = hostKey !== null;
  const isLocked = currentPhase === "voting";

  const tallies = useMemo(() => tallyVotes(livePolls, verifiedVotes), [livePolls, verifiedVotes]);

  // Verify signed polls against the manifest's hostPubKey and surface only
  // the ones that pass. A signed poll from a non-host (or an edited payload)
  // is silently dropped — the host re-signs and republishes if they want it.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const verified: Poll[] = [];
      for (const signed of signedPolls) {
        if (await verifySignedPoll(manifest.hostPubKey, signed)) {
          verified.push(signed.poll);
        }
      }
      if (!cancelled) {
        setLivePolls(verified.sort((a, b) => a.id.localeCompare(b.id)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manifest, signedPolls]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!signedPhase) {
        if (!cancelled) setCurrentPhase("draft");
        return;
      }
      const ok = await verifySignedPhase(manifest.hostPubKey, signedPhase);
      if (!cancelled) setCurrentPhase(ok ? signedPhase.phase : "draft");
    })();
    return () => {
      cancelled = true;
    };
  }, [manifest, signedPhase]);

  // First-time-host seed: if we just created this room with seed polls
  // (demo flow), push them into the ydoc as signed polls so attendees see
  // them. Runs once when both hostKey and an empty ydoc are present.
  useEffect(() => {
    if (!hostKey || seed.seedPolls.length === 0 || signedPolls.length > 0) {
      return;
    }
    void (async () => {
      for (const poll of seed.seedPolls) {
        const signed = await signPoll(hostKey, poll, manifest.roomId);
        publishSignedPoll(signed);
      }
    })();
    // We intentionally only run this once on first detection of an empty doc.
  }, [hostKey]);

  useEffect(() => {
    void loadAppState().then((saved) => {
      if (!saved) {
        setStorageReady(true);
        return;
      }

      if (!window.location.hash.includes("room=")) {
        applyStateSnapshot(saved, "Restored saved session", true);
      } else if (saved.manifest.roomId === manifest.roomId && !activeInvite) {
        setActiveInvite(saved.activeInvite);
      }

      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    void saveAppState(createCurrentSnapshot());
  }, [
    activeInvite,
    activity,
    inviteInput,
    manifest,
    organizerInvites,
    questions,
    rosterInput,
    selectedOptions,
    storageReady,
    votes
  ]);

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
          verifyVoteRecord(manifest, livePolls, voteRecord).catch((error: unknown) => ({
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
  }, [manifest, livePolls, votes]);

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

  function createCurrentSnapshot(): AppStateSnapshot {
    return createAppStateSnapshot({
      manifest,
      activeInvite,
      organizerInvites,
      rosterInput,
      inviteInput,
      selectedOptions,
      activity,
      votes,
      questions
    });
  }

  function applyStateSnapshot(snapshot: AppStateSnapshot, label: string, replaceUrl: boolean) {
    setManifest(snapshot.manifest);
    setOrganizerInvites(snapshot.organizerInvites);
    setActiveInvite(snapshot.activeInvite);
    setAttendeeCount(snapshot.manifest.attendeeCommitments.length);
    setRoomTitle(snapshot.manifest.title);
    setRosterInput(snapshot.rosterInput);
    setInviteInput(snapshot.inviteInput);
    setSelectedOptions(snapshot.selectedOptions);
    setVerifiedVotes([]);
    setVerifiedQuestions([]);
    setLocalVotedPollIds(new Set());
    setAnalytics(null);
    setActivity(
      [
        {
          at: new Date().toISOString(),
          label,
          detail: `${snapshot.manifest.title} (${snapshot.manifest.roomId})`
        },
        ...snapshot.activity
      ].slice(0, 12)
    );

    if (replaceUrl) {
      window.history.replaceState(null, "", `#${encodeRoom(snapshot.manifest)}`);
    }

    // Re-check the host key for this room.
    void loadHostKey(snapshot.manifest.roomId).then((kp) => {
      if (kp && kp.publicKey === snapshot.manifest.hostPubKey) {
        setHostKey(kp);
      } else {
        setHostKey(null);
      }
    });
  }

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
    if (!pollDraftInput.trim()) {
      setPollPreview(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const preview = inferPolls(pollDraftInput);
      setPollPreview(preview);
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [pollDraftInput]);

  function startNewRoom() {
    if (busy) {
      return;
    }

    const safeAttendeeCount = clampAttendeeCount(attendeeCount);
    setAttendeeCount(safeAttendeeCount);
    setBusy({ label: "Generating commitments", detail: "Creating local Semaphore identities." });
    void import("./features/proofs/attendees")
      .then(async ({ createGeneratedRoom }) => {
        const generated = await createGeneratedRoom(
          safeAttendeeCount,
          roomTitle.trim() || "Anonymous Conference Poll"
        );
        await saveHostKey(generated.manifest.roomId, generated.hostKey);
        setManifest(generated.manifest);
        setHostKey(generated.hostKey);
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
          `${generated.manifest.attendeeCommitments.length} invite(s); host key generated`
        );
        setToast({ tone: "good", message: "Room created. You're the host." });
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
    try {
      await copyToClipboard(value);
      setToast({ tone: "good", message });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    }
  }

  function applyInviteText(value: string, sourceLabel: string): boolean {
    const parsed = parseInviteInput(value);

    if (!parsed.ok) {
      setToast({ tone: "bad", message: `${parsed.message} ${parsed.suggestion}` });
      recordActivity("Invite rejected", parsed.message);
      return false;
    }

    if (!inviteBelongsToRoom(parsed.invite, manifest)) {
      setToast({
        tone: "bad",
        message: "Invite is valid, but it belongs to a different room. Ask for this room's invite."
      });
      recordActivity("Invite rejected", `Different room: ${parsed.roomId}`);
      return false;
    }

    setActiveInvite(parsed.invite);
    setInviteInput("");
    recordActivity(
      "Invite loaded",
      `${sourceLabel}; ${parsed.confidence} confidence; ${
        parsed.normalizations.join(", ") || "raw token"
      }`
    );
    setToast({ tone: "good", message: "Invite loaded for this browser." });
    return true;
  }

  function importInvite() {
    applyInviteText(inviteInput, "Manual input");
  }

  async function pasteInviteFromClipboard() {
    try {
      const text = await readClipboardText();
      setInviteInput(text);
      applyInviteText(text, "Clipboard");
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    }
  }

  function applyRoomText(value: string, sourceLabel: string): boolean {
    const decoded = safeDecodeRoomInput(value);

    if (!decoded.ok) {
      setToast({ tone: "bad", message: `${decoded.message} ${decoded.suggestion}` });
      recordActivity("Room link rejected", decoded.message);
      return false;
    }

    setManifest(decoded.manifest);
    setOrganizerInvites([]);
    setActiveInvite(null);
    setAttendeeCount(decoded.manifest.attendeeCommitments.length);
    setRoomTitle(decoded.manifest.title);
    setSelectedOptions({});
    setLocalVotedPollIds(new Set());
    setVerifiedVotes([]);
    setVerifiedQuestions([]);
    setAnalytics(null);
    window.history.replaceState(null, "", `#${encodeRoom(decoded.manifest)}`);
    recordActivity("Room link loaded", `${sourceLabel}; ${decoded.manifest.roomId}`);
    setToast({ tone: "good", message: "Room link loaded." });

    void loadHostKey(decoded.manifest.roomId).then((kp) => {
      setHostKey(kp && kp.publicKey === decoded.manifest.hostPubKey ? kp : null);
    });
    return true;
  }

  function applyUrlInput() {
    if (!urlInput.trim()) {
      setToast({ tone: "warn", message: "Paste a room URL, room hash, or invite link first." });
      return;
    }

    const classified = classifyImport({ name: "URL input", type: "text/plain", text: urlInput });
    applyClassifiedImport(classified);
  }

  async function handleFileInput(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    await handleTextFiles(files);
  }

  async function handleTextFiles(files: FileList | File[]) {
    try {
      setBusy({ label: "Importing files", detail: "Reading local text, CSV, and JSON files." });
      const inputs = await readTextFiles(files);

      for (const input of inputs) {
        applyClassifiedImport(classifyImport(input));
      }
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  function applyClassifiedImport(input: ReturnType<typeof classifyImport>) {
    if (input.kind === "state") {
      const parsed = parseAppStateSnapshot(input.text);

      if (!parsed.ok) {
        setToast({ tone: "bad", message: `State import failed: ${parsed.message}` });
        recordActivity("State import rejected", input.name);
        return;
      }

      applyStateSnapshot(parsed.state, `Imported state from ${input.name}`, true);
      setToast({ tone: "good", message: "State file imported." });
      return;
    }

    if (input.kind === "room") {
      applyRoomText(input.text, input.name);
      return;
    }

    if (input.kind === "invite") {
      if (!applyInviteText(input.text, input.name)) {
        setInviteInput(input.text);
      }
      return;
    }

    if (input.kind === "roster") {
      setRosterInput(input.text);
      recordActivity("Roster file loaded", input.name);
      setToast({ tone: "good", message: "Roster file loaded." });
      return;
    }

    if (input.kind === "poll") {
      setPollDraftInput(input.text);
      recordActivity("Poll file loaded", input.name);
      setToast({ tone: "good", message: "Poll draft loaded — review and save in Host controls." });
      return;
    }

    setToast({
      tone: "warn",
      message: `${input.name} was not recognized. Use CSV roster, poll text/CSV, invite code, room URL, or state JSON.`
    });
    recordActivity("Import skipped", `${input.name}: unrecognized`);
  }

  function loadSampleInputs() {
    setRosterInput(sampleRosterCsv);
    setPollDraftInput(samplePollDraft);
    recordActivity("Sample data loaded", "Roster and poll draft examples");
    setToast({ tone: "good", message: "Sample roster and poll draft loaded." });
  }

  // ---- host-only actions ----------------------------------------------------

  async function publishDraftedPolls() {
    if (!hostKey) {
      setToast({ tone: "bad", message: "Only the host can publish questions." });
      return;
    }
    if (!pollPreview || pollPreview.polls.length === 0) {
      setToast({ tone: "warn", message: "No polls detected in the draft." });
      return;
    }
    try {
      setBusy({ label: "Signing questions", detail: "One signature per poll." });
      const polls = pollPreview.polls.filter((p) => p.options.length >= 2);
      for (const poll of polls) {
        const signed = await signPoll(hostKey, poll, manifest.roomId);
        publishSignedPoll(signed);
      }
      recordActivity("Polls published", `${polls.length} poll(s) signed and broadcast to peers`);
      setToast({ tone: "good", message: `${polls.length} poll(s) published.` });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function addBlankPoll() {
    if (!hostKey) return;
    const newPoll: Poll = {
      id: makeId("poll"),
      title: "New question",
      options: [
        { id: makeId("opt"), label: "Option 1" },
        { id: makeId("opt"), label: "Option 2" }
      ]
    };
    try {
      setBusy({ label: "Adding poll", detail: "Signing the new poll." });
      const signed = await signPoll(hostKey, newPoll, manifest.roomId);
      publishSignedPoll(signed);
      recordActivity("Poll added", newPoll.title);
      setToast({ tone: "good", message: "Blank poll added. Edit it inline." });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function updateExistingPoll(updated: Poll) {
    if (!hostKey) return;
    try {
      const signed = await signPoll(hostKey, updated, manifest.roomId);
      publishSignedPoll(signed);
      recordActivity("Poll edited", updated.title);
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    }
  }

  function deletePoll(pollId: string) {
    if (!hostKey) return;
    removePoll(pollId);
    recordActivity("Poll removed", pollId);
  }

  async function lockForVoting() {
    if (!hostKey) return;
    if (livePolls.length === 0) {
      setToast({ tone: "warn", message: "Add at least one question before locking." });
      return;
    }
    try {
      setBusy({ label: "Locking room", detail: "Signing the phase transition." });
      const signed = await signPhase(hostKey, "voting", manifest.roomId);
      publishSignedPhase(signed);
      recordActivity("Room locked", "Voting opened to attendees");
      setToast({ tone: "good", message: "Voting is open." });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function unlockToDraft() {
    if (!hostKey) return;
    try {
      setBusy({ label: "Unlocking room", detail: "Signing the phase transition." });
      const signed = await signPhase(hostKey, "draft", manifest.roomId);
      publishSignedPhase(signed);
      recordActivity("Room unlocked", "Back to draft mode");
      setToast({ tone: "good", message: "Back to draft — questions are editable again." });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  function exportHostKey() {
    if (!hostKey) return;
    const text = serializeHostKey(manifest.roomId, hostKey);
    downloadTextFile(`${manifest.roomId}-host-key.json`, text, "application/json");
    recordActivity("Host key exported", "Backup for moving host to another device");
  }

  async function importHostKey(text: string) {
    const parsed = parseHostKey(text);
    if (!parsed.ok) {
      setToast({ tone: "bad", message: parsed.message });
      return;
    }
    if (parsed.roomId !== manifest.roomId) {
      setToast({ tone: "bad", message: "Host key file belongs to a different room." });
      return;
    }
    if (parsed.key.publicKey !== manifest.hostPubKey) {
      setToast({ tone: "bad", message: "Host key does not match this room's host pubkey." });
      return;
    }
    await saveHostKey(parsed.roomId, parsed.key);
    setHostKey(parsed.key);
    recordActivity("Host key imported", "This browser is now the host");
    setToast({ tone: "good", message: "Host key imported. You're the host." });
  }

  // ---- voting / Q&A ---------------------------------------------------------

  async function castVote(pollId: string) {
    const optionId = selectedOptions[pollId];

    if (!activeInvite || !optionId) {
      setToast({ tone: "warn", message: "Load an invite and choose an option first." });
      return;
    }

    if (!isLocked) {
      setToast({ tone: "warn", message: "Voting hasn't opened yet — host is still setting up." });
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
      const verified = await verifyVoteRecord(manifest, livePolls, voteRecord);

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
      const summary = await summarizeWithDuckDB(livePolls, verifiedVotes);
      setAnalytics(summary);
      recordActivity("DuckDB summary", `${summary.rows.length} result row(s)`);
      setToast({ tone: "good", message: "DuckDB summary refreshed." });
    } catch (error) {
      setToast({ tone: "bad", message: sanitizeError(error) });
    } finally {
      setBusy(null);
    }
  }

  function resultsJsonText(): string {
    const exportPayload = buildExportPayload({
      manifest,
      votes: verifiedVotes,
      questions: verifiedQuestions,
      rosterPreview,
      pollPreview
    });

    return `${JSON.stringify(exportPayload, null, 2)}\n`;
  }

  function stateJsonText(): string {
    return serializeAppState(createCurrentSnapshot());
  }

  function downloadResults(kind: "json" | "csv") {
    const payload = kind === "json" ? resultsJsonText() : toCsv(verifiedVotes);
    downloadTextFile(
      `${manifest.roomId}-${kind === "json" ? "results" : "votes"}.${kind}`,
      payload,
      kind === "json" ? "application/json" : "text/csv"
    );
    recordActivity(
      "Results exported",
      kind === "json" ? "JSON with provenance metadata" : "Vote CSV rows"
    );
  }

  function downloadState() {
    downloadTextFile(`${manifest.roomId}-state.json`, stateJsonText(), "application/json");
    recordActivity("State exported", "Versioned setup state JSON");
  }

  async function copyResults(kind: "json" | "csv") {
    await copyText(
      kind === "json" ? resultsJsonText() : toCsv(verifiedVotes),
      kind === "json" ? "Results JSON copied." : "Vote CSV copied."
    );
    recordActivity("Results copied", kind === "json" ? "JSON" : "Vote CSV");
  }

  async function copyState() {
    await copyText(stateJsonText(), "State JSON copied.");
    recordActivity("State copied", "Versioned setup state JSON");
  }

  async function startFresh() {
    await clearAppState();
    const generated = await createDefaultRoom([]);
    setManifest(generated.manifest);
    setHostKey(generated.hostKey);
    setOrganizerInvites(generated.invites);
    setActiveInvite(generated.invite);
    setAttendeeCount(generated.manifest.attendeeCommitments.length);
    setRoomTitle(generated.manifest.title);
    setRosterInput("");
    setPollDraftInput("");
    setInviteInput("");
    setUrlInput("");
    setSelectedOptions({});
    setVerifiedVotes([]);
    setVerifiedQuestions([]);
    setLocalVotedPollIds(new Set());
    setAnalytics(null);
    setActivity([]);
    setToast({ tone: "good", message: "Fresh room created and saved state cleared." });
  }

  const currentInviteCode = activeInvite ? encodeInvite(activeInvite) : "";
  const verifiedQuestionList = uniqueQuestions(verifiedQuestions);
  const phaseLabel = isLocked ? "Voting open" : "Draft — host setting up";

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
        <Status
          icon={<Wifi size={18} />}
          label="Connection"
          value={humanizeMeshState(status, peers, webrtcPeers)}
        />
        <Status
          icon={isLocked ? <Vote size={18} /> : <Pencil size={18} />}
          label="Phase"
          value={phaseLabel}
        />
        <Status
          icon={<ShieldCheck size={18} />}
          label={isHost ? "Role" : "Proofs"}
          value={isHost ? "Host (you)" : manifest.proofProfile.replaceAll("-", " ")}
        />
      </section>

      {/* Phase banner — explains to attendees why voting is closed, or
          prompts the host to lock when they're ready. */}
      {!isLocked && (
        <div className={`phase-banner ${isHost ? "host" : "attendee"}`}>
          {isHost ? (
            <>
              <Pencil size={18} aria-hidden="true" />
              <span>
                <strong>You're hosting in draft mode.</strong> Add or edit questions, then click{" "}
                <em>Lock &amp; open voting</em> when you're ready.
              </span>
              <button
                type="button"
                className="primary"
                disabled={Boolean(busy) || livePolls.length === 0}
                onClick={() => void lockForVoting()}
              >
                <Lock size={16} aria-hidden="true" />
                Lock &amp; open voting
              </button>
            </>
          ) : (
            <>
              <RefreshCw size={18} aria-hidden="true" className="spin" />
              <span>
                <strong>Host is setting up the questions.</strong> Voting opens when they lock the
                room.
              </span>
            </>
          )}
        </div>
      )}
      {isLocked && isHost && (
        <div className="phase-banner host locked">
          <Vote size={18} aria-hidden="true" />
          <span>
            <strong>Voting is open.</strong> You can still add a new poll mid-session.
          </span>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void addBlankPoll()}
            title="Add another poll while voting is open"
          >
            <Plus size={16} aria-hidden="true" />
            Add poll
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void unlockToDraft()}>
            <Pencil size={16} aria-hidden="true" />
            Unlock (back to draft)
          </button>
        </div>
      )}

      <details className="diagnostics">
        <summary>
          <span>Diagnostics</span>
          <span className="diagnostics-summary-value">
            {webrtcPeers > 0
              ? `✓ ${webrtcPeers} WebRTC peer${webrtcPeers === 1 ? "" : "s"}`
              : announcedPeers > 0
                ? `${announcedPeers} peer${announcedPeers === 1 ? "" : "s"} seen, no WebRTC yet`
                : "no peers seen yet"}
          </span>
        </summary>
        <div className="diagnostics-grid">
          {signalingUrl && (
            <Status
              icon={<Radio size={18} />}
              label="Signal"
              value={signalingUrl.replace("wss://", "").replace("ws://", "")}
            />
          )}
          {activeIceServers.length > 0 && (
            <Status
              icon={<Wifi size={18} />}
              label="TURN"
              value={
                activeIceServers.some(
                  (s) => s.urls.startsWith("turn:") || s.urls.startsWith("turns:")
                )
                  ? "✓ relay ready"
                  : "STUN only"
              }
            />
          )}
          <button
            className="status"
            title="Click to re-announce to the signaling server and force peer discovery"
            onClick={forceReannounce}
            style={{ cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}
          >
            <Radio size={18} aria-hidden="true" />
            <div>
              <span className="status-label">Peers</span>
              <span className="status-value">
                seen {announcedPeers} · rtc {webrtcPeers}
                {reannounceCount > 0 ? ` · re✓${reannounceCount}` : " · tap↺"}
              </span>
            </div>
          </button>
          <Status icon={<Database size={18} />} label="Analytics" value="DuckDB-WASM local" />
        </div>
      </details>

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
        <section
          className={`panel controls-panel ${isDraggingFile ? "dragging-file" : ""}`}
          aria-labelledby="room-controls"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingFile(false);
            void handleTextFiles(event.dataTransfer.files);
          }}
        >
          <div className="panel-heading">
            <h2 id="room-controls">Room</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => void copyText(roomShareUrl(manifest), "Room URL copied.")}
              title="Copy room URL"
            >
              <Copy size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Host controls: edit questions (in draft), add poll (always),
              lock/unlock, export host key. Only shown when this browser
              holds the host private key for the current room. */}
          {isHost && (
            <details className="panel-section" open={!isLocked && livePolls.length === 0}>
              <summary>
                <Crown size={14} aria-hidden="true" />
                <span>Host controls</span>
              </summary>
              <div className="panel-section-body">
                <p className="host-note">
                  You're the host of this room because this browser holds the matching key.
                  Questions and the lock state are signed by you so attendees can verify them.
                </p>

                {!isLocked && (
                  <>
                    <label>
                      <span>Draft questions (text or CSV)</span>
                      <textarea
                        value={pollDraftInput}
                        onChange={(event) => setPollDraftInput(event.target.value)}
                        placeholder={`Opening poll: What should we cover?\n- Demos\n- Architecture\n- Q&A`}
                        rows={5}
                      />
                    </label>
                    {pollPreview ? (
                      <InferenceSummary
                        icon={<Wand2 size={16} />}
                        title={`${pollPreview.pollCount} inferred poll(s)`}
                        confidence={pollPreview.confidence}
                        detail={pollPreview.optionCounts
                          .map((count) => `${count} options`)
                          .join(", ")}
                        issues={pollPreview.issues.slice(0, 3).map((issue) => issue.message)}
                      />
                    ) : null}
                    <div className="button-row">
                      <button
                        type="button"
                        className="primary"
                        disabled={Boolean(busy) || !pollPreview || pollPreview.polls.length === 0}
                        onClick={() => void publishDraftedPolls()}
                      >
                        <Send size={16} aria-hidden="true" />
                        Publish drafted polls
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void addBlankPoll()}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Add blank poll
                      </button>
                    </div>
                  </>
                )}

                {livePolls.length > 0 && (
                  <div className="host-poll-editor">
                    <h4>Live questions ({livePolls.length})</h4>
                    {livePolls.map((poll) => (
                      <PollEditor
                        key={poll.id}
                        poll={poll}
                        editable={!isLocked}
                        onChange={(next) => void updateExistingPoll(next)}
                        {...(!isLocked ? { onDelete: () => deletePoll(poll.id) } : {})}
                      />
                    ))}
                  </div>
                )}

                <div className="divider" />

                <details>
                  <summary>Host key backup</summary>
                  <p className="muted">
                    Export the host key to move the host role to another device, or to back it up.
                    Anyone with this file can edit questions and lock/unlock the room.
                  </p>
                  <div className="button-row">
                    <button type="button" onClick={exportHostKey}>
                      <Download size={16} aria-hidden="true" />
                      Export host key
                    </button>
                  </div>
                </details>
              </div>
            </details>
          )}

          {/* If this browser is NOT the host, allow importing a host key
              file to take over the host role (e.g. moved devices). */}
          {!isHost && (
            <details className="panel-section">
              <summary>
                <Crown size={14} aria-hidden="true" />
                <span>I'm the host (import key)</span>
              </summary>
              <div className="panel-section-body">
                <p className="muted">
                  If you created this room on another device, paste or upload the exported host key
                  to take the host role here.
                </p>
                <HostKeyImporter onSubmit={(text) => void importHostKey(text)} />
              </div>
            </details>
          )}

          <details className="panel-section">
            <summary>
              <Settings size={14} aria-hidden="true" />
              <span>Roster &amp; setup</span>
            </summary>
            <div className="panel-section-body">
              <div className="file-drop">
                <FileUp size={18} aria-hidden="true" />
                <div>
                  <strong>Import files</strong>
                  <p>CSV, TXT, or JSON — rosters, polls, invites, saved state.</p>
                </div>
                <label className="file-picker">
                  Choose
                  <input
                    aria-label="Import files"
                    type="file"
                    accept=".csv,.txt,.json,text/csv,text/plain,application/json"
                    multiple
                    onChange={(event) => {
                      void handleFileInput(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="button-row">
                <button type="button" onClick={loadSampleInputs}>
                  <ClipboardList size={18} aria-hidden="true" />
                  Sample data
                </button>
                <button type="button" onClick={() => void startFresh()}>
                  <Trash2 size={18} aria-hidden="true" />
                  Start fresh
                </button>
              </div>

              <label>
                <span>Open another room or invite URL</span>
                <input
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="Paste room URL, #room=..., or invite link"
                />
              </label>
              <button type="button" onClick={applyUrlInput}>
                <Link size={18} aria-hidden="true" />
                Open link
              </button>

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
                  onBlur={() => setAttendeeCount(clampAttendeeCount(attendeeCount))}
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
              <button
                type="button"
                className="primary"
                disabled={Boolean(busy)}
                onClick={startNewRoom}
              >
                <RefreshCw size={18} aria-hidden="true" />
                Rebuild this room (new host key)
              </button>
            </div>
          </details>

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
            <button type="button" onClick={() => void pasteInviteFromClipboard()}>
              <ClipboardPaste size={18} aria-hidden="true" />
              Paste
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
            <>
              <h3>Attendee links</h3>
              <p className="attendee-link-hint">
                Each link is unique. One per person. Opening it loads the room and invite
                automatically — no paste step.
              </p>
              <div className="attendee-link-list">
                {organizerInvites.map((inv, i) => (
                  <div key={inv.commitment} className="attendee-link-row">
                    <span className="attendee-link-label">#{i + 1}</span>
                    <button
                      type="button"
                      className="attendee-link-copy"
                      onClick={() =>
                        void copyText(attendeeShareUrl(manifest, inv), `Link #${i + 1} copied.`)
                      }
                    >
                      <Copy size={14} aria-hidden="true" />
                      Copy link
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    `${manifest.roomId}-invites.json`,
                    `${JSON.stringify(organizerInvites.map(encodeInvite), null, 2)}\n`,
                    "application/json"
                  )
                }
              >
                <Download size={18} aria-hidden="true" />
                Export raw invites
              </button>
            </>
          ) : null}

          <div className="divider" />

          <div className="panel-heading">
            <h3>Connection</h3>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowConnection((v) => !v)}
              title="Toggle connection settings"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>

          {showConnection ? (
            <div className="connection-settings">
              <label>
                <span>TURN token server</span>
                <input
                  value={turnTokenInput}
                  onChange={(e) => setTurnTokenInput(e.target.value)}
                  placeholder="https://turn.yourdomain.com/credentials"
                />
              </label>
              <p className="connection-note">
                Fetches time-limited HMAC credentials on each connect. Leave empty to use the ICE
                servers below.
              </p>
              <button
                type="button"
                onClick={() => {
                  saveTurnTokenUrl(turnTokenInput);
                  setToast({ tone: "good", message: "Token server saved. Reload to apply." });
                }}
              >
                Save token server
              </button>

              <div className="divider" />

              <label>
                <span>Signaling server</span>
                <input
                  value={signalingInput}
                  onChange={(e) => setSignalingInput(e.target.value)}
                  placeholder={appConfig.signalingUrl}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  saveSignalingUrl(signalingInput);
                  setToast({ tone: "good", message: "Signaling URL saved. Reload to apply." });
                }}
              >
                Save signaling
              </button>

              <div className="divider" />

              <h4>ICE servers</h4>
              <ul className="ice-server-list">
                {iceServers.map((srv, i) => (
                  <li key={i}>
                    <span className="ice-url">{srv.urls}</span>
                    {srv.username ? <span className="ice-meta"> · {srv.username}</span> : null}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove"
                      onClick={() => {
                        const next = iceServers.filter((_, j) => j !== i);
                        setIceServers(next);
                        saveIceServers(next);
                        setToast({
                          tone: "good",
                          message: "ICE server removed. Reload to apply."
                        });
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <label>
                <span>TURN / STUN URL</span>
                <input
                  value={turnUrl}
                  onChange={(e) => setTurnUrl(e.target.value)}
                  placeholder="turn:your-server.example.com:3478"
                />
              </label>
              <label>
                <span>Username</span>
                <input
                  value={turnUsername}
                  onChange={(e) => setTurnUsername(e.target.value)}
                  placeholder="optional"
                />
              </label>
              <label>
                <span>Credential</span>
                <input
                  type="password"
                  value={turnCredential}
                  onChange={(e) => setTurnCredential(e.target.value)}
                  placeholder="optional"
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  disabled={!turnUrl.trim()}
                  onClick={() => {
                    const entry: IceServer = { urls: turnUrl.trim() };
                    if (turnUsername.trim()) entry.username = turnUsername.trim();
                    if (turnCredential.trim()) entry.credential = turnCredential.trim();
                    const next = [...iceServers, entry];
                    setIceServers(next);
                    saveIceServers(next);
                    setTurnUrl("");
                    setTurnUsername("");
                    setTurnCredential("");
                    setToast({ tone: "good", message: "ICE server added. Reload to apply." });
                  }}
                >
                  Add server
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetIceServers();
                    setIceServers(DEFAULT_ICE_SERVERS);
                    setToast({
                      tone: "good",
                      message: "Reset to Google STUN defaults. Reload to apply."
                    });
                  }}
                >
                  Reset defaults
                </button>
              </div>
              <p className="connection-note">Changes apply after reload or starting a new room.</p>
            </div>
          ) : null}
        </section>

        <section className="poll-grid" aria-label="Polls">
          {livePolls.length === 0 ? (
            <div className="poll-card empty">
              <p className="muted">
                {isHost
                  ? "No questions yet — use Host controls to draft or add one."
                  : "Waiting for the host to publish questions…"}
              </p>
            </div>
          ) : null}
          {livePolls.map((poll) => {
            const pollTallies = tallies.filter((tally) => tally.pollId === poll.id);
            const total = pollTallies.reduce((sum, tally) => sum + tally.votes, 0);
            const alreadyVoted = localVotedPollIds.has(poll.id);
            const votingBlocked = !isLocked || alreadyVoted;

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
                          disabled={votingBlocked}
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
                  disabled={votingBlocked || Boolean(busy)}
                  onClick={() => void castVote(poll.id)}
                >
                  <Vote size={18} aria-hidden="true" />
                  {!isLocked
                    ? "Voting opens after host locks"
                    : alreadyVoted
                      ? "Vote verified"
                      : "Cast anonymous vote"}
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
          <button
            type="button"
            className="primary"
            disabled={Boolean(busy)}
            onClick={() => void submitQuestion()}
          >
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

          <details className="panel-section">
            <summary>
              <Download size={14} aria-hidden="true" />
              <span>Export &amp; print</span>
            </summary>
            <div className="panel-section-body export-grid">
              <button type="button" className="primary" onClick={printReport}>
                <Printer size={16} aria-hidden="true" />
                Print results
              </button>
              <div className="export-row">
                <span className="export-row-label">Results JSON</span>
                <button
                  type="button"
                  className="export-mini"
                  onClick={() => downloadResults("json")}
                  title="Download"
                >
                  <Download size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="export-mini"
                  onClick={() => void copyResults("json")}
                  title="Copy"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="export-row">
                <span className="export-row-label">Votes CSV</span>
                <button
                  type="button"
                  className="export-mini"
                  onClick={() => downloadResults("csv")}
                  title="Download"
                >
                  <Download size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="export-mini"
                  onClick={() => void copyResults("csv")}
                  title="Copy"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="export-row">
                <span className="export-row-label">Full saved state</span>
                <button
                  type="button"
                  className="export-mini"
                  onClick={downloadState}
                  title="Download"
                >
                  <Download size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="export-mini"
                  onClick={() => void copyState()}
                  title="Copy"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              </div>
              <p className="export-hint">
                JSON has tallies + provenance. CSV has raw vote rows for spreadsheets. Saved state
                archives everything in this browser.
              </p>
            </div>
          </details>
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
                hostPubKey: manifest.hostPubKey,
                isHost,
                currentPhase,
                livePollIds: livePolls.map((p) => p.id),
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
                activity
              },
              null,
              2
            )}
          </pre>
          {!showHostControls && (
            <button type="button" onClick={() => setShowHostControls(true)}>
              Show host controls
            </button>
          )}
        </section>
      ) : null}
    </main>
  );
}

function PollEditor({
  poll,
  editable,
  onChange,
  onDelete
}: {
  poll: Poll;
  editable: boolean;
  onChange: (next: Poll) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState(poll);

  useEffect(() => setDraft(poll), [poll]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(poll);

  return (
    <div className="poll-editor">
      <label>
        <span>Question</span>
        <input
          value={draft.title}
          disabled={!editable}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <ul>
        {draft.options.map((option, index) => (
          <li key={option.id}>
            <input
              value={option.label}
              disabled={!editable}
              onChange={(e) => {
                const nextOptions = [...draft.options];
                nextOptions[index] = { ...option, label: e.target.value };
                setDraft({ ...draft, options: nextOptions });
              }}
            />
            {editable && draft.options.length > 2 && (
              <button
                type="button"
                className="icon-button"
                aria-label="Remove option"
                onClick={() =>
                  setDraft({
                    ...draft,
                    options: draft.options.filter((_, i) => i !== index)
                  })
                }
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="button-row">
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                options: [
                  ...draft.options,
                  { id: makeId("opt"), label: `Option ${draft.options.length + 1}` }
                ]
              })
            }
          >
            <Plus size={14} aria-hidden="true" />
            Add option
          </button>
          <button
            type="button"
            className="primary"
            disabled={!dirty}
            onClick={() => onChange(draft)}
          >
            Save changes
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HostKeyImporter({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste host-key JSON"
        rows={4}
      />
      <div className="button-row">
        <label className="file-picker">
          Choose file
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              void file.text().then((text) => onSubmit(text));
            }}
          />
        </label>
        <button
          type="button"
          className="primary"
          disabled={!text.trim()}
          onClick={() => onSubmit(text)}
        >
          Import host key
        </button>
      </div>
    </>
  );
}

function humanizeMeshState(status: SyncStatus, peers: number, webrtc: number): string {
  if (status === "offline") return "Offline · changes sync when reconnected";
  if (webrtc >= 1) {
    const others = Math.max(webrtc, peers - 1);
    return `Connected with ${others} other${others === 1 ? "" : "s"}`;
  }
  if (status === "connecting") return "Looking for others… share the link to invite people";
  return "Just you here · share the link to invite people";
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

  return `${[header, ...rows].join("\n")}\n`;
}

// Each attendee adds ~80 bytes of compressed commitment to the room manifest
// and therefore to the share URL. We default to 12 to keep URLs comfortably
// under WhatsApp/SMS link-preview limits. The hard ceiling is 256.
const DEFAULT_ATTENDEE_COUNT = 12;

function clampAttendeeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ATTENDEE_COUNT;
  }

  return Math.min(256, Math.max(4, Math.trunc(value)));
}

const sampleRosterCsv = `First Name,Last Name,Email,Approval Status
Ada,Lovelace,ada@example.com,approved
Grace,Hopper,grace@example.com,approved
Katherine,Johnson,katherine@example.com,pending
Grace,Hopper,grace@example.com,approved`;

const samplePollDraft = `Opening poll: What should this session optimize for?
- Practical demos
- Architecture depth
- Security review
- Open Q&A

Closing poll: What should we improve next time?
- Shorter talks
- More Q&A
- Deeper examples`;

const demoSeedPolls: Poll[] = [
  {
    id: "demo-priority",
    title: "What should this session optimize for?",
    options: [
      { id: "demo-practical", label: "Practical demos" },
      { id: "demo-architecture", label: "Architecture depth" },
      { id: "demo-security", label: "Security review" },
      { id: "demo-qa", label: "Open Q&A" }
    ]
  }
];
