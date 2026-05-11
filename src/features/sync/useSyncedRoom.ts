import { useEffect, useState } from "react";
import type { IceServer } from "./iceConfig";
import type { QuestionRecord, RoomManifest, VoteRecord } from "../polls/types";
import { maybeFetchTurnCredentials } from "./iceConfig";
import { createRoomSync, type RoomSync } from "./yjsRoom";

export type SyncStatus = "offline" | "connecting" | "connected";

export function useSyncedRoom(manifest: RoomManifest) {
  const [sync, setSync] = useState<RoomSync | null>(null);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [peers, setPeers] = useState(0);
  const [signalingUrl, setSignalingUrl] = useState("");
  const [activeIceServers, setActiveIceServers] = useState<IceServer[]>([]);

  // Step 1: fetch fresh HMAC credentials from the token server (if configured),
  // then create the WebrtcProvider with the up-to-date ICE server list.
  useEffect(() => {
    let cancelled = false;

    void maybeFetchTurnCredentials().then(() => {
      if (cancelled) return;
      const s = createRoomSync(manifest);
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

    const updateVotes     = () => setVotes(Array.from(sync.votes.values()));
    const updateQuestions = () => setQuestions(Array.from(sync.questions.values()));
    const updatePeers     = () => setPeers(sync.provider?.awareness.getStates().size ?? 1);

    sync.votes.observe(updateVotes);
    sync.questions.observe(updateQuestions);
    sync.provider?.on("status", ({ connected }: { connected: boolean }) => {
      setStatus(connected ? "connected" : "connecting");
      console.info("[sync] status →", connected ? "connected" : "connecting");
    });
    sync.provider?.awareness.on("change", updatePeers);

    updateVotes();
    updateQuestions();

    return () => {
      sync.votes.unobserve(updateVotes);
      sync.questions.unobserve(updateQuestions);
      sync.provider?.awareness.off("change", updatePeers);
      sync.provider?.destroy();
      sync.doc.destroy();
    };
  }, [sync]);

  return {
    votes,
    questions,
    status,
    peers,
    signalingUrl,
    activeIceServers,
    publishVote(vote: VoteRecord) {
      sync?.votes.set(vote.id, vote);
    },
    publishQuestion(question: QuestionRecord) {
      sync?.questions.set(question.id, question);
    },
  };
}
