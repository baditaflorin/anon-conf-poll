import { useEffect, useMemo, useState } from "react";
import type { QuestionRecord, RoomManifest, VoteRecord } from "../polls/types";
import { createRoomSync } from "./yjsRoom";

export type SyncStatus = "offline" | "connecting" | "connected";

export function useSyncedRoom(manifest: RoomManifest) {
  const sync = useMemo(() => createRoomSync(manifest), [manifest]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [status, setStatus] = useState<SyncStatus>(sync.provider ? "connecting" : "offline");
  const [peers, setPeers] = useState(0);

  useEffect(() => {
    const updateVotes = () => setVotes(Array.from(sync.votes.values()));
    const updateQuestions = () => setQuestions(Array.from(sync.questions.values()));
    const updatePeers = () => setPeers(sync.provider?.awareness.getStates().size ?? 1);

    sync.votes.observe(updateVotes);
    sync.questions.observe(updateQuestions);
    sync.provider?.on("status", ({ connected }: { connected: boolean }) => {
      setStatus(connected ? "connected" : "connecting");
    });
    sync.provider?.awareness.on("change", updatePeers);

    updateVotes();
    updateQuestions();
    updatePeers();

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
    publishVote(vote: VoteRecord) {
      sync.votes.set(vote.id, vote);
    },
    publishQuestion(question: QuestionRecord) {
      sync.questions.set(question.id, question);
    }
  };
}
