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

type SimplePeer = {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  _pc?: RTCPeerConnection;
};

type WebrtcConnInternal = {
  peer: SimplePeer;
  remotePeerId: string;
};

type RoomInternal = {
  webrtcConns: Map<string, WebrtcConnInternal>;
};

/** Attach per-peer ICE debug logging to a SimplePeer instance. */
function hookPeer(peerId: string, peer: SimplePeer) {
  const short = peerId.slice(0, 8);

  peer.on("connect", () => {
    console.info(`[ice] ✅ CONNECTED to peer ${short}`);
  });

  peer.on("close", () => {
    console.warn(`[ice] ❌ CLOSED peer ${short}`);
  });

  peer.on("error", (err: unknown) => {
    console.error(`[ice] ⚠️ ERROR peer ${short}:`, err);
  });

  peer.on("signal", (data: unknown) => {
    const sig = data as Record<string, unknown>;
    if (sig.type === "offer") {
      console.info(`[ice] → OFFER sent to ${short}`);
    } else if (sig.type === "answer") {
      console.info(`[ice] → ANSWER sent to ${short}`);
    } else if (sig.candidate) {
      const cand = ((sig.candidate as Record<string, unknown>).candidate as string) ?? "";
      const type = cand.includes(" relay ")
        ? "RELAY 🔀"
        : cand.includes(" srflx ")
          ? "SRFLX 🔭"
          : "HOST 🏠";
      console.info(`[ice] → candidate ${type} to ${short}: ${cand.slice(0, 120)}`);
    }
  });

  // Poll the underlying RTCPeerConnection state once a second for up to 40s
  let ticks = 0;
  const poll = setInterval(() => {
    const pc = peer._pc;
    if (pc) {
      console.debug(
        `[ice] ${short} iceConnection=${pc.iceConnectionState}` +
          ` connection=${pc.connectionState}` +
          ` signaling=${pc.signalingState}`
      );
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed" ||
        pc.iceConnectionState === "failed" ||
        ++ticks > 40
      ) {
        clearInterval(poll);
      }
    } else if (++ticks > 40) {
      clearInterval(poll);
    }
  }, 1000);
}

export function createRoomSync(manifest: RoomManifest): RoomSync {
  const doc = new Y.Doc();
  const votes = doc.getMap<VoteRecord>("votes");
  const questions = doc.getMap<QuestionRecord>("questions");
  let provider: WebrtcProvider | null = null;

  const signalingUrl = loadSignalingUrl() || appConfig.signalingUrl;
  const iceServers = loadIceServers();

  console.info("[sync] signaling:", signalingUrl);
  console.info(
    "[sync] ICE servers:",
    iceServers
      .map((s) => `${s.urls}${s.username ? ` (user=${s.username.slice(0, 8)}…)` : ""}`)
      .join(", ")
  );

  try {
    provider = new WebrtcProvider(`anon-conf-poll:${manifest.roomId}`, doc, {
      signaling: [signalingUrl],
      peerOpts: {
        config: { iceServers }
      }
    });

    // Log signaling WebSocket open/close/error events
    const ws = (
      provider as unknown as {
        signalingConns?: {
          ws?: {
            addEventListener?: (...a: unknown[]) => void;
          };
        }[];
      }
    ).signalingConns?.[0]?.ws;

    if (ws?.addEventListener) {
      ws.addEventListener("open", () => console.info("[sync] signaling WS opened:", signalingUrl));
      ws.addEventListener("close", (e: unknown) => console.warn("[sync] signaling WS closed:", e));
      ws.addEventListener("error", (e: unknown) => console.error("[sync] signaling WS error:", e));
    }

    // Hook into y-webrtc peer lifecycle events
    provider.on("peers", (event: unknown) => {
      const ev = event as {
        added: string[];
        removed: string[];
        webrtcPeers: string[];
        bcPeers: string[];
      };
      console.info("[sync] peers event →", {
        added: ev.added.map((id) => id.slice(0, 8)),
        removed: ev.removed.map((id) => id.slice(0, 8)),
        webrtcTotal: ev.webrtcPeers.length,
        bcTotal: ev.bcPeers.length
      });

      // Attach ICE debug hooks to newly discovered WebRTC peers
      const room = (provider as unknown as { room?: RoomInternal }).room;
      if (room) {
        ev.added.forEach((peerId) => {
          const conn = room.webrtcConns.get(peerId);
          if (conn?.peer) hookPeer(peerId, conn.peer);
        });
      }
    });

    // Periodic diagnostic snapshot (every 10 s) + re-announce if no peers
    const diagInterval = setInterval(() => {
      const prov = provider as unknown as {
        room?: RoomInternal;
        signalingConns?: Array<{ connected: boolean; send: (m: unknown) => void }>;
      };
      const room = prov.room;
      if (!room) return;

      const conns = room.webrtcConns;
      if (conns.size === 0) {
        console.debug("[sync] diagnostic: no WebRTC peers yet — sending re-announce");
        // Force a fresh announce to all signaling connections so peers that
        // connected before us (or missed our initial announce) can see us.
        const sigConns = prov.signalingConns ?? [];
        sigConns.forEach((conn) => {
          if (conn.connected) {
            conn.send({
              type: "publish",
              topic: (room as unknown as { roomName: string }).roomName,
              data: { type: "announce", from: (room as unknown as { peerId: string }).peerId }
            });
          }
        });
      } else {
        conns.forEach((conn, peerId) => {
          const pc = conn.peer._pc;
          console.debug(
            `[sync] diagnostic: peer ${peerId.slice(0, 8)}` +
              ` ice=${pc?.iceConnectionState ?? "n/a"}` +
              ` conn=${pc?.connectionState ?? "n/a"}`
          );
        });
      }
    }, 10_000);

    // Clean up the diagnostic interval when the provider is destroyed
    const origDestroy = provider.destroy.bind(provider);
    provider.destroy = () => {
      clearInterval(diagInterval);
      origDestroy();
    };
  } catch (err) {
    console.error("[sync] WebrtcProvider failed:", err);
    provider = null;
  }

  return { doc, votes, questions, provider, signalingUrl, iceServers };
}
