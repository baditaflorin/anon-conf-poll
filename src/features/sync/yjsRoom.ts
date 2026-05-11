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
  signalingUrl: string;
  iceServers: ReturnType<typeof loadIceServers>;
};

export function createRoomSync(manifest: RoomManifest): RoomSync {
  const doc = new Y.Doc();
  const votes = doc.getMap<VoteRecord>("votes");
  const questions = doc.getMap<QuestionRecord>("questions");
  let provider: WebrtcProvider | null = null;

  const signalingUrl = loadSignalingUrl() || appConfig.signalingUrl;
  const iceServers = loadIceServers();

  console.info("[sync] signaling:", signalingUrl);
  console.info("[sync] ICE servers:", iceServers.map(s => s.urls).join(", "));

  try {
    provider = new WebrtcProvider(`anon-conf-poll:${manifest.roomId}`, doc, {
      signaling: [signalingUrl],
      peerOpts: {
        config: { iceServers }
      }
    });

    // Log signaling WebSocket open/close so it's visible in DevTools
    const ws = (provider as unknown as { signalingConns?: { ws?: { readyState?: number; url?: string; addEventListener?: (...a: unknown[]) => void } }[] }).signalingConns?.[0]?.ws;
    if (ws && ws.addEventListener) {
      ws.addEventListener("open", () => console.info("[sync] signaling WS opened:", signalingUrl));
      ws.addEventListener("close", (e: unknown) => console.warn("[sync] signaling WS closed:", e));
      ws.addEventListener("error", (e: unknown) => console.error("[sync] signaling WS error:", e));
    }
  } catch (err) {
    console.error("[sync] WebrtcProvider failed:", err);
    provider = null;
  }

  return { doc, votes, questions, provider, signalingUrl, iceServers };
}
