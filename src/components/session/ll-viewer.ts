import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ll-viewer')
export class LlViewer extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: String }) activeRoomName = '';
  @property({ type: String }) activeRoomIp = '';
  @property({ type: Boolean }) localMuted = true;
  @property({ type: Boolean }) annotationVisible = false;
  @property({ type: Boolean }) cursorVisible = false;
  @property({ type: Number }) cursorX = 33;
  @property({ type: Number }) cursorY = 50;

  render() {
    const isChulsoo = this.activeRoomName.includes('김철수');

    return html`
      <div id="active-viewer-container" class="max-w-7xl mx-auto w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 class="text-sm font-bold text-slate-800 dark:text-white">
              <span id="target-host-name">${this.activeRoomName}</span> 님의 로컬 영상 및 음성 수신 중 (${this.activeRoomIp})
            </h3>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span id="badge-control" class="${isChulsoo ? '' : 'hidden'} bg-[#1a73e8]/10 text-[#1a73e8] px-2.5 py-1 rounded-md border border-[#1a73e8]/20 font-semibold">
              <i data-lucide="mouse-pointer" class="inline w-3 h-3 mr-1"></i> 원격제어
            </span>
            <span id="badge-draw" class="${isChulsoo ? '' : 'hidden'} bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-md border border-amber-500/20 font-semibold">
              <i data-lucide="pen-tool" class="inline w-3 h-3 mr-1"></i> 필기 낙서
            </span>
            <button @click=${this.onLeaveSession} class="text-rose-500 hover:text-rose-700 font-semibold ml-2 transition">연결 끊기</button>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <!-- Left: 16:9 Screen Capturer Screen (8/12) -->
          <div class="xl:col-span-8 flex flex-col space-y-4">
            <div class="relative bg-slate-900 dark:bg-slate-955 rounded-2xl border border-slate-200 dark:border-slate-800 aspect-video overflow-hidden group flex items-center justify-center">
              
              <!-- Mock visual diagrams -->
              <svg class="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 800 450" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="20" width="200" height="15" rx="4" fill="#1a73e8"/>
                <rect x="20" y="45" width="340" height="12" rx="4" fill="#475569" class="dark:fill-[#334155]"/>
                <rect x="40" y="70" width="180" height="12" rx="4" fill="#475569" class="dark:fill-[#334155]"/>
                <rect x="60" y="95" width="260" height="12" rx="4" fill="#475569" class="dark:fill-[#334155]"/>
                
                <rect x="420" y="40" width="340" height="200" rx="12" fill="#e2e8f0" class="dark:fill-[#1E293B]" stroke="#94a3b8" class="dark:stroke-[#334155]" stroke-width="2"/>
                <circle cx="590" cy="140" r="40" fill="#1a73e8" fill-opacity="0.2" stroke="#1a73e8" stroke-width="3"/>
                <rect x="460" y="70" width="80" height="15" rx="4" fill="#1a73e8"/>
                <path d="M0 225H800M400 0V450" stroke="#94a3b8" stroke-opacity="0.2"/>
              </svg>

              <!-- Remote cursor marker -->
              <div id="cursor-indicator" class="${this.cursorVisible ? '' : 'hidden'} absolute bg-[#1a73e8] border border-blue-400 px-2 py-1 rounded-md text-[10px] text-white flex items-center gap-1.5 shadow-lg select-none pointer-events-none" style="top: ${this.cursorY}%; left: ${this.cursorX}%;">
                <i data-lucide="pointer" class="w-3.5 h-3.5 text-white"></i> 제어자 커서 (조종 중)
              </div>

              <!-- Annotation overlays -->
              <div id="annotation-mock" class="${this.annotationVisible ? '' : 'hidden'} absolute inset-0 bg-transparent pointer-events-none">
                <svg class="w-full h-full text-amber-500" viewBox="0 0 800 450" fill="none">
                  <path d="M 550 140 C 530 80, 650 60, 600 150" stroke="#F59E0B" stroke-width="4" stroke-linecap="round" fill="none"/>
                  <text x="500" y="220" fill="#D97706" class="dark:fill-[#F59E0B]" font-size="14" font-weight="bold">이 구 영역 레이아웃 확인 필요!</text>
                </svg>
              </div>

              <!-- VoIP audio active waves -->
              <div id="voice-wave-container" class="${!this.localMuted ? '' : 'hidden'} absolute top-4 left-4 bg-slate-950/80 border border-blue-500/30 px-3 py-2 rounded-lg flex items-center gap-3">
                <div class="flex items-end gap-1 h-6">
                  <div class="audio-wave-bar w-1 bg-[#1a73e8]" style="animation-delay: 0.1s"></div>
                  <div class="audio-wave-bar w-1 bg-[#1a73e8]" style="animation-delay: 0.4s"></div>
                  <div class="audio-wave-bar w-1 bg-[#1a73e8]" style="animation-delay: 0.2s"></div>
                  <div class="audio-wave-bar w-1 bg-[#1a73e8]" style="animation-delay: 0.6s"></div>
                  <div class="audio-wave-bar w-1 bg-[#1a73e8]" style="animation-delay: 0.3s"></div>
                </div>
                <span class="text-xs text-[#1a73e8] font-bold tracking-tight">LAN 보이스 음성 연결됨</span>
              </div>

              <div class="relative text-center p-8 z-10">
                <div class="inline-flex p-3 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 mb-3 group-hover:scale-105 transition-all shadow-md">
                  <i data-lucide="play-circle" class="w-10 h-10 text-[#1a73e8]"></i>
                </div>
                <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200">실시간 화면 캡처 수신 완료</h4>
                <p class="text-xs text-slate-500 mt-1">로컬 미디어 파이프가 WebRTC 오디오·비디오를 연동 중</p>
              </div>
            </div>

            <!-- Mute, click, draw buttons -->
            <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <span class="text-xs text-slate-500">지연율: <strong class="text-emerald-600 font-mono">1.2ms (LAN 다이렉트)</strong></span>
              <div class="flex items-center gap-2">
                <button id="btn-audio-toggle" @click=${this.onToggleMute} class="text-xs ${this.localMuted ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'} border hover:bg-opacity-20 px-3 py-2 rounded-lg font-bold transition flex items-center gap-1.5">
                  <i data-lucide="mic" class="w-3.5 h-3.5"></i> ${this.localMuted ? '마이크 음소거 해제' : '마이크 끄기'}
                </button>
                <button @click=${this.onSimulateClick} id="btn-action-control" class="${isChulsoo ? '' : 'hidden'} text-xs bg-[#1a73e8]/10 border border-[#1a73e8]/20 text-[#1a73e8] hover:bg-[#1a73e8] hover:text-white px-3 py-2 rounded-lg font-bold transition">
                  <i data-lucide="mouse-pointer-click" class="inline w-3.5 h-3.5 mr-1"></i> 가상 원격 클릭
                </button>
                <button @click=${this.onToggleDraw} id="btn-action-draw" class="${isChulsoo ? '' : 'hidden'} text-xs bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white px-3 py-2 rounded-lg font-bold transition">
                  <i data-lucide="pencil" class="inline w-3.5 h-3.5 mr-1"></i> 펜 피드백 토글
                </button>
              </div>
            </div>
          </div>

          <!-- Space for chat sidebar placeholder in main grid -->
          <slot></slot>
        </div>
      </div>
    `;
  }

  private onToggleMute() {
    this.dispatchEvent(new CustomEvent('toggle-mute', { bubbles: true, composed: true }));
  }

  private onSimulateClick() {
    this.dispatchEvent(new CustomEvent('simulate-click', { bubbles: true, composed: true }));
  }

  private onToggleDraw() {
    this.dispatchEvent(new CustomEvent('toggle-draw', { bubbles: true, composed: true }));
  }

  private onLeaveSession() {
    this.dispatchEvent(new CustomEvent('leave-session', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'll-viewer': LlViewer;
  }
}
