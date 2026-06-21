import { LitElement, html } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { 
  createIcons, 
  Users, 
  Copy, 
  Lock, 
  Square, 
  Info, 
  Crown, 
  ShieldAlert, 
  X,
  Zap,
  User,
  Pencil,
  Sun,
  Moon,
  Monitor,
  Video,
  Keyboard,
  Search,
  Unlock,
  MessagesSquare,
  SendHorizontal,
  MousePointer,
  PenTool,
  Pointer,
  PlayCircle,
  Mic,
  MousePointerClick,
  UserPlus,
  Check
} from 'lucide';

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
import { mockRooms, scanLocalNetworkRooms } from './infrastructure/mdns-signaling';
import type { LANRoom } from './infrastructure/mdns-signaling';

@customElement('my-element')
export class MyElement extends LitElement {
  updated() {
    createIcons({
      icons: {
        Users,
        Copy,
        Lock,
        Square,
        Info,
        Crown,
        ShieldAlert,
        X,
        Zap,
        User,
        Pencil,
        Sun,
        Moon,
        Monitor,
        Video,
        Keyboard,
        Search,
        Unlock,
        MessagesSquare,
        SendHorizontal,
        MousePointer,
        PenTool,
        Pointer,
        PlayCircle,
        Mic,
        MousePointerClick,
        UserPlus,
        Check
      },
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
  @state() private scannedRooms: LANRoom[] = mockRooms;

  // Active room details
  @state() private activeRoomName: string = '';
  @state() private activeRoomIp: string = '';

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

  connectedCallback() {
    super.connectedCallback();
    
    // Load local storage states via storage utility
    this.currentTheme = getTheme();
    this.applyTheme(this.currentTheme);
    this.currentNickname = getNickname();

    // Trigger local scan simulation
    this.scanRooms();

    // Start auto carousel cycling every 5 seconds
    this.startCarouselInterval();
  }

  disconnectedCallback() {
    this.stopCarouselInterval();
    this.stopIdleTimer();
    this.cleanupMediaStreams();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    super.disconnectedCallback();
  }

  // --- Network Scanning ---
  private async scanRooms() {
    this.scannedRooms = await scanLocalNetworkRooms();
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
  private async onStartSharing(e: CustomEvent<{ password: string }>) {
    this.hostPasswordHash = hashPassword(e.detail.password || '1234');
    
    // Simulate real screen capture stream
    this.screenStream = await captureScreen();
    
    this.hostSetupOpen = false;
    this.currentScreen = 'host';
    this.viewerCount = 0;
    this.showToast('🚀 회의 화면 공유 스트리밍이 정상 개설되었습니다!');
    
    // Simulate other users joining the meeting after a few seconds
    setTimeout(() => {
      if (this.currentScreen === 'host') {
        this.viewerCount = 1;
        this.showToast('👥 팀원이 공유방에 입장했습니다.');
      }
    }, 4000);

    setTimeout(() => {
      if (this.currentScreen === 'host') {
        this.viewerCount = 2;
      }
    }, 10000);
  }

  private stopSharing() {
    this.currentScreen = 'landing';
    this.viewerCount = 0;
    this.stopIdleTimer();
    this.idleSafeguardOpen = false;
    this.cleanupMediaStreams();
    this.showToast('⏹️ 화면 공유 방송을 종료하고 메인으로 대기합니다.');
  }

  // --- Room Join (Guest Viewer Mode) Simulation ---
  private onJoinRoom(e: CustomEvent<{ code: string }>) {
    const inputVal = e.detail.code;
    if (!inputVal) {
      this.showToast('⚠️ 입장 코드 또는 링크를 입력해주세요.');
      return;
    }
    if (inputVal.includes('192.168.1.12') || inputVal.includes('992') || inputVal.includes('철수')) {
      this.checkPasswordAndJoin('김철수 시니어', '192.168.1.12', true);
    } else {
      this.checkPasswordAndJoin('박나리 수석', '192.168.1.84', false);
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
    this.viewerCount = 1;

    // Reset Chat Messages
    this.chatMessages = [
      { sender: 'System', content: '📢 보안 안내: 해당 대화 내역은 외부 서버에 저장되지 않고 WebRTC 패킷으로 흐르며, 방 종료 즉시 메모리에서 완벽하게 파기됩니다.', system: true },
      { sender: this.activeRoomName, content: `안녕하세요! 사내 연결 주소로 잘 들어오셨네요. VS Code 화면 글자 잘 보이시나요?` }
    ];

    this.showToast(`⚡ ${this.activeRoomName} 님의 LAN 세션 연결 성공!`);
  }

  private leaveSession() {
    this.currentScreen = 'landing';
    this.viewerCount = 0;
    this.cleanupMediaStreams();
    this.showToast('🚪 세션 연결이 중단되었습니다.');
  }

  // --- Mic Mute Toggle ---
  private async toggleLocalMute() {
    this.localMuted = !this.localMuted;
    
    if (!this.localMuted && !this.micStream) {
      // Capture microphone on unmute
      this.micStream = await captureMicrophone();
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

  // --- Render Coordinator Templates ---
  render() {
    return html`
      <!-- Header Navigation -->
      <ll-header
        .currentNickname=${this.currentNickname}
        .currentTheme=${this.currentTheme}
        @edit-nickname=${this.openNicknameEdit}
        @change-theme=${this.onThemeChange}
        @open-pro=${this.openProModal}
      ></ll-header>

      <!-- Main Layout -->
      <main class="flex-grow max-w-7xl mx-auto px-6 py-12 md:py-20 w-full flex flex-col justify-center">
        
        <!-- Landing page panel -->
        ${this.currentScreen === 'landing' ? html`
          <div id="landing-grid-container" class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            <ll-hero
              class="lg:col-span-6 block"
              .hostSetupOpen=${this.hostSetupOpen}
              .isRoomLocked=${this.isRoomLocked}
              .hostPassword=${'1234'}
              @toggle-drawer=${this.toggleHostSetupDrawer}
              @toggle-lock=${this.onToggleLock}
              @start-sharing=${this.onStartSharing}
              @join-room=${this.onJoinRoom}
            ></ll-hero>

            <ll-carousel
              class="lg:col-span-6 block"
              .carouselIndex=${this.carouselIndex}
              @switch-carousel=${this.onSwitchCarousel}
            ></ll-carousel>

            <ll-mdns-list
              class="lg:col-span-6 block"
              .rooms=${this.scannedRooms}
              @select-room=${this.onSelectRoom}
            ></ll-mdns-list>
          </div>
        ` : ''}

        <!-- Active Host Sharing Workspace -->
        ${this.currentScreen === 'host' ? html`
          <div id="sharing-active-workspace" class="max-w-3xl mx-auto w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-8 custom-shadow animate-in zoom-in-95 duration-300">
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
              <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <i data-lucide="users" class="w-4 h-4 text-google-blue"></i>
                <span class="text-slate-600 dark:text-slate-300 font-semibold">참여자: <span id="viewer-count" class="text-google-blue">${this.viewerCount}</span>명</span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div class="md:col-span-4 bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shadow-inner">
                <div class="bg-slate-950 dark:bg-white p-2 rounded-xl mb-3">
                  <svg class="w-24 h-24 text-white dark:text-slate-950" viewBox="0 0 100 100" fill="currentColor">
                    <rect x="0" y="0" width="25" height="25"/>
                    <rect x="5" y="5" width="15" height="15" fill="none" class="text-slate-950 dark:text-white" stroke="currentColor" stroke-width="4"/>
                    <rect x="10" y="10" width="5" height="5"/>
                    <rect x="75" y="0" width="25" height="25"/>
                    <rect x="80" y="5" width="15" height="15" fill="none" class="text-slate-950 dark:text-white" stroke="currentColor" stroke-width="4"/>
                    <rect x="85" y="10" width="5" height="5"/>
                    <rect x="0" y="75" width="25" height="25"/>
                    <rect x="5" y="80" width="15" height="15" fill="none" class="text-slate-950 dark:text-white" stroke="currentColor" stroke-width="4"/>
                    <rect x="10" y="85" width="5" height="5"/>
                    <rect x="35" y="10" width="10" height="5"/>
                    <rect x="55" y="20" width="5" height="15"/>
                    <rect x="30" y="45" width="20" height="5"/>
                  </svg>
                </div>
                <span class="text-xs text-slate-400">모바일 / 태블릿 간편 QR</span>
                <div class="mt-1 text-md font-bold text-google-blue tracking-wider">LNK-992-81</div>
              </div>

              <div class="md:col-span-8 flex flex-col justify-between space-y-4">
                <div class="space-y-1">
                  <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">로컬 접속 공유 링크</span>
                  <div class="flex items-center gap-2">
                    <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl flex-grow font-mono text-xs text-slate-600 dark:text-slate-300 break-all select-all">
                      http://192.168.1.45:8080/join/LNK-992-81
                    </div>
                    <button @click=${() => this.copyToClipboard('http://192.168.1.45:8080/join/LNK-992-81')} class="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-google-blue text-slate-500 rounded-lg transition" title="링크 복사">
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

                <div class="flex flex-col sm:flex-row gap-2 pt-2 justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-3 text-xs">
                  <div class="flex items-center gap-1.5 text-slate-400">
                    <span>테스트 기능:</span>
                    <button @click=${this.simulateIdleTrigger} class="text-google-blue dark:text-google-blue hover:underline font-bold">
                      미접속 30분 초과 연출 ⚡
                    </button>
                  </div>
                  <button @click=${this.stopSharing} class="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <i data-lucide="square" class="w-3.5 h-3.5 fill-rose-600"></i> 방송 종료하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Active Guest Viewer Workspace -->
        ${this.currentScreen === 'viewer' ? html`
          <ll-viewer
            .activeRoomName=${this.activeRoomName}
            .activeRoomIp=${this.activeRoomIp}
            .localMuted=${this.localMuted}
            .annotationVisible=${this.annotationVisible}
            .cursorVisible=${this.cursorVisible}
            .cursorX=${this.cursorX}
            .cursorY=${this.cursorY}
            @toggle-mute=${this.toggleLocalMute}
            @simulate-click=${this.simulateClick}
            @toggle-draw=${this.toggleAnnotationOverlay}
            @leave-session=${this.leaveSession}
          >
            <!-- Slot children in viewer grid layout -->
            <ll-chat
              .chatMessages=${this.chatMessages}
              .viewerCount=${this.viewerCount}
              @send-message=${this.onSendMessage}
            ></ll-chat>
            <ll-voice
              .localMuted=${this.localMuted}
            ></ll-voice>
          </ll-viewer>
        ` : ''}

      </main>

      <footer class="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 mt-12 py-6 transition-colors">
        <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
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
      
      <modal-password
        .open=${this.passwordVerifyModalOpen}
        @close-modal=${() => this.passwordVerifyModalOpen = false}
        @submit-verify-password=${this.onSubmitVerifyPassword}
      ></modal-password>

      <modal-saver
        .open=${this.idleSafeguardOpen}
        .countdown=${this.idleCountdown}
        @keep-session=${this.cancelIdleSafeguard}
        @stop-session=${this.triggerImmediateStop}
      ></modal-saver>

      ${this.renderProModal()}
      ${this.renderToast()}
    `;
  }

  private renderNicknameModal() {
    return html`
      <div id="nickname-modal" class="${this.nicknameModalOpen ? '' : 'hidden'} fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
          <div class="w-12 h-12 bg-google-blue/10 border border-google-blue/20 text-google-blue rounded-full flex items-center justify-center mx-auto mb-3">
            <i data-lucide="user-plus" class="w-6 h-6"></i>
          </div>
          <h3 class="text-md font-bold text-center text-slate-800 dark:text-white">사내 대화명 설정</h3>
          <p class="text-xs text-center text-slate-500 mt-1 leading-relaxed">
            LANLink는 회원가입 정보 대신 일회성 닉네임을 사용합니다.<br>대화명을 입력해 주세요.
          </p>

          <div class="my-4">
            <input type="text" id="input-guest-nickname" .value=${this.tempNicknameInput} placeholder="예: 김 대리 (개발팀)" class="w-full text-center py-2.5 bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-google-blue focus:outline-none font-semibold text-sm text-slate-800 dark:text-white">
          </div>

          <div class="flex gap-2">
            <button @click=${this.closeNicknameModal} class="flex-grow bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition">
              취소
            </button>
            <button @click=${this.submitNickname} class="flex-grow bg-google-blue hover:bg-google-blueHover text-white font-bold py-2.5 rounded-xl text-xs transition">
              대화명 저장 및 입장
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderProModal() {
    return html`
      <div id="pro-modal" class="${this.proModalOpen ? '' : 'hidden'} fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border-2 border-amber-500/30 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative">
          <button @click=${this.closeProModal} class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
          <div class="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <i data-lucide="crown" class="w-8 h-8 fill-amber-500 animate-bounce"></i>
          </div>
          <h3 class="text-xl font-extrabold text-slate-900 dark:text-white">LANLink Pro 업그레이드</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            '실시간 고화질 화면 및 음성 동시 녹화', '비밀번호 세션 잠금', '초저지연 보이스 토크' 기능은 정식 런칭 시 Pro 패키지로 분류됩니다.
          </p>
          <div class="my-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-left space-y-2.5">
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
            <button @click=${this.closeProModal} class="flex-grow bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-sm transition">
              다음에 하기
            </button>
            <button @click=${this.upgradeSuccess} class="flex-grow bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black py-3 rounded-xl text-sm transition">
              업그레이드 (구독)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderToast() {
    return html`
      <div id="toast" class="transition-all duration-300 ${this.toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} fixed bottom-6 right-6 z-50 bg-white dark:bg-slate-900 border border-blue-500 text-slate-800 dark:text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm">
        <i data-lucide="info" class="w-4 h-4 text-google-blue"></i>
        <span id="toast-message">${this.toastMessage}</span>
      </div>
    `;
  }
}
