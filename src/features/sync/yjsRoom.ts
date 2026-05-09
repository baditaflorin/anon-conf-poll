import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import { appConfig } from "../../shared/config";
import type { QuestionRecord, RoomManifest, VoteRecord } from "../polls/types";
import { loadIceServers, loadSignalingUrl } from "./iceConfig";

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

  const signalingUrl = loadSignalingUrl() || appConfig.signalingUrl;
  const iceServers = loadIceServers();

  try {
    provider = new WebrtcProvider(`anon-conf-poll:${manifest.roomId}`, doc, {
      signaling: [signalingUrl],
      peerOpts: {
        config: { iceServers }
      }
    });
  } catch {
    provider = null;
  }

  return { doc, votes, questions, provider };
}
