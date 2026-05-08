import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import { appConfig } from "../../shared/config";
import type { QuestionRecord, RoomManifest, VoteRecord } from "../polls/types";

export type RoomSync = {
  doc: Y.Doc;
  votes: Y.Map<VoteRecord>;
  questions: Y.Map<QuestionRecord>;
  provider: WebrtcProvider | null;
};

export function createRoomSync(manifest: RoomManifest): RoomSync {
  const doc = new Y.Doc();
  const votes = doc.getMap<VoteRecord>("votes");
  const questions = doc.getMap<QuestionRecord>("questions");
  let provider: WebrtcProvider | null = null;

  try {
    provider = new WebrtcProvider(`anon-conf-poll:${manifest.roomId}`, doc, {
      signaling: [appConfig.signalingUrl]
    });
  } catch {
    provider = null;
  }

  return { doc, votes, questions, provider };
}
