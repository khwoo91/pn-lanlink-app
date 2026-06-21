import { LitElement, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('ll-hero')
export class LlHero extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) hostSetupOpen = false;
  @property({ type: Boolean }) isRoomLocked = true;
  @property({ type: String }) hostPassword = '1234';

  @query('#join-code-input') private joinCodeInputElement?: HTMLInputElement;
  @query('#host-password-input') private hostPasswordInputElement?: HTMLInputElement;

  render() {
    return html`
      <div class="space-y-8">
        <div class="space-y-4">
          <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            안전하고 자유로운 <br class="hidden md:inline">
            <span class="text-[#1a73e8]">사내망 화면 공유</span> 및 제어
          </h1>
          <p class="text-md md:text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
            외부 인터넷 연결 없이 오직 사내망(LAN)을 통해 딜레이 없는 초고화질 무설치 스트리밍과 통화를 가동해 보세요.
          </p>
        </div>

        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <!-- Open host room setup -->
            <button @click=${this.onToggleHostSetupDrawer} class="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm text-sm">
              <i data-lucide="video" class="w-4 h-4 fill-white"></i> 새 공유방 개설
            </button>

            <!-- Code input -->
            <div class="flex items-center flex-grow max-w-sm relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <i data-lucide="keyboard" class="w-4 h-4"></i>
              </div>
              <input type="text" id="join-code-input" placeholder="코드 또는 링크 입력" class="w-full pl-9 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all">
            </div>

            <!-- Join room button -->
            <button @click=${this.onJoinRoom} class="text-slate-500 dark:text-slate-400 hover:text-[#1a73e8] font-bold text-sm px-4 py-3 transition">
              참여
            </button>
          </div>

          <!-- Drawer panel -->
          <div id="host-setup-drawer" class="${this.hostSetupOpen ? '' : 'hidden'} bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-200">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider">새로운 공유 설정</h3>
              <button @click=${this.onToggleHostSetupDrawer} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
              <label class="flex items-center gap-2 p-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:border-[#1a73e8] transition">
                <input type="checkbox" id="toggle-control" class="accent-[#1a73e8]" checked>
                <span>원격 제어 허용</span>
              </label>
              <label class="flex items-center gap-2 p-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:border-[#1a73e8] transition">
                <input type="checkbox" id="toggle-draw" class="accent-[#1a73e8]" checked>
                <span>낙서 필기 허용</span>
              </label>
              <label class="flex items-center gap-2 p-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:border-[#1a73e8] transition">
                <input type="checkbox" id="toggle-voice" class="accent-[#1a73e8]" checked>
                <span>음성 보이스 VoIP</span>
              </label>
              <label class="flex items-center gap-2 p-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:border-[#1a73e8] transition">
                <input type="checkbox" id="toggle-lock" @change=${this.onToggleLock} class="accent-[#1a73e8]" ?checked=${this.isRoomLocked}>
                <span>비밀번호 잠금</span>
              </label>
              <label class="col-span-2 flex items-center gap-2 p-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:border-[#1a73e8] transition">
                <input type="checkbox" id="toggle-record" class="accent-[#1a73e8]" checked>
                <span>회의 녹화 활성화 <span class="text-[9px] text-amber-500 font-bold ml-1">PRO</span></span>
              </label>
            </div>

            <!-- Password configuration -->
            <div id="password-setup-container" class="${this.isRoomLocked ? '' : 'hidden'} space-y-1">
              <span class="text-[11px] text-slate-500 font-semibold">입장 비밀번호</span>
              <input type="password" id="host-password-input" .value=${this.hostPassword} class="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-[#1a73e8] font-mono text-slate-800 dark:text-white">
            </div>

            <button @click=${this.onStartSharing} class="w-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-bold py-2.5 rounded-lg transition-colors">
              구성 완료 및 공유 시작
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private onToggleHostSetupDrawer() {
    this.dispatchEvent(new CustomEvent('toggle-drawer', { bubbles: true, composed: true }));
  }

  private onToggleLock(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new CustomEvent('toggle-lock', { detail: { checked }, bubbles: true, composed: true }));
  }

  private onStartSharing() {
    const password = this.hostPasswordInputElement ? this.hostPasswordInputElement.value : '1234';
    this.dispatchEvent(new CustomEvent('start-sharing', { detail: { password }, bubbles: true, composed: true }));
  }

  private onJoinRoom() {
    const code = this.joinCodeInputElement ? this.joinCodeInputElement.value.trim() : '';
    this.dispatchEvent(new CustomEvent('join-room', { detail: { code }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'll-hero': LlHero;
  }
}
