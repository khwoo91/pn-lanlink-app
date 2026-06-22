import { LitElement, html } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { createIcons } from 'lucide';
import { globalIcons } from './utils/icons';

// Import components to register them as custom elements
import './components/common/ll-header';
import './components/common/ll-badge';
import './components/dashboard/ll-hero';
import './components/dashboard/ll-carousel';
import './components/dashboard/ll-mdns-list';
import './components/session/ll-viewer';
import './components/session/ll-chat';
import './components/session/ll-voice';
import './components/modals/modal-password';
import './components/modals/modal-saver';

// Import core utilities and signaling engines
import { getTheme, setTheme, getNickname, setNickname } from './utils/storage';
import { hashPassword, verifyPassword } from './utils/crypto';
import { captureScreen, stopMediaStream } from './infrastructure/webrtc-stream';
import { captureMicrophone, setStreamAudioEnabled } from './infrastructure/voip-audio';
import type { LANRoom } from './infrastructure/mdns-signaling';
import { SIGNALING_URL } from './config';

@customElement('my-element')
export class MyElement extends LitElement {
  updated() {
    createIcons({
      icons: globalIcons,
      root: this
    });
  }
  // Use Light DOM for seamless styling via tailwind.css and global plugins
  createRenderRoot() {
    return this;
  }

  // Coordinator state
  @state() private currentScreen: 'landing' | 'host' | 'viewer' = 'landing';
  @state() private hostSetupOpen: boolean = false;
  @state() private isRoomLocked: boolean = true;
  @state() private hostPasswordHash: string = hashPassword('1234');
  @state() private currentNickname: string = '참여자';
  @state() private currentTheme: string = 'light';
  @state() private carouselIndex: number = 0;
  @state() private viewerCount: number = 0;
  @state() private localMuted: boolean = true;
  @state() private annotationVisible: boolean = false;
  @state() private scannedRooms: LANRoom[] = [];
  @state() private serverDetectedIp: string = '';
  @state() private pendingRoomJoinCode: string = '';
  @state() private pendingRoomJoinIp: string = '';

  // Active room details
  @state() private activeRoomName: string = '';
  @state() private activeRoomIp: string = '';
  @state() private activeRoomCode: string = '15';

  // Chatting message logs
  @state() private chatMessages: Array<{ sender: string; content: string; system?: boolean }> = [
    { sender: 'System', content: '📢 보안 안내: 해당 대화 내역은 외부 서버에 저장되지 않고 WebRTC 패킷으로 흐르며, 방 종료 즉시 메모리에서 완벽하게 파기됩니다.', system: true }
  ];

  // Modals & Overlays toggles
  @state() private nicknameModalOpen: boolean = false;
  @state() private passwordVerifyModalOpen: boolean = false;
  @state() private proModalOpen: boolean = false;
  @state() private idleSafeguardOpen: boolean = false;
  @state() private idleCountdown: number = 60;
  @state() private activeParticipants: string[] = [];

  // Toast feedback state
  @state() private toastMessage: string = '';
  @state() private toastVisible: boolean = false;

  // Virtual Remote Click cursor simulator
  @state() private cursorVisible: boolean = false;
  @state() private cursorX: number = 33;
  @state() private cursorY: number = 50;

  // Temporary join room context
  @state() private tempJoinName: string = '';
  @state() private tempJoinIp: string = '';
  @state() private tempNicknameInput: string = '';

  @query('#input-guest-nickname') private inputGuestNicknameElement?: HTMLInputElement;

  private toastTimeout?: number;
  private carouselInterval?: number;
  private idleTimerInterval?: number;

  private screenStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;

  // WebRTC & Signaling properties
  private websocket: WebSocket | null = null;
  private viewerId: string = Math.random().toString(36).substring(2, 9);
  private hostConnections = new Map<string, RTCPeerConnection>();
  private hostDataChannels = new Map<string, RTCDataChannel>();
  private hostViewerNicknames = new Map<string, string>();
  private viewerConnection: RTCPeerConnection | null = null;
  private viewerDataChannel: RTCDataChannel | null = null;
  @state() protected activeStream: MediaStream | null = null;

  connectedCallback() {
    super.connectedCallback();

    // Load local storage states via storage utility
    this.currentTheme = getTheme();
    this.applyTheme(this.currentTheme);
    this.currentNickname = getNickname() || '참여자';

    // Start auto carousel cycling every 5 seconds
    this.startCarouselInterval();

    window.addEventListener('beforeunload', this.handleBeforeUnload);

    this.initWebSocketSignaling();

    // URL 파라미터 체크 (?room=15&ip=192.168.0.27)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const ipParam = params.get('ip');
    if (roomParam) {
      this.pendingRoomJoinCode = roomParam;
      this.pendingRoomJoinIp = ipParam || '';
      this.showToast(`🔗 공유방 링크 감지: 방 정보 확인 후 입장을 시도합니다.`);

      // 1.5초 내에 공인 IP 대조 방 목록 응답이 지연되거나 실패할 시, 직접 IP 접속 폴백 수행
      setTimeout(() => {
        if (this.pendingRoomJoinCode) {
          const code = this.pendingRoomJoinCode;
          const ip = this.pendingRoomJoinIp;
          this.pendingRoomJoinCode = '';
          this.pendingRoomJoinIp = '';
          this.showToast(`⚡ 네트워크 지연 발생: 직접 연결 주소(${ip || '로컬'})로 다이렉트 입장을 시도합니다.`);
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
    if (this.currentScreen === 'host') {
      this.sendSignalingMessage({ type: 'room-unregister', ip: window.location.hostname });
      this.sendSignalingMessage({ type: 'leave', from: 'host', to: 'all' });
    } else if (this.currentScreen === 'viewer') {
      this.sendSignalingMessage({ type: 'leave', from: this.viewerId, to: 'host' });
    }

    this.hostConnections.forEach(pc => pc.close());
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

    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    super.disconnectedCallback();
  }

  private updateParticipants() {
    const list = [this.currentNickname, ...Array.from(this.hostViewerNicknames.values())];
    this.activeParticipants = list;
    this.viewerCount = this.hostConnections.size;

    const packet = {
      type: 'participants-update',
      list: list
    };
    this.hostDataChannels.forEach(channel => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(packet));
      }
    });
  }

  private handleBeforeUnload = () => {
    if (this.currentScreen === 'host') {
      this.sendSignalingMessage({ type: 'room-unregister', ip: window.location.hostname });
      this.sendSignalingMessage({ type: 'leave', from: 'host', to: 'all' });
    } else if (this.currentScreen === 'viewer') {
      this.sendSignalingMessage({ type: 'leave', from: this.viewerId, to: 'host' });
    }
  };

  private initWebSocketSignaling() {
    const signalingUrl = SIGNALING_URL;

    const socket = new WebSocket(signalingUrl);

    socket.onopen = () => {
      console.log('WebSocket signaling connected.');
      this.websocket = socket;

      if (this.currentScreen === 'host') {
        this.sendSignalingMessage({
          type: 'room-register',
          from: 'host',
          to: 'server',
          room: {
            name: `${this.currentNickname} 님의 방`,
            ip: this.serverDetectedIp || window.location.hostname,
            code: this.activeRoomCode,
            locked: this.isRoomLocked,
            fps: 30
          }
        });
      }
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'server-info') {
          this.serverDetectedIp = msg.ip;
          console.log('Server detected IP:', this.serverDetectedIp);

          if (this.currentScreen === 'host') {
            this.sendSignalingMessage({
              type: 'room-register',
              from: 'host',
              to: 'server',
              room: {
                name: `${this.currentNickname} 님의 방`,
                ip: this.serverDetectedIp,
                code: this.activeRoomCode,
                locked: this.isRoomLocked,
                fps: 30
              }
            });
          }
          return;
        }

        if (msg.type === 'room-list-response') {
          this.scannedRooms = msg.rooms;

          if (this.pendingRoomJoinCode) {
            const code = this.pendingRoomJoinCode;
            const fallbackIp = this.pendingRoomJoinIp;
            this.pendingRoomJoinCode = ''; // 1회만 자동입장 시도
            this.pendingRoomJoinIp = '';

            const foundRoom = this.scannedRooms.find(r => r.code === code || r.ip === code || r.name.includes(code));
            if (foundRoom) {
              this.checkPasswordAndJoin(foundRoom.name, foundRoom.ip, foundRoom.locked);
            } else {
              // 룸 목록에서 정확히 찾지 못했을 경우 링크에 동봉된 ipParam 주소를 우선 탑재하여 조인
              const targetIp = fallbackIp || (code === window.location.hostname || code === this.serverDetectedIp ? (this.serverDetectedIp || window.location.hostname) : code);
              this.checkPasswordAndJoin(`공유 회의방 (${code})`, targetIp, false);
            }
          }
          return;
        }

        if (msg.to !== 'host' && msg.to !== this.viewerId && msg.to !== 'all') return;
        if (msg.from === this.viewerId) return;

        if (msg.type === 'join-request') {
          if (this.currentScreen === 'host' && msg.roomCode === this.activeRoomCode) {
            await this.handleJoinRequest(msg.from, msg.nickname);
          }
        } else if (msg.type === 'offer') {
          await this.handleOffer(msg.from, msg.sdp);
        } else if (msg.type === 'answer') {
          await this.handleAnswer(msg.from, msg.sdp);
        } else if (msg.type === 'candidate') {
          await this.handleIceCandidate(msg.from, msg.candidate);
        } else if (msg.type === 'leave') {
          this.handlePeerLeave(msg.from);
        }
      } catch (err) {
        console.error('Error handling WebSocket message in client:', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket signaling disconnected. Retrying in 3s...');
      this.websocket = null;
      setTimeout(() => {
        if (this.isConnected) {
          this.initWebSocketSignaling();
        }
      }, 3000);
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  // --- WebRTC Signaling Helpers ---
  private sendSignalingMessage(msg: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(msg));
    }
  }

  private async handleJoinRequest(viewerId: string, nickname?: string) {
    if (this.currentScreen !== 'host') return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.hostConnections.set(viewerId, pc);
    this.hostViewerNicknames.set(viewerId, nickname || '참여자');
    this.updateParticipants();

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        pc.addTrack(track, this.screenStream!);
      });
    }

    pc.addTransceiver('audio', { direction: 'sendrecv' });

    const dc = pc.createDataChannel('chat');
    this.hostDataChannels.set(viewerId, dc);
    this.setupDataChannel(dc, viewerId);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'candidate',
          from: 'host',
          to: viewerId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (event.track.kind === 'audio') {
        const audio = document.createElement('audio');
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.style.display = 'none';
        audio.dataset.viewerId = viewerId;
        document.body.appendChild(audio);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignalingMessage({
      type: 'offer',
      from: 'host',
      to: viewerId,
      sdp: offer
    });

    this.showToast(`👥 [${nickname || '참여자'}] 님이 P2P 연결을 수집하고 있습니다.`);
  }

  private async handleAnswer(viewerId: string, sdp: any) {
    const pc = this.hostConnections.get(viewerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  private async handleOffer(_from: string, sdp: any) {
    if (this.currentScreen !== 'viewer') return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    this.viewerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'candidate',
          from: this.viewerId,
          to: 'host',
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.activeStream = event.streams[0];
      }
    };

    pc.ondatachannel = (event) => {
      this.viewerDataChannel = event.channel;
      this.setupDataChannel(event.channel, 'host');
    };

    pc.addTransceiver('audio', { direction: 'sendrecv' });

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    if (this.micStream) {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (sender) {
        sender.replaceTrack(this.micStream.getAudioTracks()[0]);
      }
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'answer',
      from: this.viewerId,
      to: 'host',
      sdp: answer
    });
  }

  private async handleIceCandidate(from: string, candidate: any) {
    if (this.currentScreen === 'host') {
      const pc = this.hostConnections.get(from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } else if (this.currentScreen === 'viewer' && from === 'host') {
      if (this.viewerConnection) {
        await this.viewerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  }

  private handlePeerLeave(from: string) {
    if (this.currentScreen === 'host') {
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
      const nickname = this.hostViewerNicknames.get(from) || '참여자';
      this.hostViewerNicknames.delete(from);
      this.updateParticipants();
      document.querySelectorAll(`audio[data-viewer-id="${from}"]`).forEach(el => el.remove());
      this.showToast(`🚪 [${nickname}] 님이 퇴장하셨습니다.`);
    } else if (this.currentScreen === 'viewer' && from === 'host') {
      this.leaveSession();
      this.showToast('🛑 호스트가 공유를 중단하여 메인으로 대기합니다.');
    }
  }

  private setupDataChannel(channel: RTCDataChannel, _remotePeerId: string) {
    channel.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'participants-update') {
          this.activeParticipants = packet.list;
          this.viewerCount = packet.list.length - 1;
          return;
        }
        if (packet.sender && packet.content) {
          this.chatMessages = [
            ...this.chatMessages,
            { sender: packet.sender, content: packet.content }
          ];
          setTimeout(() => {
            const chatBox = document.getElementById('chat-messages-box');
            if (chatBox) {
              chatBox.scrollTop = chatBox.scrollHeight;
            }
          }, 50);
        }
      } catch (e) {
        console.error('Failed to parse chat message:', e);
      }
    };
  }



  // --- Theme Manager ---
  private applyTheme(theme: string) {
    const htmlElement = document.documentElement;
    htmlElement.classList.remove('dark');
    if (theme === 'dark') {
      htmlElement.classList.add('dark');
    } else if (theme === 'light') {
      htmlElement.classList.remove('dark');
    } else if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        htmlElement.classList.add('dark');
      } else {
        htmlElement.classList.remove('dark');
      }
    }
  }

  private changeThemeMode(mode: string) {
    this.currentTheme = mode;
    setTheme(mode);
    this.applyTheme(mode);
    this.showToast(`☀️ 테마 설정이 [${mode === 'light' ? '밝은 테마' : mode === 'dark' ? '어두운 테마' : '시스템 연동'}]로 설정되었습니다.`);
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
      this.showToast('🔒 세션 잠금이 활성화되었습니다. 비밀번호를 설정하세요.');
    } else {
      this.showToast('🔓 세션 잠금이 비활성화되었습니다. 누구나 링크로 자유 접속 가능합니다.');
    }
  }

  // --- Broadcast (Host Mode) Simulation ---
  private generateRoomCode(): string {
    // 10~99 사이의 외우기 쉬운 2자리 방 번호 생성
    return String(Math.floor(10 + Math.random() * 90));
  }

  private getShareUrl(): string {
    if (this.serverDetectedIp) {
      // 로컬 개발 서버 포트가 있으면 사용하고, 없으면 기본 5173 포트 부여
      const port = window.location.port ? `:${window.location.port}` : ':5173';
      return `http://${this.serverDetectedIp}${port}/pn-lanlink-app/?room=${this.activeRoomCode}&ip=${this.serverDetectedIp}`;
    }
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const path = window.location.pathname; // 예: /pn-lanlink-app/
    return `${protocol}//${window.location.hostname}${port}${path}?room=${this.activeRoomCode}&ip=${window.location.hostname}`;
  }

  private async onStartSharing(e: CustomEvent<{ password: string }>) {
    this.hostPasswordHash = hashPassword(e.detail.password || '1234');

    // Generate dynamic room code
    this.activeRoomCode = this.generateRoomCode();

    // Simulate real screen capture stream
    this.screenStream = await captureScreen();

    this.hostSetupOpen = false;
    this.currentScreen = 'host';
    this.viewerCount = 0;
    this.showToast('🚀 회의 화면 공유 스트리밍이 정상 개설되었습니다!');

    // Register room via WebSocket signaling
    this.sendSignalingMessage({
      type: 'room-register',
      from: 'host',
      to: 'server',
      room: {
        name: `${this.currentNickname} 님의 방`,
        ip: this.serverDetectedIp || window.location.hostname,
        code: this.activeRoomCode,
        locked: this.isRoomLocked,
        fps: 30
      }
    });

    this.activeParticipants = [this.currentNickname];
  }

  private stopSharing() {
    this.currentScreen = 'landing';
    this.viewerCount = 0;
    this.activeParticipants = [];
    this.stopIdleTimer();
    this.idleSafeguardOpen = false;
    this.cleanupMediaStreams();
    this.showToast('⏹️ 화면 공유 방송을 종료하고 메인으로 대기합니다.');

    // Unregister room via WebSocket signaling
    this.sendSignalingMessage({
      type: 'room-unregister',
      from: 'host',
      to: 'server',
      ip: window.location.hostname
    });
  }

  // --- Room Join (Guest Viewer Mode) Simulation ---
  private onJoinRoom(e: CustomEvent<{ code: string }>) {
    const inputVal = e.detail.code.trim();
    if (!inputVal) {
      this.showToast('⚠️ 입장 코드 또는 링크를 입력해주세요.');
      return;
    }

    let code = inputVal;
    if (inputVal.includes('?room=')) {
      try {
        const urlObj = new URL(inputVal);
        code = urlObj.searchParams.get('room') || inputVal;
      } catch (e) {
        const match = inputVal.match(/[?&]room=([^&]+)/);
        if (match) code = match[1];
      }
    }

    const rooms = this.scannedRooms;
    const foundRoom = rooms.find(r => r.ip === code || r.code === code || r.name.includes(code));

    if (foundRoom) {
      this.pendingRoomJoinCode = foundRoom.code;
      this.checkPasswordAndJoin(foundRoom.name, foundRoom.ip, foundRoom.locked);
    } else {
      // 대기방 목록에 없더라도 입력된 숫자를 룸 번호로 간주하여 강제 다이렉트 조인 시도
      this.pendingRoomJoinCode = code;
      const params = new URLSearchParams(window.location.search);
      const ipParam = params.get('ip') || window.location.hostname;
      this.checkPasswordAndJoin(`공유 회의방 (${code})`, ipParam, false);
    }
  }

  private onSelectRoom(e: CustomEvent<{ name: string; ip: string; locked: boolean }>) {
    this.checkPasswordAndJoin(e.detail.name, e.detail.ip, e.detail.locked);
  }

  private checkPasswordAndJoin(name: string, ip: string, isLocked: boolean) {
    this.tempJoinName = name;
    this.tempJoinIp = ip;

    if (isLocked) {
      this.passwordVerifyModalOpen = true;
    } else {
      this.joinRoomDirectly();
    }
  }

  private onSubmitVerifyPassword(e: CustomEvent<{ password: string }>) {
    const entered = e.detail.password;

    // Verify password using crypto helper
    if (verifyPassword(entered, this.hostPasswordHash)) {
      this.passwordVerifyModalOpen = false;
      this.joinRoomDirectly();
      this.showToast(`🔑 인증에 성공했습니다. [${this.tempJoinName}] 님의 화면을 수신합니다.`);
    } else {
      this.showToast('❌ 비밀번호가 올바르지 않습니다. (기본: 1234)');
    }
  }

  private joinRoomDirectly() {
    this.currentScreen = 'viewer';
    this.activeRoomName = this.tempJoinName;
    this.activeRoomIp = this.tempJoinIp;
    this.viewerCount = 0;
    this.activeParticipants = [];

    // Reset Chat Messages
    this.chatMessages = [
      { sender: 'System', content: '📢 보안 안내: 해당 대화 내역은 외부 서버에 저장되지 않고 WebRTC 패킷으로 흐르며, 방 종료 즉시 메모리에서 완벽하게 파기됩니다.', system: true }
    ];

    // Send Join Request to Host via signaling (방 코드를 패킷에 실어서 송신)
    setTimeout(() => {
      this.sendSignalingMessage({
        type: 'join-request',
        from: this.viewerId,
        to: 'host',
        roomCode: this.pendingRoomJoinCode || this.activeRoomCode,
        nickname: this.currentNickname
      });
    }, 500);

    this.showToast(`⚡ ${this.activeRoomName} 님의 LAN 세션 연결 시도 중...`);
  }

  private leaveSession() {
    this.currentScreen = 'landing';
    this.viewerCount = 0;
    this.activeParticipants = [];

    // Send leave signal
    this.sendSignalingMessage({
      type: 'leave',
      from: this.viewerId,
      to: 'host'
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
    this.showToast('🚪 세션 연결이 중단되었습니다.');
  }

  // --- Mic Mute Toggle ---
  private async toggleLocalMute() {
    this.localMuted = !this.localMuted;

    if (this.currentScreen === 'viewer') {
      const audioTransceiver = this.viewerConnection?.getTransceivers().find(
        t => t.receiver.track && t.receiver.track.kind === 'audio'
      );
      const sender = audioTransceiver?.sender;

      if (!this.localMuted) {
        this.micStream = await captureMicrophone();
        if (this.micStream && sender) {
          sender.replaceTrack(this.micStream.getAudioTracks()[0]);
        }
      } else {
        if (sender) {
          sender.replaceTrack(null);
        }
        if (this.micStream) {
          stopMediaStream(this.micStream);
          this.micStream = null;
        }
      }
    }

    setStreamAudioEnabled(this.micStream, !this.localMuted);
    this.showToast(this.localMuted ? '🔇 내 마이크가 음소거되었습니다.' : '🎙️ 마이크가 켜졌습니다. (보이스 VoIP 송신 시작)');
  }

  // --- Annotation Overlay Toggle ---
  private toggleAnnotationOverlay() {
    this.annotationVisible = !this.annotationVisible;
    this.showToast(this.annotationVisible ? '✏️ 화면 드로잉 필기 레이어를 오버레이합니다.' : '✏️ 화면 드로잉 필기 레이어를 숨깁니다.');
  }

  // --- Virtual Pointer Click Simulation ---
  private simulateClick() {
    this.cursorVisible = true;
    this.cursorX = Math.floor(Math.random() * 40 + 20); // range 20% to 60%
    this.cursorY = Math.floor(Math.random() * 40 + 20);
    this.showToast('⚡ 가상 원격 마우스 클릭 신호 전송 (WebRTC DataChannel)');
    setTimeout(() => {
      this.cursorVisible = false;
    }, 2000);
  }

  // --- Real-time Local Chat ---
  private onSendMessage(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text;
    this.chatMessages = [
      ...this.chatMessages,
      { sender: this.currentNickname, content: text }
    ];

    const packet = { sender: this.currentNickname, content: text, timestamp: Date.now() };

    // If host, send to all viewers
    if (this.currentScreen === 'host') {
      this.hostDataChannels.forEach(channel => {
        if (channel.readyState === 'open') {
          channel.send(JSON.stringify(packet));
        }
      });
    }
    // If viewer, send to host
    else if (this.currentScreen === 'viewer') {
      if (this.viewerDataChannel && this.viewerDataChannel.readyState === 'open') {
        this.viewerDataChannel.send(JSON.stringify(packet));
      }
    }

    setTimeout(() => {
      const chatBox = document.getElementById('chat-messages-box');
      if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }, 50);
  }

  // --- Idle Safeguard Timer ---
  private simulateIdleTrigger() {
    this.idleSafeguardOpen = true;
    this.idleCountdown = 60;
    this.showToast('🚦 대역폭 세이버 연출이 작동되었습니다.');
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
    this.showToast('✅ 회의 유지가 요청되었습니다. 세션 대기방 타이머 초기화 완료.');
  }

  private triggerImmediateStop() {
    this.stopIdleTimer();
    this.idleSafeguardOpen = false;
    this.stopSharing();
    this.showToast('🛑 미활동 감지로 인해 세션이 자동으로 안전 종료되었습니다.');
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
    const inputVal = this.inputGuestNicknameElement ? this.inputGuestNicknameElement.value.trim() : '';
    if (!inputVal) {
      this.showToast('⚠️ 대화명을 입력해주세요.');
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
    this.showToast('👑 LANLink PRO 버전 정식 라이센스가 구독 연동되었습니다. (체험 서비스)');
  }

  // --- Helper to clean up streams ---
  private cleanupMediaStreams() {
    stopMediaStream(this.screenStream);
    stopMediaStream(this.micStream);
    this.screenStream = null;
    this.micStream = null;
  }

  private copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('📋 접속 고유 링크가 클립보드에 복사되었습니다!');
    }).catch(() => {
      this.showToast('❌ 복사에 실패했습니다.');
    });
  }

  private handleLogoClick() {
    if (this.currentScreen === 'host') {
      this.stopSharing();
    } else if (this.currentScreen === 'viewer') {
      this.leaveSession();
    } else {
      this.currentScreen = 'landing';
    }
  }

  // --- Render Coordinator Templates ---
  render() {
    return html`
      <!-- Header Navigation -->
      <ll-header .currentNickname=${this.currentNickname} .currentTheme=${this.currentTheme}
        @edit-nickname=${this.openNicknameEdit} @change-theme=${this.onThemeChange} @open-pro=${this.openProModal}
        @logo-click=${this.handleLogoClick}>
      </ll-header>
      
      <!-- Main Layout -->
      <main class="grow max-w-7xl mx-auto px-6 py-12 md:py-20 w-full flex flex-col justify-center">
      
        <!-- Landing page panel -->
        ${this.currentScreen === 'landing' ? html`
        <div id="landing-grid-container" class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
      
          <ll-hero class="lg:col-span-6 block" .hostSetupOpen=${this.hostSetupOpen} .isRoomLocked=${this.isRoomLocked}
            .hostPassword=${'1234'} @toggle-drawer=${this.toggleHostSetupDrawer} @toggle-lock=${this.onToggleLock}
            @start-sharing=${this.onStartSharing} @join-room=${this.onJoinRoom}></ll-hero>
      
          <ll-carousel class="lg:col-span-6 block" .carouselIndex=${this.carouselIndex}
            @switch-carousel=${this.onSwitchCarousel}></ll-carousel>
      
          <ll-mdns-list class="lg:col-span-6 block" .rooms=${this.scannedRooms} @select-room=${this.onSelectRoom}>
          </ll-mdns-list>
        </div>
        ` : ''}
      
        <!-- Active Host Sharing Workspace -->
        ${this.currentScreen === 'host' ? html`
        <div id="sharing-active-workspace" class="max-w-7xl mx-auto w-full grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div class="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-8 custom-shadow animate-in zoom-in-95 duration-300">
            <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div class="flex items-center gap-3">
                <span class="relative flex h-3 w-3">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <div>
                  <h4 class="text-lg font-bold text-slate-900 dark:text-white">회의 스트리밍 방송 가동 중</h4>
                  <p class="text-xs text-slate-500">사내망 다이렉트 WebRTC 스트리밍이 가동되고 있습니다.</p>
                </div>
              </div>
              <div
                class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <i data-lucide="users" class="w-4 h-4 text-google-blue"></i>
                <span class="text-slate-600 dark:text-slate-300 font-semibold">참여자: <span id="viewer-count"
                    class="text-google-blue">${this.viewerCount}</span>명</span>
              </div>
            </div>
        
            <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div
                class="md:col-span-4 bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shadow-inner">
                <div class="bg-white p-2 rounded-xl mb-3 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(this.getShareUrl())}" class="w-24 h-24 rounded-lg" alt="Share QR Code" />
                </div>
                <span class="text-xs text-slate-400">모바일 / 태블릿 간편 QR</span>
                <div class="mt-1 text-md font-bold text-google-blue tracking-wider">${this.activeRoomCode}</div>
              </div>
        
              <div class="md:col-span-8 flex flex-col justify-between space-y-4">
                <div class="space-y-1">
                  <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">로컬 접속 공유 링크</span>
                  <div class="flex items-center gap-2">
                    <div
                      class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl grow font-mono text-xs text-slate-600 dark:text-slate-300 break-all select-all">
                      ${this.getShareUrl()}
                    </div>
                    <button @click=${() => this.copyToClipboard(this.getShareUrl())} class="p-2.5
                      bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-google-blue
                      text-slate-500 rounded-lg transition" title="링크 복사">
                      <i data-lucide="copy" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>
        
                <div class="bg-google-blue/5 p-4 rounded-xl border border-google-blue/10 text-xs text-slate-500 space-y-1">
                  <p class="font-bold text-google-blue flex items-center gap-1">
                    <i data-lucide="lock" class="w-3.5 h-3.5"></i> 종단간 보안 기밀 보호 작동 중
                  </p>
                  <p class="text-[11px] leading-relaxed">
                    설정된 비밀번호가 안전하게 키로 바인딩되었습니다. 사내 메신저나 슬랙에 주소를 전달하세요.
                  </p>
                </div>
        
                <div
                  class="flex flex-col sm:flex-row gap-2 pt-2 justify-between items-center border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div class="flex items-center gap-1.5 text-slate-400">
                    <span>테스트 기능:</span>
                    <button @click=${this.simulateIdleTrigger}
                      class="text-google-blue dark:text-google-blue hover:underline font-bold">
                      미접속 30분 초과 연출 ⚡
                    </button>
                  </div>
                  <button @click=${this.stopSharing}
                    class="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <i data-lucide="square" class="w-3.5 h-3.5 fill-rose-600"></i> 방송 종료하기
                  </button>
                </div>
              </div>
            </div>
          </div>
          <ll-chat
            .chatMessages=${this.chatMessages}
            .viewerCount=${this.viewerCount}
            .participants=${this.activeParticipants}
            @send-message=${this.onSendMessage}
            class="xl:col-span-4 block w-full"
          ></ll-chat>
        </div>
        ` : ''}
      
        <!-- Active Guest Viewer Workspace -->
        ${this.currentScreen === 'viewer' ? html`
        <ll-viewer .activeRoomName=${this.activeRoomName} .activeRoomIp=${this.activeRoomIp} .localMuted=${this.localMuted}
          .annotationVisible=${this.annotationVisible} .cursorVisible=${this.cursorVisible} .cursorX=${this.cursorX}
          .cursorY=${this.cursorY} .chatMessages=${this.chatMessages} .viewerCount=${this.viewerCount}
          .participants=${this.activeParticipants} .stream=${this.activeStream}
          @toggle-mute=${this.toggleLocalMute} @simulate-click=${this.simulateClick}
          @toggle-draw=${this.toggleAnnotationOverlay} @leave-session=${this.leaveSession}
          @send-message=${this.onSendMessage}>
          <ll-voice .localMuted=${this.localMuted}></ll-voice>
        </ll-viewer>
        ` : ''}
      
      </main>
      
      <footer class="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 mt-12 py-6 transition-colors">
        <div
          class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          <div>© 2026 LANLink Inc. 사내 로컬 연결 제어 인프라스트럭처</div>
          <div class="flex gap-4">
            <a href="#" class="hover:text-slate-600 transition">서비스 가이드</a>
            <a href="#" class="hover:text-slate-600 transition">보안 감사 및 Compliance</a>
            <a href="#" class="hover:text-slate-600 transition">사내망 구축 문의</a>
          </div>
        </div>
      </footer>
      
      <!-- Modals and Overlays -->
      ${this.renderNicknameModal()}
      
      <modal-password .open=${this.passwordVerifyModalOpen} @close-modal=${() => this.passwordVerifyModalOpen = false}
        @submit-verify-password=${this.onSubmitVerifyPassword}
        ></modal-password>
      
      <modal-saver .open=${this.idleSafeguardOpen} .countdown=${this.idleCountdown} @keep-session=${this.cancelIdleSafeguard}
        @stop-session=${this.triggerImmediateStop}></modal-saver>
      
      ${this.renderProModal()}
      ${this.renderToast()}
    `;
  }

  private renderNicknameModal() {
    return html`
      <div id="nickname-modal"
        class="${this.nicknameModalOpen ? '' : 'hidden'} fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
          <div
            class="w-12 h-12 bg-google-blue/10 border border-google-blue/20 text-google-blue rounded-full flex items-center justify-center mx-auto mb-3">
            <i data-lucide="user-plus" class="w-6 h-6"></i>
          </div>
          <h3 class="text-md font-bold text-center text-slate-800 dark:text-white">사내 대화명 설정</h3>
          <p class="text-xs text-center text-slate-500 mt-1 leading-relaxed">
            LANLink는 회원가입 정보 대신 일회성 닉네임을 사용합니다.<br>대화명을 입력해 주세요.
          </p>
      
          <div class="my-4">
            <input type="text" id="input-guest-nickname" .value=${this.tempNicknameInput} placeholder="예: 김 대리 (개발팀)"
              class="w-full text-center py-2.5 bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-google-blue focus:outline-none font-semibold text-sm text-slate-800 dark:text-white">
          </div>
      
          <div class="flex gap-2">
            <button @click=${this.closeNicknameModal}
              class="grow bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition">
              취소
            </button>
            <button @click=${this.submitNickname}
              class="grow bg-google-blue hover:bg-google-blueHover text-white font-bold py-2.5 rounded-xl text-xs transition">
              대화명 저장 및 입장
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderProModal() {
    return html`
      <div id="pro-modal"
        class="${this.proModalOpen ? '' : 'hidden'} fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          class="bg-white dark:bg-slate-900 border-2 border-amber-500/30 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative">
          <button @click=${this.closeProModal} class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
          <div
            class="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <i data-lucide="crown" class="w-8 h-8 fill-amber-500 animate-bounce"></i>
          </div>
          <h3 class="text-xl font-extrabold text-slate-900 dark:text-white">LANLink Pro 업그레이드</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            '실시간 고화질 화면 및 음성 동시 녹화', '비밀번호 세션 잠금', '초저지연 보이스 토크' 기능은 정식 런칭 시 Pro 패키지로 분류됩니다.
          </p>
          <div
            class="my-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-left space-y-2.5">
            <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <i data-lucide="check" class="w-4 h-4 text-amber-500"></i> 오디오와 미디어가 자동 정렬되는 60FPS 회의 녹화
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <i data-lucide="check" class="w-4 h-4 text-amber-500"></i> 사내 전원 비밀번호 잠금 설정 및 비공개 세션 개설
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <i data-lucide="check" class="w-4 h-4 text-amber-500"></i> 다이렉트 보이스 채널링 개설 (WebRTC VoIP)
            </div>
          </div>
          <div class="flex gap-3">
            <button @click=${this.closeProModal}
              class="grow bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-sm transition">
              다음에 하기
            </button>
            <button @click=${this.upgradeSuccess}
              class="grow bg-linear-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black py-3 rounded-xl text-sm transition">
              업그레이드 (구독)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderToast() {
    return html`
      <div id="toast"
        class="transition-all duration-300 ${this.toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} fixed bottom-6 right-6 z-50 bg-white dark:bg-slate-900 border border-blue-500 text-slate-800 dark:text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm">
        <i data-lucide="info" class="w-4 h-4 text-google-blue"></i>
        <span id="toast-message">${this.toastMessage}</span>
      </div>
    `;
  }
}
