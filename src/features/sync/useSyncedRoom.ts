import { useCallback, useEffect, useRef, useState } from "react";
import type { IceServer } from "./iceConfig";
import type { SignedPhase, SignedPoll } from "../host/signing";
import type { QuestionRecord, RoomManifest, VoteRecord } from "../polls/types";
import { maybeFetchTurnCredentials } from "./iceConfig";
import { createRoomSync, type RoomSync } from "./yjsRoom";

export type SyncStatus = "offline" | "connecting" | "connected";

type SignalingConnLike = {
  connected: boolean;
  send: (m: unknown) => void;
};

type RoomLike = {
  roomName: string;
  peerId: string;
  webrtcConns: Map<string, unknown>;
};

export function useSyncedRoom(manifest: RoomManifest) {
  const [sync, setSync] = useState<RoomSync | null>(null);
  const syncRef = useRef<RoomSync | null>(null);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [signedPolls, setSignedPolls] = useState<SignedPoll[]>([]);
  const [signedPhase, setSignedPhase] = useState<SignedPhase | null>(null);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [peers, setPeers] = useState(0);
  const [signalingUrl, setSignalingUrl] = useState("");
  const [activeIceServers, setActiveIceServers] = useState<IceServer[]>([]);

  // Debug counters visible in the UI without DevTools
  const [announcedPeers, setAnnouncedPeers] = useState(0); // peers seen via signaling
  const [webrtcPeers, setWebrtcPeers] = useState(0); // peers with an active WebRTC conn
  const [reannounceCount, setReannounceCount] = useState(0); // how many times we've re-announced

  // Step 1: fetch fresh HMAC credentials from the token server (if configured),
  // then create the WebrtcProvider with the up-to-date ICE server list.
  useEffect(() => {
    let cancelled = false;

    void maybeFetchTurnCredentials().then(() => {
      if (cancelled) return;
      const s = createRoomSync(manifest);
      syncRef.current = s;
      setSync(s);
      setSignalingUrl(s.signalingUrl);
      setActiveIceServers(s.iceServers);
    });

    return () => {
      cancelled = true;
    };
  }, [manifest]);

  // Step 2: wire up Yjs observers once the sync object is ready.
  useEffect(() => {
    if (!sync) return;

    setStatus(sync.provider ? "connecting" : "offline");
    setPeers(sync.provider?.awareness.getStates().size ?? 1);

    const updateVotes = () => setVotes(Array.from(sync.votes.values()));
    const updateQuestions = () => setQuestions(Array.from(sync.questions.values()));
    const updatePolls = () => setSignedPolls(Array.from(sync.polls.values()));
    const updatePhase = () => setSignedPhase(sync.phase.get("current") ?? null);
    const updatePeers = () => setPeers(sync.provider?.awareness.getStates().size ?? 1);

    sync.votes.observe(updateVotes);
    sync.questions.observe(updateQuestions);
    sync.polls.observe(updatePolls);
    sync.phase.observe(updatePhase);

    sync.provider?.on("status", ({ connected }: { connected: boolean }) => {
      setStatus(connected ? "connected" : "connecting");
      console.info("[sync] status →", connected ? "connected" : "connecting");
    });

    sync.provider?.awareness.on("change", updatePeers);

    // Track peers announced via signaling and WebRTC connection count
    sync.provider?.on("peers", (event: unknown) => {
      const ev = event as {
        added: string[];
        removed: string[];
        webrtcPeers: string[];
        bcPeers: string[];
      };
      setAnnouncedPeers((prev) => prev + ev.added.length - ev.removed.length);
      setWebrtcPeers(ev.webrtcPeers.length);
    });

    updateVotes();
    updateQuestions();
    updatePolls();
    updatePhase();

    return () => {
      sync.votes.unobserve(updateVotes);
      sync.questions.unobserve(updateQuestions);
      sync.polls.unobserve(updatePolls);
      sync.phase.unobserve(updatePhase);
      sync.provider?.awareness.off("change", updatePeers);
      sync.provider?.destroy();
      sync.doc.destroy();
      syncRef.current = null;
    };
  }, [sync]);

  /** Manually send a fresh announce to all connected signaling servers. */
  const forceReannounce = useCallback(() => {
    const s = syncRef.current;
    if (!s?.provider) return;
    const prov = s.provider as unknown as {
      room?: RoomLike;
      signalingConns?: SignalingConnLike[];
    };
    const room = prov.room;
    const sigConns = prov.signalingConns ?? [];
    if (!room) {
      console.warn("[sync] forceReannounce: room not ready");
      return;
    }
    let sent = 0;
    sigConns.forEach((conn) => {
      if (conn.connected) {
        conn.send({
          type: "publish",
          topic: room.roomName,
          data: { type: "announce", from: room.peerId }
        });
        sent++;
      }
    });
    console.info(`[sync] forceReannounce: sent to ${sent} signaling conn(s)`);
    setReannounceCount((prev) => prev + 1);
  }, []);

  return {
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
    publishVote(vote: VoteRecord) {
      sync?.votes.set(vote.id, vote);
    },
    publishQuestion(question: QuestionRecord) {
      sync?.questions.set(question.id, question);
    },
    publishSignedPoll(signed: SignedPoll) {
      sync?.polls.set(signed.poll.id, signed);
    },
    removePoll(pollId: string) {
      sync?.polls.delete(pollId);
    },
    publishSignedPhase(signed: SignedPhase) {
      sync?.phase.set("current", signed);
    }
  };
}
