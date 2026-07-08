import { LitElement, html } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "./utils/icons";

// Import components to register them as custom elements
import "./components/common/ll-header";
import "./components/common/ll-badge";
import "./components/dashboard/ll-hero";
import "./components/dashboard/ll-carousel";
import "./components/dashboard/ll-mdns-list";
import "./components/session/ll-viewer";
import "./components/session/ll-chat";
import "./components/session/ll-voice";
import "./components/modals/modal-password";
import "./components/modals/modal-saver";

// Import core utilities and signaling engines
import { getTheme, setTheme, getNickname, setNickname } from "./utils/storage";
import { hashPassword, verifyPassword } from "./utils/crypto";
import { captureScreen, stopMediaStream } from "./infrastructure/webrtc-stream";
import { captureMicrophone, setStreamAudioEnabled } from "./infrastructure/voip-audio";
import type { LANRoom } from "./infrastructure/mdns-signaling";
import { SIGNALING_URL, ICE_SERVERS } from "./config";

@customElement("my-element")
export class MyElement extends LitElement {
  firstUpdated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }
  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);

    // Safely assign srcObject to the host preview video element to prevent flickering
    const videoEl = this.querySelector("#sharing-active-workspace video") as HTMLVideoElement | null;
    if (videoEl && videoEl.srcObject !== this.screenStream) {
      videoEl.srcObject = this.screenStream;
    }

    if (
      changedProperties.has("currentScreen") ||
      changedProperties.has("nicknameModalOpen") ||
      changedProperties.has("proModalOpen") ||
      changedProperties.has("toastVisible") ||
      changedProperties.has("alertModalOpen") ||
      changedProperties.has("hasSavedHostSession") ||
      changedProperties.has("localMuted") ||
      changedProperties.has("speakerMuted")
    ) {
      createIcons({
        icons: globalIcons,
        root: this,
      });
    }
  }
  // Use Light DOM for seamless styling via tailwind.css and global plugins
  createRenderRoot() {
    return this;
  }

  // Coordinator state
  @state() private currentScreen: "landing" | "host" | "viewer" = "landing";
  @state() private hostSetupOpen: boolean = false;
  @state() private isRoomLocked: boolean = false;
  @state() private hostPasswordHash: string = hashPassword("");
  @state() private hasSavedHostSession: boolean = false;
  @state() private savedHostRoomCode: string = "";
  @state() private currentNickname: string = "참여자";
  @state() private currentTheme: string = "light";
  @state() private carouselIndex: number = 0;
  @state() private viewerCount: number = 0;
  @state() private localMuted: boolean = true;
  @state() private speakerMuted: boolean = false;
  @state() private micVolume: number = 100;
  @state() private speakerVolume: number = 100;
  @state() private scannedRooms: LANRoom[] = [];
  @state() private serverDetectedIp: string = "";
  @state() private pendingRoomJoinCode: string = "";
  @state() private pendingRoomJoinIp: string = "";
  @state() private isSignalingConnected: boolean = false;
  @state() private screenQualityPreset: "FHD" | "HD" | "SD" = "FHD";
  @state() private qualityDropdownOpen: boolean = false;
  @state() private remoteControlAllowed: boolean = false;
  @state() private isAgentConnected: boolean = false;

  // Active room details
  @state() private activeRoomName: string = "";
  @state() private activeRoomIp: string = "";
  @state() private activeRoomCode: string = "15";

  // Chatting message logs
  @state() private chatMessages: Array<{ sender: string; content: string; system?: boolean }> = [
    {
      sender: "System",
      content: "📢 안내: 채팅방 대화 내역은 저장되지 않고, 방 종료시 대화내용은 삭제됩니다.",
      system: true,
    },
  ];

  // Modals & Overlays toggles
  @state() private nicknameModalOpen: boolean = false;
  @state() private passwordVerifyModalOpen: boolean = false;
  @state() private proModalOpen: boolean = false;
  @state() private idleSafeguardOpen: boolean = false;
  @state() private idleCountdown: number = 60;
  @state() private activeParticipants: string[] = [];
  @state() private alertModalOpen: boolean = false;
  @state() private alertModalMessage: string = "";

  // Toast feedback state
  @state() private toastMessage: string = "";
  @state() private toastVisible: boolean = false;

  // Temporary join room context
  @state() private tempJoinName: string = "";
  @state() private tempJoinIp: string = "";
  @state() private tempNicknameInput: string = "";

  @query("#input-guest-nickname") private inputGuestNicknameElement?: HTMLInputElement;

  private toastTimeout?: number;
  private carouselInterval?: number;
  private idleTimerInterval?: number;
  private emptyRoomTimeout?: number;

  @state() private screenStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private micGainNode: GainNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micDestNode: MediaStreamAudioDestinationNode | null = null;

  // WebRTC & Signaling properties
  private websocket: WebSocket | null = null;
  private localDirectWs: WebSocket | null = null;
  private viewerId: string = Math.random().toString(36).substring(2, 9);
  private hostConnections = new Map<string, RTCPeerConnection>();
  private hostDataChannels = new Map<string, RTCDataChannel>();
  private hostViewerNicknames = new Map<string, string>();
  private viewerAudioDestNodes = new Map<string, MediaStreamAudioDestinationNode>();
  private hostViewerAudioSources = new Map<string, MediaStreamAudioSourceNode>();
  private viewerConnection: RTCPeerConnection | null = null;
  private viewerDataChannel: RTCDataChannel | null = null;
  @state() protected activeStream: MediaStream | null = null;
  private targetRoomPasswordHash: string = "";

  // Remote Control approval properties
  @state() private remoteControlRequestStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none';
  @state() private approvedViewerId: string | null = null;
  @state() private approvedViewerNickname: string = '';
  @state() private incomingControlRequest: { from: string; nickname: string } | null = null;
  @state() private controlRequestModalOpen: boolean = false;

  // PiP 및 Fallback 팝업 상태 보존용
  private pipWindow: Window | null = null;
  private pipFallbackWindow: Window | null = null;
  private originalChatParent: HTMLElement | null = null;

  connectedCallback() {
    super.connectedCallback();

    // Load local storage states via storage utility
    this.currentTheme = getTheme();
    this.applyTheme(this.currentTheme);
    this.currentNickname = getNickname() || "참여자";

    const myCreatedRoomCode = localStorage.getItem("my_created_room_code");
    if (myCreatedRoomCode) {
      this.isRoomLocked = localStorage.getItem("my_created_room_locked") === "true";
      this.hostPasswordHash = localStorage.getItem("my_created_room_password_hash") || hashPassword("");
      this.hasSavedHostSession = true;
      this.savedHostRoomCode = myCreatedRoomCode;
    }

    // Start auto carousel cycling every 5 seconds
    this.startCarouselInterval();

    window.addEventListener("beforeunload", this.handleBeforeUnload);

    this.initWebSocketSignaling();

    // URL 파라미터 체크 (?room=15&ip=192.168.0.27)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const ipParam = params.get("ip");

    // 만약 URL 파라미터로 들어온 게스트의 입장 시도 room 번호가 내가 개설한 방과 다르다면,
    // 혼란을 방지하기 위해 저장된 내 방 세션 정보를 삭제합니다.
    if (roomParam && myCreatedRoomCode && roomParam !== myCreatedRoomCode) {
      localStorage.removeItem("my_created_room_code");
      localStorage.removeItem("my_created_room_locked");
      localStorage.removeItem("my_created_room_password_hash");
      this.hasSavedHostSession = false;
      this.savedHostRoomCode = "";
    }

    if (roomParam) {
      this.pendingRoomJoinCode = roomParam;
      this.pendingRoomJoinIp = ipParam || "";
      this.showToast(`🔗 공유방 링크 감지: 방 정보 확인 후 입장을 시도합니다.`);

      // 1.5초 내에 공인 IP 대조 방 목록 응답이 지연되거나 실패할 시, 직접 IP 접속 폴백 수행
      setTimeout(() => {
        if (this.pendingRoomJoinCode) {
          const code = this.pendingRoomJoinCode;
          const ip = this.pendingRoomJoinIp;
          this.pendingRoomJoinCode = "";
          this.pendingRoomJoinIp = "";
          this.showToast(`⚡ 네트워크 지연 발생: 직접 연결 주소(${ip || "로컬"})로 다이렉트 입장을 시도합니다.`);
          this.checkPasswordAndJoin(`공유 회의방 (${code})`, ip || window.location.hostname, false);
        }
      }, 1500);
    }
  }

  disconnectedCallback() {
    this.stopCarouselInterval();
    this.stopIdleTimer();
    this.cleanupMediaStreams();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    if (this.currentScreen === "host") {
      this.sendSignalingMessage({ type: "room-unregister", ip: this.serverDetectedIp || window.location.hostname });
      this.sendSignalingMessage({ type: "leave", from: "host", to: "all" });
    } else if (this.currentScreen === "viewer") {
      this.sendSignalingMessage({ type: "leave", from: this.viewerId, to: "host" });
    }

    this.hostConnections.forEach((pc) => pc.close());
    this.hostConnections.clear();
    this.hostDataChannels.clear();
    this.hostViewerNicknames.clear();
    if (this.viewerConnection) {
      this.viewerConnection.close();
      this.viewerConnection = null;
    }
    if (this.viewerDataChannel) {
      this.viewerDataChannel.close();
      this.viewerDataChannel = null;
    }
    this.activeStream = null;

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isSignalingConnected = false;

    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    super.disconnectedCallback();
  }

  private updateParticipants() {
    const rawList = [this.currentNickname, ...Array.from(this.hostViewerNicknames.values())];
    // Remove duplicate participant nicknames (e.g. from duplicate tabs or reconnecting states)
    const list = Array.from(new Set(rawList));
    this.activeParticipants = list;
    this.viewerCount = this.hostConnections.size;

    const packet = {
      type: "participants-update",
      list: list,
    };
    this.hostDataChannels.forEach((channel) => {
      if (channel.readyState === "open") {
        channel.send(JSON.stringify(packet));
      }
    });
  }

  private handleBeforeUnload = () => {
    if (this.currentScreen === "host") {
      this.sendSignalingMessage({ type: "room-unregister", ip: this.serverDetectedIp || window.location.hostname });
      this.sendSignalingMessage({ type: "leave", from: "host", to: "all" });
    } else if (this.currentScreen === "viewer") {
      this.sendSignalingMessage({ type: "leave", from: this.viewerId, to: "host" });
    }
  };

  private initWebSocketSignaling() {
    const signalingUrl = SIGNALING_URL;

    const socket = new WebSocket(signalingUrl);

    socket.onopen = () => {
      // console.log("WebSocket signaling connected.");
      this.websocket = socket;
      this.isSignalingConnected = true;

      if (this.currentScreen === "host") {
        this.sendSignalingMessage({
          type: "room-register",
          from: "host",
          to: "server",
          room: {
            name: `${this.currentNickname} 님의 방`,
            ip: this.serverDetectedIp || window.location.hostname,
            code: this.activeRoomCode,
            locked: this.isRoomLocked,
            passwordHash: this.hostPasswordHash,
            fps: 30,
          },
        });
      }
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "agent-status") {
          this.isAgentConnected = msg.connected;
          this.remoteControlAllowed = msg.connected;
          if (this.isAgentConnected) {
            this.showToast("🔌 로컬 원격 제어 에이전트가 연결되었습니다.");
          } else {
            this.showToast("❌ 로컬 원격 제어 에이전트 연결이 끊어졌습니다.");
          }
          return;
        }

        if (msg.type === "server-info") {
          this.serverDetectedIp = msg.ip;
          this.isAgentConnected = msg.agentConnected || false;
          this.remoteControlAllowed = msg.agentConnected || false;
          // console.log("Server detected IP:", this.serverDetectedIp);

          if (this.currentScreen === "host") {
            this.sendSignalingMessage({
              type: "room-register",
              from: "host",
              to: "server",
              room: {
                name: `${this.currentNickname} 님의 방`,
                ip: this.serverDetectedIp,
                code: this.activeRoomCode,
                locked: this.isRoomLocked,
                passwordHash: this.hostPasswordHash,
                fps: 30,
              },
            });
          }
          return;
        }

        if (msg.type === "room-list-response") {
          this.scannedRooms = msg.rooms;

          if (this.pendingRoomJoinCode) {
            const code = this.pendingRoomJoinCode;

            const foundRoom = this.scannedRooms.find((r) => r.code === code || r.ip === code || r.name.includes(code));
            if (foundRoom) {
              this.checkPasswordAndJoin(foundRoom.name, foundRoom.ip, foundRoom.locked, foundRoom.passwordHash);
            } else {
              // 동일 사내망(WiFi/LAN)이 아니거나 존재하지 않는 방인 경우 다이렉트 조인 차단 및 홈 리다이렉트
              this.pendingRoomJoinCode = "";
              this.pendingRoomJoinIp = "";
              this.showToast("⚠️ 동일한 와이파이(LAN)에 연결되어 있지 않거나 존재하지 않는 방입니다.");
              this.clearUrlParams();
            }
          }
          return;
        }

        if (msg.to !== "host" && msg.to !== this.viewerId && msg.to !== "all") return;
        if (msg.from === this.viewerId) return;

        if (msg.type === "join-request") {
          if (this.currentScreen === "host" && msg.roomCode === this.activeRoomCode) {
            await this.handleJoinRequest(msg.from, msg.nickname);
          }
        } else if (msg.type === "offer") {
          await this.handleOffer(msg.from, msg.sdp);
        } else if (msg.type === "answer") {
          await this.handleAnswer(msg.from, msg.sdp);
        } else if (msg.type === "candidate") {
          await this.handleIceCandidate(msg.from, msg.candidate);
        } else if (msg.type === "leave") {
          this.handlePeerLeave(msg.from);
        }
      } catch (err) {
        console.error("Error handling WebSocket message in client:", err);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket signaling disconnected. Retrying in 3s...");
      this.websocket = null;
      this.isSignalingConnected = false;
      setTimeout(() => {
        if (this.isConnected) {
          this.initWebSocketSignaling();
        }
      }, 3000);
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      this.isSignalingConnected = false;
    };
  }

  // --- WebRTC Signaling Helpers ---
  private sendSignalingMessage(msg: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(msg));
    }
  }

  private async handleJoinRequest(viewerId: string, nickname?: string) {
    if (this.currentScreen !== "host") return;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.handlePeerLeave(viewerId);
      }
    };

    this.hostConnections.set(viewerId, pc);
    this.hostViewerNicknames.set(viewerId, nickname || "참여자");
    this.updateParticipants();

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.screenStream!);
      });
    }

    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    let outgoingAudioTrack: MediaStreamTrack | null = null;
    if (this.audioCtx) {
      const destNode = this.audioCtx.createMediaStreamDestination();
      this.viewerAudioDestNodes.set(viewerId, destNode);

      // 1. Link host's mic source node to this mixer if active
      if (this.micGainNode) {
        this.micGainNode.connect(destNode);
      }

      // 2. Link other existing viewers' audio sources to this viewer's mixer
      this.hostViewerAudioSources.forEach((sourceNode, existingViewerId) => {
        if (existingViewerId !== viewerId) {
          sourceNode.connect(destNode);
        }
      });

      outgoingAudioTrack = destNode.stream.getAudioTracks()[0];
    }

    const audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
    if (outgoingAudioTrack) {
      audioTransceiver.sender.replaceTrack(outgoingAudioTrack);
    } else if (this.micStream && !this.localMuted) {
      const micTrack = this.micStream.getAudioTracks()[0];
      if (micTrack) {
        audioTransceiver.sender.replaceTrack(micTrack);
      }
    }

    const dc = pc.createDataChannel("chat");
    this.hostDataChannels.set(viewerId, dc);
    this.setupDataChannel(dc, viewerId);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Enforce LAN connection: Only send candidate if it is 'typ host' (local LAN IP)
        if (event.candidate.candidate.includes("typ host")) {
          this.sendSignalingMessage({
            type: "candidate",
            from: "host",
            to: viewerId,
            candidate: event.candidate,
          });
        }
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind === "audio") {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        document.querySelectorAll(`audio[data-viewer-id="${viewerId}"]`).forEach((el) => el.remove());
        const audio = document.createElement("audio");
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.style.display = "none";
        audio.dataset.viewerId = viewerId;
        audio.muted = this.speakerMuted;
        document.body.appendChild(audio);

        // 3. Multi-party audio mixing: convert incoming track into AudioNode and relay to all other viewer mix destinations
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioCtx) {
          try {
            const existingSource = this.hostViewerAudioSources.get(viewerId);
            if (existingSource) {
              existingSource.disconnect();
            }

            const sourceNode = this.audioCtx.createMediaStreamSource(remoteStream);
            this.hostViewerAudioSources.set(viewerId, sourceNode);

            // Connect this source node to all other viewers' mixer destinations
            this.viewerAudioDestNodes.forEach((destNode, otherViewerId) => {
              if (otherViewerId !== viewerId) {
                sourceNode.connect(destNode);
              }
            });
          } catch (err) {
            console.error("Failed to map remote audio stream source node:", err);
          }
        }
      }
    };

    const offer = await pc.createOffer();
    const presets = {
      FHD: 2500,
      HD: 1500,
      SD: 800,
    };
    const mungedSdp = setVideoMaxBitrate(offer.sdp || "", presets[this.screenQualityPreset]);
    const updatedOffer = new RTCSessionDescription({
      type: offer.type,
      sdp: mungedSdp,
    });
    await pc.setLocalDescription(updatedOffer);

    const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
    if (videoSender) {
      const bitrates = {
        FHD: 2500000,
        HD: 1500000,
        SD: 800000,
      };
      try {
        const params = videoSender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = bitrates[this.screenQualityPreset];
        await videoSender.setParameters(params);
      } catch (err) {
        console.warn("Failed to set video sender maxBitrate:", err);
      }
    }

    this.sendSignalingMessage({
      type: "offer",
      from: "host",
      to: viewerId,
      sdp: updatedOffer,
    });

    this.showToast(`👥 [${nickname || "참여자"}] 님이 P2P 연결을 수집하고 있습니다.`);
  }

  private async handleAnswer(viewerId: string, sdp: any) {
    const pc = this.hostConnections.get(viewerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  private async handleOffer(_from: string, sdp: any) {
    if (this.currentScreen !== "viewer") return;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });
    this.viewerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Enforce LAN connection: Only send candidate if it is 'typ host' (local LAN IP)
        if (event.candidate.candidate.includes("typ host")) {
          this.sendSignalingMessage({
            type: "candidate",
            from: this.viewerId,
            to: "host",
            candidate: event.candidate,
          });
        }
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.activeStream = event.streams[0];
      }
      if (event.track.kind === "audio") {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        document.querySelectorAll("#viewer-received-audio").forEach((el) => el.remove());
        const audio = document.createElement("audio");
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.style.display = "none";
        audio.id = "viewer-received-audio";
        audio.muted = this.speakerMuted;
        document.body.appendChild(audio);
      }
    };

    pc.ondatachannel = (event) => {
      this.viewerDataChannel = event.channel;
      this.setupDataChannel(event.channel, "host");
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Force client audio transceiver to be sendrecv to keep the microphone transmission path open
    const audioTransceiver = pc
      .getTransceivers()
      .find(
        (t) =>
          (t.receiver.track && t.receiver.track.kind === "audio") || (t.sender.track && t.sender.track.kind === "audio")
      );
    if (audioTransceiver) {
      audioTransceiver.direction = "sendrecv";
      if (this.micStream) {
        const micTrack = this.micStream.getAudioTracks()[0];
        if (micTrack) {
          audioTransceiver.sender.replaceTrack(micTrack);
        }
      }
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: "answer",
      from: this.viewerId,
      to: "host",
      sdp: answer,
    });
  }

  private async handleIceCandidate(from: string, candidate: any) {
    if (this.currentScreen === "host") {
      const pc = this.hostConnections.get(from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } else if (this.currentScreen === "viewer" && from === "host") {
      if (this.viewerConnection) {
        await this.viewerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  }

  private handlePeerLeave(from: string) {
    if (this.currentScreen === "host") {
      const pc = this.hostConnections.get(from);
      if (pc) {
        pc.close();
        this.hostConnections.delete(from);
      }
      const dc = this.hostDataChannels.get(from);
      if (dc) {
        dc.close();
        this.hostDataChannels.delete(from);
      }
      const nickname = this.hostViewerNicknames.get(from) || "참여자";
      this.hostViewerNicknames.delete(from);
      this.updateParticipants();

      // Clean up multi-party audio mixing nodes for this peer
      const destNode = this.viewerAudioDestNodes.get(from);
      if (destNode) {
        try {
          destNode.disconnect();
        } catch (e) {}
        this.viewerAudioDestNodes.delete(from);
      }
      const sourceNode = this.hostViewerAudioSources.get(from);
      if (sourceNode) {
        try {
          sourceNode.disconnect();
        } catch (e) {}
        this.hostViewerAudioSources.delete(from);
      }

      document.querySelectorAll(`audio[data-viewer-id="${from}"]`).forEach((el) => el.remove());
      this.showToast(`🚪 [${nickname}] 님이 퇴장하셨습니다.`);
    } else if (this.currentScreen === "viewer" && from === "host") {
      this.leaveSession();
      this.showToast("🛑 호스트가 공유를 중단하여 메인으로 대기합니다.");
    }
  }

  private setupDataChannel(channel: RTCDataChannel, _remotePeerId: string) {
    channel.onopen = () => {
      if (this.currentScreen === "host") {
        this.updateParticipants();
      } else if (this.currentScreen === "viewer") {
        channel.send(JSON.stringify({ type: "request-participants" }));
      }
    };

    channel.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === "request-participants") {
          if (this.currentScreen === "host") {
            this.updateParticipants();
          }
          return;
        }
        if (packet.type === "participants-update") {
          this.activeParticipants = packet.list;
          this.viewerCount = packet.list.length - 1;
          return;
        }
        if (packet.type === "remote-control-request") {
          if (this.currentScreen === "host") {
            this.incomingControlRequest = { from: packet.from, nickname: packet.nickname };
            this.controlRequestModalOpen = true;
          }
          return;
        }
        if (packet.type === "remote-control-response") {
          if (this.currentScreen === "viewer") {
            if (packet.approved) {
              this.remoteControlRequestStatus = 'approved';
              this.remoteControlAllowed = true;
              this.showToast("⚡ 원격 제어 요청이 수락되었습니다! 이제 화면을 조작할 수 있습니다.");
            } else {
              this.remoteControlRequestStatus = 'rejected';
              this.remoteControlAllowed = false;
              this.showToast("❌ 원격 제어 요청이 거절되었습니다.");
            }
          }
          return;
        }
        if (packet.type === "control-action") {
          if (this.currentScreen === "host" && this.remoteControlAllowed && packet.sender === this.approvedViewerId) {
            if (this.localDirectWs && this.localDirectWs.readyState === WebSocket.OPEN) {
              this.localDirectWs.send(JSON.stringify(packet.action));
            } else if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
              this.sendSignalingMessage({
                type: "agent-control",
                control: packet.action
              });
            }
          }
          return;
        }
        if (packet.sender && packet.content) {
          this.chatMessages = [...this.chatMessages, { sender: packet.sender, content: packet.content }];
          setTimeout(() => {
            const chatBox = document.getElementById("chat-messages-box");
            if (chatBox) {
              chatBox.scrollTop = chatBox.scrollHeight;
            }
          }, 50);
        }
      } catch (e) {
        console.error("Failed to parse chat message:", e);
      }
    };
  }

  // --- Theme Manager ---
  private applyTheme(theme: string) {
    const htmlElement = document.documentElement;
    htmlElement.classList.remove("dark");
    if (theme === "dark") {
      htmlElement.classList.add("dark");
    } else if (theme === "light") {
      htmlElement.classList.remove("dark");
    } else if (theme === "system") {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemPrefersDark) {
        htmlElement.classList.add("dark");
      } else {
        htmlElement.classList.remove("dark");
      }
    }
  }

  private changeThemeMode(mode: string) {
    this.currentTheme = mode;
    setTheme(mode);
    this.applyTheme(mode);
    this.showToast(
      `☀️ 테마 설정이 [${mode === "light" ? "밝은 테마" : mode === "dark" ? "어두운 테마" : "시스템 연동"}]로 설정되었습니다.`
    );
  }

  private onThemeChange(e: CustomEvent<{ theme: string }>) {
    this.changeThemeMode(e.detail.theme);
  }

  // --- Carousel Controller ---
  private onSwitchCarousel(e: CustomEvent<{ index: number }>) {
    this.carouselIndex = e.detail.index;
    this.stopCarouselInterval();
    this.startCarouselInterval();
  }

  private startCarouselInterval() {
    this.carouselInterval = window.setInterval(() => {
      this.carouselIndex = (this.carouselIndex + 1) % 3;
    }, 5000);
  }

  private stopCarouselInterval() {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
    }
  }

  // --- Toast Manager ---
  private showToast(msg: string) {
    this.toastMessage = msg;
    this.toastVisible = true;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = window.setTimeout(() => {
      this.toastVisible = false;
    }, 3000);
  }

  // --- Host Drawer and Configuration ---
  private toggleHostSetupDrawer() {
    this.hostSetupOpen = !this.hostSetupOpen;
  }

  private onToggleLock(e: CustomEvent<{ checked: boolean }>) {
    this.isRoomLocked = e.detail.checked;
    if (this.isRoomLocked) {
      this.showToast("🔒 잠금이 활성화되었습니다.");
    } else {
      this.showToast("🔓 잠금이 비활성화되었습니다.");
    }
  }

  // --- Broadcast (Host Mode) Simulation ---
  private generateRoomCode(): string {
    // 10~99 사이의 외우기 쉬운 2자리 방 번호 생성
    return String(Math.floor(10 + Math.random() * 90));
  }

  private getShareUrl(): string {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      window.location.port !== "";

    if (isLocal) {
      const ip = this.serverDetectedIp || hostname;
      const port = window.location.port ? `:${window.location.port}` : ":5173";
      return `http://${ip}${port}/pn-lanlink-app/?room=${this.activeRoomCode}&ip=${ip}`;
    } else {
      const origin = window.location.origin; // e.g. https://khwoo91.github.io
      const path = window.location.pathname; // e.g. /pn-lanlink-app/
      const ip = this.serverDetectedIp || hostname;
      return `${origin}${path}?room=${this.activeRoomCode}&ip=${ip}`;
    }
  }

  private openAlertModal(message: string) {
    this.alertModalMessage = message;
    this.alertModalOpen = true;
  }

  private closeAlertModal() {
    this.alertModalOpen = false;
  }

  private async onStartSharing(e: CustomEvent<{ password: string }>) {
    // console.log("[LANLink debug] onStartSharing:", {
    //   password: e.detail.password,
    //   isRoomLocked: this.isRoomLocked,
    //   hashGenerated: hashPassword(e.detail.password || ""),
    // });
    if (this.isRoomLocked && (!e.detail.password || e.detail.password.trim() === "")) {
      this.openAlertModal("비밀번호를 설정해주세요.");
      return;
    }

    this.hostPasswordHash = hashPassword(e.detail.password || "");

    // Generate dynamic room code
    this.activeRoomCode = this.generateRoomCode();

    // 로컬 스토리지에 내가 개설한 방 코드 저장 (새로고침 시 방장 권한 복구용)
    localStorage.setItem("my_created_room_code", this.activeRoomCode);
    localStorage.setItem("my_created_room_locked", String(this.isRoomLocked));
    localStorage.setItem("my_created_room_password_hash", this.hostPasswordHash);

    // Simulate real screen capture stream
    this.screenStream = await captureScreen();
    if (this.screenStream) {
      await this.applyQualityPreset(this.screenQualityPreset);
      this.syncSharedBoundsToAgent();
    }

    this.hostSetupOpen = false;
    this.currentScreen = "host";
    this.viewerCount = 0;
    this.queryAgentStatus();
    this.showToast("🚀 화면 공유 스트리밍이 정상 개설되었습니다!");

    // Register room via WebSocket signaling
    this.sendSignalingMessage({
      type: "room-register",
      from: "host",
      to: "server",
      room: {
        name: `${this.currentNickname} 님의 방`,
        ip: this.serverDetectedIp || window.location.hostname,
        code: this.activeRoomCode,
        locked: this.isRoomLocked,
        passwordHash: this.hostPasswordHash,
        fps: 30,
      },
    });

    this.activeParticipants = [this.currentNickname];
  }

  private stopSharing() {
    this.currentScreen = "landing";
    this.viewerCount = 0;
    this.activeParticipants = [];
    this.stopIdleTimer();
    this.idleSafeguardOpen = false;

    // 로컬 스토리지 방 코드 정리 및 0명 폭파 타이머 정리
    localStorage.removeItem("my_created_room_code");
    localStorage.removeItem("my_created_room_locked");
    localStorage.removeItem("my_created_room_password_hash");
    this.hasSavedHostSession = false;
    this.savedHostRoomCode = "";

    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
      this.emptyRoomTimeout = undefined;
    }

    this.cleanupMediaStreams();
    this.showToast("⏹️ 화면 공유 방송을 종료하고 메인으로 대기합니다.");

    // Unregister room via WebSocket signaling
    this.sendSignalingMessage({
      type: "room-unregister",
      from: "host",
      to: "server",
      ip: this.serverDetectedIp || window.location.hostname,
    });
  }

  private async restoreHostSession() {
    const myCreatedRoomCode = localStorage.getItem("my_created_room_code");
    if (!myCreatedRoomCode) {
      this.hasSavedHostSession = false;
      this.savedHostRoomCode = "";
      return;
    }

    // 1. 화면 캡처 수행 (사용자 제스처 컨텍스트)
    const stream = await captureScreen();
    if (!stream) {
      this.showToast("⚠️ 화면 공유 복원이 취소되었습니다.");
      return;
    }
    this.screenStream = stream;
    await this.applyQualityPreset(this.screenQualityPreset);
    this.syncSharedBoundsToAgent();

    // 2. 방장 설정 상태 복원
    this.activeRoomCode = myCreatedRoomCode;
    this.isRoomLocked = localStorage.getItem("my_created_room_locked") === "true";
    this.hostPasswordHash = localStorage.getItem("my_created_room_password_hash") || hashPassword("");
    this.hasSavedHostSession = false;

    this.hostSetupOpen = false;
    this.currentScreen = "host";
    this.viewerCount = 0;
    this.activeParticipants = [this.currentNickname];

    // 3. 시그널링 서버에 동일 방 정보로 재등록
    this.sendSignalingMessage({
      type: "room-register",
      from: "host",
      to: "server",
      room: {
        name: `${this.currentNickname} 님의 방`,
        ip: this.serverDetectedIp || window.location.hostname,
        code: this.activeRoomCode,
        locked: this.isRoomLocked,
        passwordHash: this.hostPasswordHash,
        fps: 30,
      },
    });

    this.showToast("🚀 이전 화면 공유방이 성공적으로 재연결되었습니다!");
  }

  private clearSavedHostSession() {
    localStorage.removeItem("my_created_room_code");
    localStorage.removeItem("my_created_room_locked");
    localStorage.removeItem("my_created_room_password_hash");
    this.hasSavedHostSession = false;
    this.savedHostRoomCode = "";
    this.showToast("🗑️ 이전 화면공유방이 삭제되었습니다.");
  }

  private async changeSharedScreen() {
    try {
      const newStream = await captureScreen();
      if (!newStream) return;

      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => track.stop());
      }

      this.screenStream = newStream;
      await this.applyQualityPreset(this.screenQualityPreset);
      this.syncSharedBoundsToAgent();

      const videoTrack = newStream.getVideoTracks()[0];
      this.hostConnections.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });

      this.showToast("🔄 공유 화면이 성공적으로 변경되었습니다.");
    } catch (e) {
      console.error("Failed to change shared screen:", e);
      this.showToast("❌ 화면 공유 변경에 실패했습니다.");
    }
  }

  // --- Room Join (Guest Viewer Mode) Simulation ---
  private onJoinRoom(e: CustomEvent<{ code: string }>) {
    const inputVal = e.detail.code.trim();
    if (!inputVal) {
      this.showToast("⚠️ 입장 코드 또는 링크를 입력해주세요.");
      return;
    }

    let code = inputVal;
    if (inputVal.includes("?room=")) {
      try {
        const urlObj = new URL(inputVal);
        code = urlObj.searchParams.get("room") || inputVal;
      } catch (e) {
        const match = inputVal.match(/[?&]room=([^&]+)/);
        if (match) code = match[1];
      }
    }

    const rooms = this.scannedRooms;
    const foundRoom = rooms.find((r) => r.ip === code || r.code === code || r.name.includes(code));

    if (foundRoom) {
      this.pendingRoomJoinCode = foundRoom.code;
      this.checkPasswordAndJoin(foundRoom.name, foundRoom.ip, foundRoom.locked, foundRoom.passwordHash);
    } else {
      // 대기방 목록에 없더라도 입력된 숫자를 룸 번호로 간주하여 강제 다이렉트 조인 시도
      this.pendingRoomJoinCode = code;
      const params = new URLSearchParams(window.location.search);
      const ipParam = params.get("ip") || window.location.hostname;
      this.checkPasswordAndJoin(`화면 공유방 (${code})`, ipParam, false);
    }
  }

  private onSelectRoom(
    e: CustomEvent<{ name: string; ip: string; locked: boolean; code: string; passwordHash?: string }>
  ) {
    this.pendingRoomJoinCode = e.detail.code;
    this.checkPasswordAndJoin(e.detail.name, e.detail.ip, e.detail.locked, e.detail.passwordHash);
  }

  private checkPasswordAndJoin(name: string, ip: string, isLocked: boolean, passwordHash?: string) {
    // console.log("[LANLink debug] checkPasswordAndJoin:", { name, ip, isLocked, passwordHash });
    this.tempJoinName = name;
    this.tempJoinIp = ip;
    this.targetRoomPasswordHash = passwordHash || "";

    if (this.pendingRoomJoinCode) {
      this.activeRoomCode = this.pendingRoomJoinCode;
      this.pendingRoomJoinCode = "";
      this.pendingRoomJoinIp = "";
    }

    if (isLocked) {
      this.passwordVerifyModalOpen = true;
    } else {
      this.joinRoomDirectly();
    }
  }

  private onSubmitVerifyPassword(e: CustomEvent<{ password: string }>) {
    const entered = e.detail.password;

    // console.log("[LANLink debug] onSubmitVerifyPassword:", {
    //   entered,
    //   targetRoomPasswordHash: this.targetRoomPasswordHash,
    //   enteredHash,
    //   isMatched: verifyPassword(entered, this.targetRoomPasswordHash),
    // });

    // Verify password using target room's password hash
    if (verifyPassword(entered, this.targetRoomPasswordHash)) {
      this.passwordVerifyModalOpen = false;
      this.joinRoomDirectly();
      this.showToast(`[${this.tempJoinName}] 님의 공유방에 성공적으로 참여하였습니다.`);
    } else {
      this.showToast(`비밀번호가 일치하지 않습니다.`);
    }
  }

  private clearUrlParams() {
    window.history.replaceState({}, "", window.location.pathname);
  }

  private onCancelPasswordModal() {
    this.passwordVerifyModalOpen = false;
    this.currentScreen = "landing";
    this.clearUrlParams();
  }

  private async joinRoomDirectly() {
    // 내가 개설한 방인지 체크하여 방장 화면 복원
    const myCreatedRoomCode = localStorage.getItem("my_created_room_code");
    const targetRoomCode = this.pendingRoomJoinCode || this.activeRoomCode;

    if (myCreatedRoomCode && targetRoomCode === myCreatedRoomCode) {
      this.activeRoomCode = myCreatedRoomCode;
      this.hostSetupOpen = false;
      this.currentScreen = "host";
      this.viewerCount = 0;
      this.activeParticipants = [this.currentNickname];
      this.queryAgentStatus();

      // 화면 공유 스트림 다시 캡처
      this.screenStream = await captureScreen();
      if (this.screenStream) {
        await this.applyQualityPreset(this.screenQualityPreset);
      }

      // 시그널링 서버에 재등록
      this.sendSignalingMessage({
        type: "room-register",
        from: "host",
        to: "server",
        room: {
          name: `${this.currentNickname} 님의 방`,
          ip: this.serverDetectedIp || window.location.hostname,
          code: this.activeRoomCode,
          locked: this.isRoomLocked,
          passwordHash: this.hostPasswordHash,
          fps: 30,
        },
      });
      this.showToast("[방장] 화면 공유가 성공적으로 복원되었습니다.");
      return;
    }

    this.currentScreen = "viewer";
    this.activeRoomName = this.tempJoinName;
    this.activeRoomIp = this.tempJoinIp;
    this.viewerCount = 0;
    this.activeParticipants = [];

    // Reset Chat Messages
    this.chatMessages = [
      {
        sender: "System",
        content: "📢 안내: 채팅방 대화 내역은 저장되지 않고, 방 종료시 대화내용은 삭제됩니다.",
        system: true,
      },
    ];

    // Send Join Request to Host via signaling (방 코드를 패킷에 실어서 송신)
    setTimeout(() => {
      this.sendSignalingMessage({
        type: "join-request",
        from: this.viewerId,
        to: "host",
        roomCode: this.pendingRoomJoinCode || this.activeRoomCode,
        nickname: this.currentNickname,
      });
      this.pendingRoomJoinCode = "";
      this.pendingRoomJoinIp = "";
    }, 500);

    this.showToast(`⚡ ${this.activeRoomName} 님에게 연결 시도 중...`);
  }

  private leaveSession() {
    this.currentScreen = "landing";
    this.viewerCount = 0;
    this.activeParticipants = [];

    // Send leave signal
    this.sendSignalingMessage({
      type: "leave",
      from: this.viewerId,
      to: "host",
    });

    if (this.viewerConnection) {
      this.viewerConnection.close();
      this.viewerConnection = null;
    }
    if (this.viewerDataChannel) {
      this.viewerDataChannel.close();
      this.viewerDataChannel = null;
    }
    this.activeStream = null;

    this.cleanupMediaStreams();
    this.showToast("연결이 중단되었습니다.");
  }

  // --- Mic Mute Toggle ---
  private async toggleLocalMute() {
    this.localMuted = !this.localMuted;

    if (!this.localMuted) {
      const rawStream = await captureMicrophone();
      if (rawStream) {
        try {
          if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          this.disconnectMicAudioNodes();

          this.micSourceNode = this.audioCtx.createMediaStreamSource(rawStream);
          this.micGainNode = this.audioCtx.createGain();
          this.micGainNode.gain.setValueAtTime(this.micVolume / 100, this.audioCtx.currentTime);
          this.micDestNode = this.audioCtx.createMediaStreamDestination();

          this.micSourceNode.connect(this.micGainNode);
          this.micGainNode.connect(this.micDestNode);

          this.micStream = this.micDestNode.stream;
          (this as any).rawMicStream = rawStream;

          // Connect host mic source node to all active viewer mixers (for multi-party audio Relay)
          this.viewerAudioDestNodes.forEach((destNode) => {
            try {
              this.micGainNode?.connect(destNode);
            } catch (err) {
              console.warn("Failed to connect host mic to viewer mixer node:", err);
            }
          });
        } catch (audioErr) {
          console.error("Web Audio API processing for microphone failed:", audioErr);
          this.micStream = rawStream;
        }
      } else {
        this.localMuted = true;
        this.showToast("⚠️ 마이크 권한이 거부되었거나 수집할 장치가 없습니다.");
        return;
      }
    } else {
      if (this.micStream) {
        this.micStream = null;
      }
      if ((this as any).rawMicStream) {
        stopMediaStream((this as any).rawMicStream);
        (this as any).rawMicStream = null;
      }
      this.disconnectMicAudioNodes();
    }

    if (this.currentScreen === "viewer") {
      const audioTransceiver = this.viewerConnection
        ?.getTransceivers()
        .find((t) => t.receiver.track && t.receiver.track.kind === "audio");
      const sender = audioTransceiver?.sender;
      if (sender) {
        await sender.replaceTrack(this.micStream ? this.micStream.getAudioTracks()[0] : null);
      }
    } else if (this.currentScreen === "host") {
      const track = this.micStream ? this.micStream.getAudioTracks()[0] : null;
      for (const pc of this.hostConnections.values()) {
        const audioTransceiver = pc
          .getTransceivers()
          .find((t) => t.receiver.track && t.receiver.track.kind === "audio");
        const sender = audioTransceiver?.sender;
        if (sender) {
          await sender.replaceTrack(track);
        }
      }
    }

    setStreamAudioEnabled(this.micStream, !this.localMuted);
    this.showToast(this.localMuted ? "마이크가 음소거되었습니다." : "마이크가 켜졌습니다.");
  }

  // --- Video Quality Preset Control ---
  private async applyQualityPreset(presetKey: "FHD" | "HD" | "SD") {
    this.screenQualityPreset = presetKey;

    const presets = {
      FHD: { width: 1920, height: 1080, frameRate: 30, bitrate: 2500000 },
      HD: { width: 1280, height: 720, frameRate: 20, bitrate: 1500000 },
      SD: { width: 1280, height: 720, frameRate: 12, bitrate: 800000 },
    };

    const preset = presets[presetKey];

    // 1. Apply to local screen capture track
    if (this.screenStream) {
      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          await videoTrack.applyConstraints({
            width: { ideal: preset.width },
            height: { ideal: preset.height },
            frameRate: { max: preset.frameRate },
          });
        } catch (err) {
          console.warn("Failed to apply video constraints locally:", err);
        }
      }
    }

    // 2. Apply maxBitrate to all active peer connection video senders
    this.hostConnections.forEach(async (pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) {
        try {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = preset.bitrate;
          await sender.setParameters(params);
        } catch (err) {
          console.warn("Failed to update maxBitrate on video sender:", err);
        }
      }
    });

    this.showToast(
      `⚙️ 화질이 [${presetKey === "FHD" ? "초고화질" : presetKey === "HD" ? "고화질" : "일반화질"}]로 설정되었습니다.`
    );
  }

  private toggleQualityDropdown() {
    this.qualityDropdownOpen = !this.qualityDropdownOpen;
  }

  private handleMicVolumeInput(e: InputEvent) {
    const val = parseInt((e.target as HTMLInputElement).value);
    this.micVolume = val;
    if (this.micGainNode && this.audioCtx) {
      this.micGainNode.gain.setValueAtTime(val / 100, this.audioCtx.currentTime);
    }
  }

  private handleSpeakerVolumeChange(e: CustomEvent<{ volume: number }>) {
    this.speakerVolume = e.detail.volume;
  }

  private disconnectMicAudioNodes() {
    try {
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      }
      if (this.micGainNode) {
        this.micGainNode.disconnect();
        this.micGainNode = null;
      }
      if (this.micDestNode) {
        this.micDestNode.disconnect();
        this.micDestNode = null;
      }
    } catch (e) {
      console.warn("Error disconnecting audio nodes: ", e);
    }
  }

  // --- Speaker Mute Toggle ---
  private toggleSpeakerMute() {
    this.speakerMuted = !this.speakerMuted;
    document.querySelectorAll("audio[data-viewer-id]").forEach((el) => {
      (el as HTMLAudioElement).muted = this.speakerMuted;
    });
    document.querySelectorAll("#viewer-received-audio").forEach((el) => {
      (el as HTMLAudioElement).muted = this.speakerMuted;
    });
    this.showToast(this.speakerMuted ? "사운드 출력이 음소거되었습니다." : "사운드 출력이 켜졌습니다.");
  }

  // --- Real-time Local Chat ---
  private onSendMessage(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text;
    this.chatMessages = [...this.chatMessages, { sender: this.currentNickname, content: text }];

    const packet = { sender: this.currentNickname, content: text, timestamp: Date.now() };

    // If host, send to all viewers
    if (this.currentScreen === "host") {
      this.hostDataChannels.forEach((channel) => {
        if (channel.readyState === "open") {
          channel.send(JSON.stringify(packet));
        }
      });
    }
    // If viewer, send to host
    else if (this.currentScreen === "viewer") {
      if (this.viewerDataChannel && this.viewerDataChannel.readyState === "open") {
        this.viewerDataChannel.send(JSON.stringify(packet));
      }
    }

    setTimeout(() => {
      const chatBox = document.getElementById("chat-messages-box");
      if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }, 50);
  }

  // --- PiP (Picture-in-Picture) Chat window handler ---
  private async handleTogglePiP(e: CustomEvent) {
    const chatEl = e.target as HTMLElement;
    if (!chatEl) return;

    // 이미 PiP 창이 열려 있는 상태에서 누르면 닫는다 (토글 기능)
    if (this.pipWindow) {
      this.pipWindow.close();
      return;
    }
    if (this.pipFallbackWindow) {
      this.pipFallbackWindow.close();
      return;
    }

    this.originalChatParent = chatEl.parentElement;

    // 스타일시트 복사 함수
    const copyStyles = (targetDoc: Document) => {
      // style 태그 복사
      document.querySelectorAll("style").forEach((style) => {
        targetDoc.head.appendChild(style.cloneNode(true));
      });
      // link rel="stylesheet" 태그 복사
      document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        targetDoc.head.appendChild(link.cloneNode(true));
      });
    };

    // 원래 자리에 꽂아넣을 placeholder 생성
    const placeholder = document.createElement("div");
    placeholder.id = "chat-pip-placeholder";
    placeholder.className =
      "flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl p-6 text-center text-slate-400 dark:text-slate-500 h-80 w-full select-none transition-colors duration-200";
    placeholder.innerHTML = `
      <i data-lucide="external-link" class="mb-2 h-8 w-8 text-slate-400 dark:text-slate-600"></i>
      <span class="text-xs font-semibold">채팅창이 팝업으로 분리되었습니다.</span>
      <button class="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer">채팅창 원복하기</button>
    `;

    // placeholder 내 버튼 클릭 시 PiP 닫기
    placeholder.querySelector("button")?.addEventListener("click", () => {
      if (this.pipWindow) this.pipWindow.close();
      if (this.pipFallbackWindow) this.pipFallbackWindow.close();
    });

    const restoreChat = () => {
      if (placeholder.parentNode) {
        placeholder.parentNode.replaceChild(chatEl, placeholder);
      } else if (this.originalChatParent) {
        this.originalChatParent.appendChild(chatEl);
      }

      (chatEl as any).isPiP = false;
      chatEl.classList.remove("h-full", "w-full");
      chatEl.removeAttribute("style");

      // Lucide 아이콘 재생성
      createIcons({
        icons: globalIcons,
        root: chatEl,
      });

      // 스크롤 아래로
      const box = chatEl.querySelector("#chat-messages-box") as HTMLElement | null;
      if (box) {
        box.scrollTop = box.scrollHeight;
      }

      this.pipWindow = null;
      this.pipFallbackWindow = null;
    };

    // 원래 자리에 placeholder 이식
    if (this.originalChatParent) {
      this.originalChatParent.replaceChild(placeholder, chatEl);
      createIcons({
        icons: globalIcons,
        root: placeholder,
      });
    }

    // Document Picture-in-Picture API 시도
    if ((window as any).documentPictureInPicture) {
      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: 450,
          height: 600,
        });
        this.pipWindow = pipWin;

        const pipDoc = pipWin.document;
        copyStyles(pipDoc);

        pipDoc.documentElement.style.height = "100%";
        pipDoc.documentElement.style.width = "100%";
        pipDoc.body.style.margin = "0";
        pipDoc.body.style.height = "100%";
        pipDoc.body.style.width = "100%";
        pipDoc.body.style.overflow = "hidden";
        pipDoc.body.style.backgroundColor = document.body.classList.contains("dark") ? "#0f172a" : "#ffffff";
        if (document.body.classList.contains("dark")) {
          pipDoc.documentElement.classList.add("dark");
        }

        // ll-chat 엘리먼트 스타일 부여
        (chatEl as any).isPiP = true;
        chatEl.classList.add("h-full", "w-full");
        chatEl.style.height = "100%";
        chatEl.style.width = "100%";
        chatEl.style.maxWidth = "100%";
        chatEl.style.display = "flex";
        chatEl.style.flexDirection = "column";
        chatEl.style.minHeight = "0";
        chatEl.style.border = "none";
        chatEl.style.borderRadius = "0";

        pipDoc.body.appendChild(chatEl);

        createIcons({
          icons: globalIcons,
          root: chatEl,
        });

        // 자동 스크롤
        const box = chatEl.querySelector("#chat-messages-box") as HTMLElement | null;
        if (box) {
          setTimeout(() => {
            box.scrollTop = box.scrollHeight;
          }, 100);
        }

        pipWin.addEventListener("pagehide", () => {
          restoreChat();
        });
        return;
      } catch (err) {
        console.error("Document Picture-in-Picture failed, falling back to window.open", err);
      }
    }

    // Fallback: window.open 팝업 창
    try {
      const fallbackWin = window.open(
        "",
        "ChatPiP",
        "width=450,height=600,menubar=no,status=no,titlebar=no,toolbar=no,location=no"
      );
      if (fallbackWin) {
        this.pipFallbackWindow = fallbackWin;

        const pipDoc = fallbackWin.document;
        copyStyles(pipDoc);

        pipDoc.documentElement.style.height = "100%";
        pipDoc.documentElement.style.width = "100%";
        pipDoc.body.style.margin = "0";
        pipDoc.body.style.height = "100%";
        pipDoc.body.style.width = "100%";
        pipDoc.body.style.overflow = "hidden";
        pipDoc.body.style.backgroundColor = document.body.classList.contains("dark") ? "#0f172a" : "#ffffff";
        if (document.body.classList.contains("dark")) {
          pipDoc.documentElement.classList.add("dark");
        }

        // ll-chat 엘리먼트 스타일 부여
        (chatEl as any).isPiP = true;
        chatEl.classList.add("h-full", "w-full");
        chatEl.style.height = "100%";
        chatEl.style.width = "100%";
        chatEl.style.maxWidth = "100%";
        chatEl.style.display = "flex";
        chatEl.style.flexDirection = "column";
        chatEl.style.minHeight = "0";
        chatEl.style.border = "none";
        chatEl.style.borderRadius = "0";

        pipDoc.body.appendChild(chatEl);

        createIcons({
          icons: globalIcons,
          root: chatEl,
        });

        const box = chatEl.querySelector("#chat-messages-box") as HTMLElement | null;
        if (box) {
          setTimeout(() => {
            box.scrollTop = box.scrollHeight;
          }, 100);
        }

        fallbackWin.addEventListener("beforeunload", () => {
          restoreChat();
        });
      } else {
        this.showToast("⚡ 팝업이 차단되었습니다. 팝업 차단을 해제한 후 다시 시도해주세요.");
        if (placeholder.parentNode) {
          placeholder.parentNode.replaceChild(chatEl, placeholder);
        }
      }
    } catch (err) {
      console.error("window.open fallback failed", err);
      this.showToast("⚡ 팝업 모드를 열 수 없습니다.");
      if (placeholder.parentNode) {
        placeholder.parentNode.replaceChild(chatEl, placeholder);
      }
    }
  }

  // --- Idle Safeguard Timer ---
  simulateIdleTrigger() {
    this.idleSafeguardOpen = true;
    this.idleCountdown = 60;
    this.showToast("대역폭 절약 모드가 시작되었습니다. 1분간 반응 없을 시 자동 종료됩니다.");
    this.startIdleTimer();
  }

  private startIdleTimer() {
    this.stopIdleTimer();
    this.idleTimerInterval = window.setInterval(() => {
      this.idleCountdown--;
      if (this.idleCountdown <= 0) {
        this.stopIdleTimer();
        this.triggerImmediateStop();
      }
    }, 1000);
  }

  private stopIdleTimer() {
    if (this.idleTimerInterval) {
      clearInterval(this.idleTimerInterval);
    }
  }

  private cancelIdleSafeguard() {
    this.stopIdleTimer();
    this.idleSafeguardOpen = false;
    this.showToast("공유방이 유지되었습니다.");
  }

  private triggerImmediateStop() {
    this.stopIdleTimer();
    this.idleSafeguardOpen = false;
    this.stopSharing();
    this.showToast("🛑 미활동 감지로 인해 세션이 자동으로 안전 종료되었습니다.");
  }

  // --- Nickname Edit ---
  private openNicknameEdit() {
    this.nicknameModalOpen = true;
    this.tempNicknameInput = this.currentNickname;
  }

  private closeNicknameModal() {
    this.nicknameModalOpen = false;
  }

  private submitNickname() {
    const inputVal = this.inputGuestNicknameElement ? this.inputGuestNicknameElement.value.trim() : "";
    if (!inputVal) {
      this.showToast("⚠️ 대화명을 입력해주세요.");
      return;
    }
    this.currentNickname = inputVal;
    setNickname(inputVal);
    this.nicknameModalOpen = false;
    this.showToast(`👤 대화명이 [${inputVal}]로 변경되었습니다.`);
  }

  // --- Pro subscription ---
  private openProModal() {
    this.proModalOpen = true;
  }

  private closeProModal() {
    this.proModalOpen = false;
  }

  private upgradeSuccess() {
    this.proModalOpen = false;
    this.showToast("👑 LANLink PRO 버전 정식 라이센스가 구독 연동되었습니다. (체험 서비스)");
  }

  // --- Helper to clean up streams ---
  private cleanupMediaStreams() {
    stopMediaStream(this.screenStream);
    stopMediaStream(this.micStream);
    if ((this as any).rawMicStream) {
      stopMediaStream((this as any).rawMicStream);
      (this as any).rawMicStream = null;
    }
    this.disconnectMicAudioNodes();
    this.screenStream = null;
    this.micStream = null;

    // Disconnect and clear multi-party audio mixing nodes
    this.viewerAudioDestNodes.forEach((destNode) => {
      try {
        destNode.disconnect();
      } catch (e) {}
    });
    this.viewerAudioDestNodes.clear();

    this.hostViewerAudioSources.forEach((sourceNode) => {
      try {
        sourceNode.disconnect();
      } catch (e) {}
    });
    this.hostViewerAudioSources.clear();

    document.querySelectorAll("#viewer-received-audio").forEach((el) => el.remove());
    document.querySelectorAll("audio[data-viewer-id]").forEach((el) => el.remove());

    this.disconnectControlAgent();

    if (this.pipWindow) {
      this.pipWindow.close();
      this.pipWindow = null;
    }
    if (this.pipFallbackWindow) {
      this.pipFallbackWindow.close();
      this.pipFallbackWindow = null;
    }
  }

  private copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.showToast("📋 접속 고유 링크가 클립보드에 복사되었습니다!");
      })
      .catch(() => {
        this.showToast("❌ 복사에 실패했습니다.");
      });
  }

  private handleLogoClick() {
    if (this.currentScreen === "host") {
      this.stopSharing();
    } else if (this.currentScreen === "viewer") {
      this.leaveSession();
    } else {
      this.currentScreen = "landing";
    }
  }

  // --- Render Coordinator Templates ---
  render() {
    return html`
      <!-- Header Navigation -->
      <ll-header
        .currentNickname=${this.currentNickname}
        .currentTheme=${this.currentTheme}
        .isSignalingConnected=${this.isSignalingConnected}
        @edit-nickname=${this.openNicknameEdit}
        @change-theme=${this.onThemeChange}
        @open-pro=${this.openProModal}
        @logo-click=${this.handleLogoClick}
      >
      </ll-header>

      <!-- Main Layout -->
      <main class="mx-auto flex w-full max-w-5xl grow flex-col justify-center px-4 py-6 sm:px-6 md:py-12">
        <!-- Landing page panel -->
        ${this.currentScreen === "landing"
          ? html`
              <div
                id="landing-container"
                class="mx-auto flex w-full max-w-3xl flex-col items-center justify-center space-y-2"
              >
                <!-- Column: 내가 개설한 방 (Hero) -->
                <ll-hero
                  .hostSetupOpen=${this.hostSetupOpen}
                  .isRoomLocked=${this.isRoomLocked}
                  @toggle-drawer=${this.toggleHostSetupDrawer}
                  @toggle-lock=${this.onToggleLock}
                  @start-sharing=${this.onStartSharing}
                  @join-room=${this.onJoinRoom}
                  class="w-full"
                ></ll-hero>

                <!-- Restore Session Banner -->
                ${this.hasSavedHostSession
                  ? html`
                      <div class="animate-in fade-in slide-in-from-top-4 mb-5 w-full duration-304">
                        <div
                          class="relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-blue-500/20 bg-linear-to-r from-blue-50/80 to-indigo-50/80 p-6 backdrop-blur-md dark:border-blue-500/30 dark:from-blue-950/40 dark:to-indigo-950/40"
                        >
                          <!-- Decorative background glow -->
                          <div
                            class="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-400/20 blur-2xl dark:bg-blue-500/10"
                          ></div>

                          <div class="flex flex-col gap-4 sm:items-start sm:justify-between">
                            <div class="flex items-center gap-4">
                              <div
                                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                              >
                                <i data-lucide="refresh-cw" class="h-6 w-6"></i>
                              </div>
                              <div class="text-left">
                                <h4 class="font-bold text-slate-900 dark:text-white">이전 화면 공유 방 복원</h4>
                                <p class="text-sm text-slate-500 dark:text-slate-400">
                                  이전 생성했던 방(코드:
                                  <span class="font-mono font-bold text-blue-600 dark:text-blue-400"
                                    >${this.savedHostRoomCode}</span
                                  >)이 감지되었습니다.
                                </p>
                              </div>
                            </div>

                            <div class="flex shrink-0 gap-2 self-end">
                              <button
                                @click=${this.clearSavedHostSession}
                                class="rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              >
                                삭제
                              </button>
                              <button
                                @click=${this.restoreHostSession}
                                class="flex items-center gap-2 rounded-xl bg-blue-600 py-2.5 pr-5 pl-4 text-xs font-bold whitespace-nowrap text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
                              >
                                <i data-lucide="play" class="h-4 w-4 shrink-0"></i>
                                다시 연결하기
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    `
                  : ""}

                <!-- Column: 대기방 감지 -->
                <ll-mdns-list
                  .rooms=${this.scannedRooms}
                  @select-room=${this.onSelectRoom}
                  class="w-full"
                ></ll-mdns-list>

                <!-- Column: 하단 메인 슬라이드 캐러셀 -->
                <ll-carousel
                  .carouselIndex=${this.carouselIndex}
                  @switch-carousel=${this.onSwitchCarousel}
                  class="w-full"
                ></ll-carousel>
              </div>
            `
          : ""}

        <!-- Active Host Sharing Workspace -->
        ${this.currentScreen === "host"
          ? html`
              <div id="sharing-active-workspace" class="mx-auto w-full max-w-7xl">
                <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <!-- Left: Host Info, QR Code, Link & Action buttons (5/12) -->
                  <div
                    class="custom-shadow animate-in zoom-in-95 order-3 flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 md:order-2 md:col-span-1 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div class="space-y-6">
                      <!-- Title & Participant count -->
                      <div
                        class="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800"
                      >
                        <div class="flex items-start gap-3">
                          <span class="relative top-1.5 flex h-3 w-3">
                            <span
                              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
                            ></span>
                            <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                          </span>
                          <div>
                            <h4 class="text-md font-bold text-slate-900 dark:text-white">화면공유 중</h4>
                            <p class="text-xs text-slate-500">P2P 스트리밍이 가동되고 있습니다.</p>
                          </div>
                        </div>
                      </div>

                      <div class="flex flex-col gap-2">
                        <!-- QR Code -->
                        <div
                          class="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center sm:col-span-5 dark:border-slate-800 dark:bg-slate-950"
                        >
                          <div
                            class="mb-1 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800"
                          >
                            <img
                              src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                this.getShareUrl()
                              )}"
                              class="h-36 w-36 rounded-lg"
                              alt="Share QR Code"
                            />
                          </div>
                          <span class="text-[10px] text-slate-400">간편 QR 코드</span>
                          <div class="text-google-blue text-2xl font-bold tracking-wider">${this.activeRoomCode}</div>
                        </div>

                        <!-- Link & Info -->
                        <div class="flex flex-col justify-between gap-3 sm:col-span-7">
                          <div class="space-y-1">
                            <span class="ml-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase"
                              >접속 공유 링크</span
                            >
                            <div class="flex items-center gap-2">
                              <div
                                class="grow rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] break-all text-slate-600 select-all dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                              >
                                ${this.getShareUrl()}
                              </div>
                              <button
                                @click=${() => this.copyToClipboard(this.getShareUrl())}
                                class="hover:border-google-blue rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-500 transition dark:border-slate-700 dark:bg-slate-800"
                                title="링크 복사"
                              >
                                <i data-lucide="copy" class="h-4 w-4"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- <div class="bg-google-blue/5 border-google-blue/10 space-y-1 rounded-xl border p-3.5 text-[11px] text-slate-500">
                        <p class="text-google-blue flex items-center gap-1 font-bold">
                          <i data-lucide="lock" class="h-3.5 w-3.5"></i>
                          보안 기밀 보호 작동 중
                        </p>
                        <p class="leading-relaxed">
                          설정된 비밀번호가 안전하게 설정되었습니다.
                        </p>
                      </div> -->
                    </div>
                  </div>

                  <!-- Right: Host Screen Video Preview (7/12) -->
                  <div
                    class="custom-shadow animate-in zoom-in-95 order-1 flex flex-col rounded-3xl border border-slate-200 bg-white p-6 md:col-span-2 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div
                      class="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800"
                    >
                      <h4 class="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        <i data-lucide="monitor" class="text-google-blue h-4.5 w-4.5"></i>
                        현재 공유된 화면
                      </h4>
                      <span class="bg-google-blue/10 text-google-blue rounded px-2 py-0.5 text-[10px] font-semibold"
                        >실시간 공유 중</span
                      >
                    </div>

                    <div
                      class="group relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800"
                    >
                      ${this.screenStream
                        ? html`
                            <video class="h-full w-full object-contain" autoplay muted playsinline></video>

                            <!-- Host Floating Control Overlay Bar -->
                            <div
                              class="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 translate-y-0 items-center gap-2.5 rounded-2xl border border-slate-700/50 bg-slate-900/85 p-2 shadow-lg backdrop-blur transition-all duration-300 md:pointer-events-none md:translate-y-20 md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100"
                            >
                              <!-- Mic Toggle and sliding volume slider -->
                              <div
                                class="group/vol flex items-center rounded-xl border border-slate-700/50 bg-slate-800/40 transition-all duration-300 hover:bg-slate-800/80"
                              >
                                <button
                                  @click=${this.toggleLocalMute}
                                  class="${this.localMuted
                                    ? "text-rose-400"
                                    : "text-emerald-400"} flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-800/60"
                                  title="${this.localMuted ? "마이크 켜기" : "마이크 끄기"}"
                                >
                                  ${this.localMuted
                                    ? html`<i data-lucide="mic-off" class="h-4.5 w-4.5"></i>`
                                    : html`<i data-lucide="mic" class="h-4.5 w-4.5"></i>`}
                                </button>
                                <div
                                  class="flex w-0 items-center gap-1.5 overflow-hidden opacity-0 transition-all duration-300 group-hover/vol:w-24 group-hover/vol:pr-2.5 group-hover/vol:opacity-100"
                                >
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    .value=${this.micVolume}
                                    @input=${this.handleMicVolumeInput}
                                    ?disabled=${this.localMuted}
                                    class="accent-google-blue h-1 w-14 cursor-pointer appearance-none rounded-lg bg-slate-700 focus:outline-none disabled:opacity-50"
                                    title="마이크 음량 조절"
                                  />
                                  <span class="w-5 text-right font-mono text-[9px] text-slate-400"
                                    >${this.micVolume}%</span
                                  >
                                </div>
                              </div>

                              <!-- Speaker Toggle and sliding volume slider -->
                              <div
                                class="group/vol flex items-center rounded-xl border border-slate-700/50 bg-slate-800/40 transition-all duration-300 hover:bg-slate-800/80"
                              >
                                <button
                                  @click=${this.toggleSpeakerMute}
                                  class="${this.speakerMuted
                                    ? "text-rose-400"
                                    : "text-emerald-400"} flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-800/60"
                                  title="${this.speakerMuted ? "사운드 켜기" : "사운드 끄기"}"
                                >
                                  ${this.speakerMuted
                                    ? html`<i data-lucide="volume-x" class="h-4.5 w-4.5"></i>`
                                    : html`<i data-lucide="volume-2" class="h-4.5 w-4.5"></i>`}
                                </button>
                                <div
                                  class="flex w-0 items-center gap-1.5 overflow-hidden opacity-0 transition-all duration-300 group-hover/vol:w-24 group-hover/vol:pr-2.5 group-hover/vol:opacity-100"
                                >
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    .value=${this.speakerVolume}
                                    @input=${(e: InputEvent) => {
                                      this.speakerVolume = parseInt((e.target as HTMLInputElement).value);
                                      document.querySelectorAll("audio[data-viewer-id]").forEach((el) => {
                                        (el as HTMLAudioElement).volume = this.speakerMuted
                                          ? 0
                                          : this.speakerVolume / 100;
                                      });
                                    }}
                                    ?disabled=${this.speakerMuted}
                                    class="accent-google-blue h-1 w-14 cursor-pointer appearance-none rounded-lg bg-slate-700 focus:outline-none disabled:opacity-50"
                                    title="스피커 음량 조절"
                                  />
                                  <span class="w-5 text-right font-mono text-[9px] text-slate-400"
                                    >${this.speakerVolume}%</span
                                  >
                                </div>
                              </div>

                              <!-- Divider -->
                              <div class="mx-0.5 h-5 w-px bg-slate-700/50"></div>

                              <!-- Settings Toggle (Quality dropdown) -->
                              <div class="relative flex items-center">
                                <button
                                  @click=${this.toggleQualityDropdown}
                                  class="${this.qualityDropdownOpen
                                    ? "text-emerald-400 bg-slate-800/40"
                                    : "text-slate-300"} flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/80 transition-colors hover:bg-slate-700"
                                  title="화질"
                                >
                                  <i data-lucide="settings" class="h-4.5 w-4.5"></i>
                                </button>

                                <!-- Quality Dropdown menu -->
                                ${this.qualityDropdownOpen
                                  ? html`
                                      <div
                                        class="animate-in fade-in slide-in-from-bottom-2 absolute bottom-12 left-1/2 z-30 w-44 -translate-x-1/2 rounded-xl border border-slate-700/70 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md duration-150"
                                      >
                                        <div
                                          class="px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
                                        >
                                          화질 선택
                                        </div>
                                        <button
                                          @click=${() => {
                                            this.applyQualityPreset("FHD");
                                            this.qualityDropdownOpen = false;
                                          }}
                                          class="${this.screenQualityPreset === "FHD"
                                            ? "text-emerald-400"
                                            : "text-slate-300"} flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition hover:bg-slate-800"
                                        >
                                          <span>초고화질 (FHD)</span>
                                          ${this.screenQualityPreset === "FHD"
                                            ? html`<i data-lucide="check" class="h-3.5 w-3.5"></i>`
                                            : ""}
                                        </button>
                                        <button
                                          @click=${() => {
                                            this.applyQualityPreset("HD");
                                            this.qualityDropdownOpen = false;
                                          }}
                                          class="${this.screenQualityPreset === "HD"
                                            ? "text-emerald-400"
                                            : "text-slate-300"} flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition hover:bg-slate-800"
                                        >
                                          <span>고화질 (HD)</span>
                                          ${this.screenQualityPreset === "HD"
                                            ? html`<i data-lucide="check" class="h-3.5 w-3.5"></i>`
                                            : ""}
                                        </button>
                                        <button
                                          @click=${() => {
                                            this.applyQualityPreset("SD");
                                            this.qualityDropdownOpen = false;
                                          }}
                                          class="${this.screenQualityPreset === "SD"
                                            ? "text-emerald-400"
                                            : "text-slate-300"} flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition hover:bg-slate-800"
                                        >
                                          <span>일반화질 (최적화)</span>
                                          ${this.screenQualityPreset === "SD"
                                            ? html`<i data-lucide="check" class="h-3.5 w-3.5"></i>`
                                            : ""}
                                        </button>
                                        <!-- Divider inside dropdown -->
                                        <div class="my-1 border-t border-slate-700/50"></div>
                                        <button
                                          @click=${() => {
                                            if (this.isAgentConnected) {
                                              this.remoteControlAllowed = !this.remoteControlAllowed;
                                              this.showToast(
                                                this.remoteControlAllowed
                                                  ? "🔒 원격 제어가 승인되었습니다."
                                                  : "🔒 원격 제어가 차단되었습니다."
                                              );
                                            }
                                          }}
                                          ?disabled=${!this.isAgentConnected}
                                          class="${this.remoteControlAllowed
                                            ? "text-emerald-400"
                                            : "text-slate-300"} flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
                                        >
                                          <span>원격 제어 허용</span>
                                          <div class="relative inline-flex items-center">
                                            <div
                                              class="${this.remoteControlAllowed
                                                ? "bg-emerald-500"
                                                : "bg-slate-700"} h-4 w-7 rounded-full transition-colors"
                                            ></div>
                                            <div
                                              class="${this.remoteControlAllowed
                                                ? "translate-x-3"
                                                : "translate-x-0"} absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform"
                                            ></div>
                                          </div>
                                        </button>
                                        <div class="mt-1 px-2 pb-1.5 text-left text-[10px]">
                                          ${this.isAgentConnected
                                            ? html`
                                                <div class="flex flex-col gap-0.5">
                                                  <span class="font-medium text-emerald-400">⚡원격 도우미 실행 중</span>
                                                  ${this.approvedViewerNickname
                                                    ? html`<span class="text-blue-400 font-semibold">👤 제어 중: ${this.approvedViewerNickname}</span>`
                                                    : html`<span class="text-slate-400">👤 제어 참여자 없음</span>`}
                                                </div>
                                              `
                                            : html`
                                                <span class="leading-normal text-slate-400">
                                                  원격 도우미 미연결
                                                  <a
                                                    href="./LANLink_Remote_Helper.zip"
                                                    download="LANLink_Remote_Helper.zip"
                                                    class="ml-1 font-bold text-rose-400 underline hover:text-rose-300"
                                                  >
                                                    [설치하기]
                                                  </a>
                                                </span>
                                              `}
                                        </div>
                                      </div>
                                    `
                                  : ""}
                              </div>

                              <!-- Change Shared Screen -->
                              <button
                                @click=${this.changeSharedScreen}
                                class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700"
                                title="공유 화면 변경"
                              >
                                <i data-lucide="screen-share" class="h-4.5 w-4.5"></i>
                              </button>

                              <!-- Stop Sharing -->
                              <button
                                @click=${this.stopSharing}
                                class="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 transition-colors hover:bg-rose-500/30"
                                title="공유 종료하기"
                              >
                                <i data-lucide="square" class="h-4 w-4 fill-rose-400"></i>
                              </button>
                            </div>
                          `
                        : html`
                            <div class="flex h-full w-full flex-col items-center justify-center text-slate-400">
                              <i data-lucide="monitor-off" class="mb-2 h-10 w-10"></i>
                              <span class="text-xs">공유 화면이 없습니다.</span>
                            </div>
                          `}
                    </div>
                  </div>

                  <!-- Bottom Section: Chat Room taking full width -->
                  <div class="order-2 md:order-3 md:col-span-1">
                    <ll-chat
                      id="host-chat-element"
                      .chatMessages=${this.chatMessages}
                      .viewerCount=${this.viewerCount}
                      .participants=${this.activeParticipants}
                      .myNickname=${this.currentNickname}
                      .showPiPButton=${true}
                      @send-message=${this.onSendMessage}
                      @toggle-pip=${this.handleTogglePiP}
                      class="animate-in zoom-in-95 block h-full w-full"
                    ></ll-chat>
                  </div>
                </div>
              </div>
            `
          : ""}

        <!-- Active Guest Viewer Workspace -->
        ${this.currentScreen === "viewer"
          ? html`
              <ll-viewer
                .activeRoomName=${this.activeRoomName}
                .activeRoomIp=${this.activeRoomIp}
                .localMuted=${this.localMuted}
                .speakerMuted=${this.speakerMuted}
                .speakerVolume=${this.speakerVolume}
                .micVolume=${this.micVolume}
                .chatMessages=${this.chatMessages}
                .viewerCount=${this.viewerCount}
                .participants=${this.activeParticipants}
                .stream=${this.activeStream}
                .myNickname=${this.currentNickname}
                .remoteControlRequestStatus=${this.remoteControlRequestStatus}
                @toggle-mute=${this.toggleLocalMute}
                @toggle-speaker=${this.toggleSpeakerMute}
                @change-speaker-volume=${this.handleSpeakerVolumeChange}
                @change-mic-volume=${(e: CustomEvent<{ volume: number }>) => {
                  this.micVolume = e.detail.volume;
                  if (this.micGainNode && this.audioCtx) {
                    this.micGainNode.gain.setValueAtTime(this.micVolume / 100, this.audioCtx.currentTime);
                  }
                }}
                @leave-session=${this.leaveSession}
                @send-message=${this.onSendMessage}
                @show-toast=${(e: CustomEvent<{ message: string }>) => this.showToast(e.detail.message)}
                @request-remote-control=${this.sendRemoteControlRequest}
                @control-action=${(e: CustomEvent<{ action: any }>) => {
                  if (this.viewerDataChannel && this.viewerDataChannel.readyState === "open") {
                    this.viewerDataChannel.send(
                      JSON.stringify({
                        type: "control-action",
                        action: e.detail.action,
                        sender: this.viewerId,
                      })
                    );
                  }
                }}
              >
                <ll-voice .localMuted=${this.localMuted}></ll-voice>
              </ll-viewer>
            `
          : ""}
      </main>

      <footer
        class="mt-12 border-t border-slate-200 bg-white py-6 transition-colors dark:border-slate-900 dark:bg-slate-950"
      >
        <div
          class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-slate-400 md:flex-row dark:text-slate-500"
        >
          <div>© 2026 LANLink Inc. 사내 로컬 연결 제어 인프라스트럭처</div>
          <div class="flex gap-4">
            <a href="#" class="transition hover:text-slate-600">서비스 가이드</a>
            <a href="#" class="transition hover:text-slate-600">보안 감사 및 Compliance</a>
            <a href="#" class="transition hover:text-slate-600">사내망 구축 문의</a>
          </div>
        </div>
      </footer>

      <!-- Modals and Overlays -->
      ${this.renderNicknameModal()}

      <modal-password
        .open=${this.passwordVerifyModalOpen}
        @close-modal=${this.onCancelPasswordModal}
        @submit-verify-password=${this.onSubmitVerifyPassword}
      ></modal-password>

      <modal-saver
        .open=${this.idleSafeguardOpen}
        .countdown=${this.idleCountdown}
        @keep-session=${this.cancelIdleSafeguard}
        @stop-session=${this.triggerImmediateStop}
      ></modal-saver>

      ${this.renderProModal()} ${this.renderToast()} ${this.renderAlertModal()} ${this.renderControlRequestModal()}
    `;
  }

  private renderNicknameModal() {
    return html`
      <div
        id="nickname-modal"
        class="${this.nicknameModalOpen
          ? ""
          : "hidden"} fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      >
        <div
          class="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div
            class="bg-google-blue/10 border-google-blue/20 text-google-blue mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border"
          >
            <i data-lucide="user-plus" class="h-6 w-6"></i>
          </div>
          <h3 class="text-md text-center font-bold text-slate-800 dark:text-white">공유 대화명 설정</h3>
          <p class="mt-1 text-center text-xs leading-relaxed text-slate-500">
            LANLink는 일회성 닉네임을 사용합니다.<br />대화명을 입력해 주세요.
          </p>

          <div class="my-4">
            <input
              type="text"
              id="input-guest-nickname"
              .value=${this.tempNicknameInput}
              placeholder="예: 김 대리 (개발팀)"
              class="dark:bg-slate-955 focus:border-google-blue w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-800 focus:outline-none dark:border-slate-800 dark:text-white"
            />
          </div>

          <div class="flex gap-2">
            <button
              @click=${this.closeNicknameModal}
              class="grow rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              취소
            </button>
            <button
              @click=${this.submitNickname}
              class="bg-google-blue hover:bg-google-blueHover grow rounded-xl py-2.5 text-xs font-bold text-white transition"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderProModal() {
    return html`
      <div
        id="pro-modal"
        class="${this.proModalOpen
          ? ""
          : "hidden"} fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm dark:bg-slate-950/80"
      >
        <div
          class="relative w-full max-w-md rounded-2xl border-2 border-amber-500/30 bg-white p-6 text-center shadow-2xl dark:bg-slate-900"
        >
          <button
            @click=${this.closeProModal}
            class="absolute top-4 right-4 text-slate-400 transition hover:text-slate-600"
          >
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
          <div
            class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-500"
          >
            <i data-lucide="crown" class="h-8 w-8 animate-bounce fill-amber-500"></i>
          </div>
          <h3 class="text-xl font-extrabold text-slate-900 dark:text-white">LANLink Pro 업그레이드</h3>
          <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            '실시간 고화질 화면 및 음성 동시 녹화', '비밀번호 세션 잠금', '초저지연 보이스 토크' 기능은 정식 런칭 시 Pro
            패키지로 분류됩니다.
          </p>
          <div
            class="my-6 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-950"
          >
            <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <i data-lucide="check" class="h-4 w-4 text-amber-500"></i> 오디오와 미디어가 자동 정렬되는 60FPS 회의 녹화
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <i data-lucide="check" class="h-4 w-4 text-amber-500"></i> 사내 전원 비밀번호 잠금 설정 및 비공개 세션
              개설
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <i data-lucide="check" class="h-4 w-4 text-amber-500"></i> 다이렉트 보이스 채널링 개설 (WebRTC VoIP)
            </div>
          </div>
          <div class="flex gap-3">
            <button
              @click=${this.closeProModal}
              class="grow rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition dark:bg-slate-800 dark:text-slate-300"
            >
              다음에 하기
            </button>
            <button
              @click=${this.upgradeSuccess}
              class="bg-linear-gradient-to-r grow rounded-xl from-amber-500 to-orange-500 py-3 text-sm font-black text-slate-950 transition hover:from-amber-600 hover:to-orange-600"
            >
              업그레이드 (구독)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderToast() {
    return html`
      <div
        id="toast"
        class="${this.toastVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"} fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-xl border border-blue-500 bg-white px-5 py-3 text-sm text-slate-800 shadow-xl transition-all duration-300 dark:bg-slate-900 dark:text-white"
      >
        <i data-lucide="info" class="text-google-blue h-4 w-4"></i>
        <span id="toast-message">${this.toastMessage}</span>
      </div>
    `;
  }

  private renderAlertModal() {
    return html`
      <div
        id="alert-modal"
        class="${this.alertModalOpen
          ? ""
          : "hidden"} fixed inset-0 z-100 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      >
        <div
          class="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 class="text-center text-2xl font-bold text-slate-800 dark:text-white">알림</h3>
          <p class="mt-2 text-center text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
            ${this.alertModalMessage}
          </p>

          <div class="mt-5 flex justify-center">
            <button
              @click=${this.closeAlertModal}
              class="bg-google-blue hover:bg-google-blueHover w-full rounded-xl py-2.5 text-xs font-bold text-white transition"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderControlRequestModal() {
    return html`
      <div
        id="control-request-modal"
        class="${this.controlRequestModalOpen ? "" : "hidden"} fixed inset-0 z-100 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      >
        <div
          class="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 class="text-center text-xl font-bold text-slate-800 dark:text-white">🖥️ 원격 제어 요청</h3>
          <p class="mt-3 text-center text-sm leading-relaxed font-semibold text-slate-700 dark:text-slate-300">
            <span class="text-blue-500 font-bold">${this.incomingControlRequest?.nickname || "참여자"}</span> 님이 화면 원격 제어를 요청하셨습니다.
          </p>
          <p class="mt-1 text-center text-xs text-slate-400 dark:text-slate-500">
            수락하면 해당 참여자가 내 화면을 마우스/키보드로 직접 조작할 수 있습니다.
          </p>

          <div class="mt-6 flex gap-3">
            <button
              @click=${this.handleRejectControlRequest}
              class="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl py-2.5 text-xs font-bold transition"
            >
              거절
            </button>
            <button
              @click=${this.handleAcceptControlRequest}
              class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2.5 text-xs font-bold transition"
            >
              수락
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private handleAcceptControlRequest() {
    if (!this.incomingControlRequest) return;
    const { from, nickname } = this.incomingControlRequest;
    this.approvedViewerId = from;
    this.approvedViewerNickname = nickname;
    this.controlRequestModalOpen = false;

    // Send remote-control-response to matching peer and disable others
    this.hostDataChannels.forEach((channel, peerId) => {
      if (peerId === from && channel.readyState === "open") {
        channel.send(JSON.stringify({
          type: "remote-control-response",
          approved: true
        }));
      } else if (peerId !== from && channel.readyState === "open") {
        channel.send(JSON.stringify({
          type: "remote-control-response",
          approved: false
        }));
      }
    });

    this.showToast(`🟢 [${nickname}] 님에게 원격 제어 권한을 부여했습니다.`);
    this.incomingControlRequest = null;
  }

  private handleRejectControlRequest() {
    if (!this.incomingControlRequest) return;
    const { from, nickname } = this.incomingControlRequest;
    this.controlRequestModalOpen = false;

    this.hostDataChannels.forEach((channel, peerId) => {
      if (peerId === from && channel.readyState === "open") {
        channel.send(JSON.stringify({
          type: "remote-control-response",
          approved: false
        }));
      }
    });

    this.showToast(`🔴 [${nickname}] 님의 원격 제어 요청을 거절했습니다.`);
    this.incomingControlRequest = null;
  }

  private sendRemoteControlRequest() {
    if (this.currentScreen !== "viewer" || !this.viewerDataChannel || this.viewerDataChannel.readyState !== "open") {
      this.showToast("⚠️ 아직 방에 연결되지 않았거나 제어 채널이 닫혀 있습니다.");
      return;
    }
    this.remoteControlRequestStatus = 'pending';
    this.viewerDataChannel.send(JSON.stringify({
      type: "remote-control-request",
      from: this.viewerId,
      nickname: this.currentNickname
    }));
    this.showToast("⏳ 호스트에게 원격 제어 수락을 요청했습니다. 대기하는 중...");
  }

  private queryAgentStatus() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendSignalingMessage({
        type: "agent-check"
      });
    }
    this.connectLocalDirect();
  }

  private connectLocalDirect() {
    if (this.localDirectWs) return;
    try {
      const ws = new WebSocket("ws://127.0.0.1:5000");
      ws.onopen = () => {
        this.localDirectWs = ws;
        console.log("⚡ [LANLink] Ultra-low latency local direct control channel established.");
        this.syncSharedBoundsToAgent();
      };
      const handleClose = () => {
        if (this.localDirectWs === ws) {
          this.localDirectWs = null;
        }
      };
      ws.onclose = handleClose;
      ws.onerror = handleClose;
    } catch (e) {
      this.localDirectWs = null;
    }
  }

  private disconnectLocalDirect() {
    if (this.localDirectWs) {
      try {
        this.localDirectWs.close();
      } catch (e) {}
      this.localDirectWs = null;
    }
  }

  private disconnectControlAgent() {
    this.isAgentConnected = false;
    this.remoteControlAllowed = false;
    this.disconnectLocalDirect();
  }

  private syncSharedBoundsToAgent() {
    if (!this.screenStream) return;
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const settings = videoTrack.getSettings();
    const width = settings.width || 1920;
    const height = settings.height || 1080;
    
    console.log(`[LANLink] Sending shared bounds to agent: ${width}x${height}`);
    
    const boundsMsg = {
      type: "set-shared-bounds",
      width: width,
      height: height
    };
    
    if (this.localDirectWs && this.localDirectWs.readyState === WebSocket.OPEN) {
      this.localDirectWs.send(JSON.stringify(boundsMsg));
    } else if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendSignalingMessage({
        type: "agent-control",
        control: boundsMsg
      });
    }
  }
}

function setVideoMaxBitrate(sdp: string, bitrateKbps: number): string {
  if (!sdp.includes("a=mid:video")) return sdp;
  return sdp.replace(/a=mid:video\r\n/g, `a=mid:video\r\nb=AS:${bitrateKbps}\r\n`);
}
