import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("ll-viewer")
export class LlViewer extends LitElement {
  @state() private isFullScreen = false;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("fullscreenchange", this.onFullScreenChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("fullscreenchange", this.onFullScreenChange);
  }

  private onFullScreenChange = () => {
    this.isFullScreen = !!document.fullscreenElement;
  };

  firstUpdated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has("localMuted") || changedProperties.has("isFullScreen")) {
      createIcons({
        icons: globalIcons,
        root: this,
      });
    }
  }

  createRenderRoot() {
    return this;
  }

  @property({ type: String }) activeRoomName = "";
  @property({ type: String }) activeRoomIp = "";
  @property({ type: Boolean }) localMuted = true;
  @property({ type: Boolean }) annotationVisible = false;
  @property({ type: Boolean }) cursorVisible = false;
  @property({ type: Number }) cursorX = 33;
  @property({ type: Number }) cursorY = 50;
  @property({ type: Array }) chatMessages: Array<{ sender: string; content: string; system?: boolean }> = [];
  @property({ type: Number }) viewerCount = 0;
  @property({ type: Array }) participants: string[] = [];
  @property({ type: String }) myNickname = "참여자";

  @property({ attribute: false }) stream: MediaStream | null = null;

  render() {
    const isChulsoo = this.activeRoomName.includes("김철수");

    return html`
      <div
        id="active-viewer-container"
        class="animate-in zoom-in-95 mx-auto w-full max-w-7xl space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl duration-200 dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center dark:border-slate-800"
        >
          <div class="flex items-center gap-2">
            <span class="flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500"></span>
            <h3 class="text-xs leading-snug font-bold text-slate-800 sm:text-sm dark:text-white">
              <span id="target-host-name">${this.activeRoomName}</span> 님의 로컬 영상 및 음성 수신 중
              <span class="block text-[10px] text-slate-500 sm:inline sm:text-xs dark:text-slate-400"
                >(${this.activeRoomIp})</span
              >
            </h3>
          </div>
          <div class="flex w-full items-center justify-between gap-2 text-xs sm:w-auto sm:justify-end">
            <div class="flex items-center gap-1">
              <span
                id="badge-control"
                class="${isChulsoo
                  ? ""
                  : "hidden"} bg-google-blue/10 text-google-blue border-google-blue/20 rounded border px-2 py-0.5 text-[10px] font-semibold sm:text-xs"
              >
                <i data-lucide="mouse-pointer" class="mr-0.5 inline h-3 w-3"></i> 제어
              </span>
              <span
                id="badge-draw"
                class="${isChulsoo
                  ? ""
                  : "hidden"} rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 sm:text-xs"
              >
                <i data-lucide="pen-tool" class="mr-0.5 inline h-3 w-3"></i> 필기
              </span>
            </div>
            <button
              @click=${this.onLeaveSession}
              class="shrink-0 text-xs font-semibold text-rose-600 transition hover:text-rose-400 sm:text-sm"
            >
              연결 끊기
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <!-- Left: 16:9 Screen Capturer Screen (8/12) -->
          <div class="flex flex-col space-y-4 xl:col-span-8">
            <div
              id="video-wrapper"
              class="dark:bg-slate-955 group ${this.isFullScreen
                ? ""
                : "rounded-2xl border border-slate-200 dark:border-slate-800"} relative flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-900"
            >
              <!-- Video Stream player (Shows when stream is available) -->
              ${this.stream
                ? html`
                    <video
                      class="absolute inset-0 z-0 h-full w-full object-contain"
                      .srcObject=${this.stream}
                      autoplay
                      playsinline
                    ></video>
                  `
                : html`
                    <!-- Pulsing grey skeleton overlay when connecting -->
                    <div class="absolute inset-0 z-0 flex flex-col justify-between">
                      <!-- Nice Connecting / Loading text in the center -->
                      <div class="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center">
                        <div
                          class="mb-3 inline-flex animate-spin rounded-full border border-slate-200/20 bg-white/10 p-3 dark:bg-slate-900/10"
                        >
                          <i data-lucide="loader" class="text-google-blue h-8 w-8"></i>
                        </div>
                        <h4 class="text-sm font-semibold text-slate-300">화면 연결 중...</h4>
                      </div>
                    </div>
                  `}

              <!-- Remote cursor marker -->
              <div
                id="cursor-indicator"
                class="${this.cursorVisible
                  ? ""
                  : "hidden"} bg-google-blue pointer-events-none absolute z-20 flex items-center gap-1.5 rounded-md border border-blue-400 px-2 py-1 text-xs text-white shadow-lg select-none"
                style="top: ${this.cursorY}%; left: ${this.cursorX}%;"
              >
                <i data-lucide="pointer" class="h-3.5 w-3.5 text-white"></i> 제어자 커서 (조종 중)
              </div>

              <!-- Latency Badge overlay -->
              <div
                class="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-400 shadow-sm backdrop-blur"
              >
                <span class="relative flex h-1.5 w-1.5">
                  <span
                    class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
                  ></span>
                  <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                </span>
                <span>지연율: 1.2ms</span>
              </div>

              <!-- VoIP audio active waves -->
              <div
                id="voice-wave-container"
                class="${!this.localMuted
                  ? ""
                  : "hidden"} absolute top-3 right-3 z-20 flex items-center gap-3 rounded-lg border border-blue-500/30 bg-slate-950/80 px-3 py-2"
              >
                <div class="flex h-6 items-end gap-1">
                  <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.1s"></div>
                  <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.4s"></div>
                  <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.2s"></div>
                  <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.6s"></div>
                  <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.3s"></div>
                </div>
              </div>

              <!-- Floating control overlay bar -->
              <div
                class="pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 translate-y-20 items-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/85 p-2 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
              >
                <!-- Mute / Unmute -->
                <button
                  id="btn-audio-toggle"
                  @click=${this.onToggleMute}
                  class="${this.localMuted
                    ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"} flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-colors"
                  title="${this.localMuted ? "마이크 켜기" : "마이크 끄기"}"
                >
                  ${this.localMuted
                    ? html`<i data-lucide="mic-off" class="h-5 w-5"></i>`
                    : html`<i data-lucide="mic" class="h-5 w-5"></i>`}
                </button>

                <!-- Virtual Remote Click -->
                ${isChulsoo
                  ? html`
                      <button
                        @click=${this.onSimulateClick}
                        class="text-google-blue flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/80 transition-colors hover:bg-slate-700"
                        title="가상 원격 클릭"
                      >
                        <i data-lucide="mouse-pointer-click" class="h-5 w-5"></i>
                      </button>
                    `
                  : ""}

                <!-- Pen Feedback Toggle -->
                ${isChulsoo
                  ? html`
                      <button
                        @click=${this.onToggleDraw}
                        class="${this.annotationVisible
                          ? "border-amber-500/30 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                          : "border-slate-700/50 bg-slate-800/80 text-amber-500 hover:bg-slate-700"} flex h-10 w-10 items-center justify-center rounded-xl border transition-colors"
                        title="펜 피드백 토글"
                      >
                        <i data-lucide="pencil" class="h-5 w-5"></i>
                      </button>
                    `
                  : ""}

                <!-- Divider line -->
                <div class="mx-0.5 h-5 w-px bg-slate-700/50"></div>

                <!-- Fullscreen Toggle -->
                <button
                  @click=${this.toggleFullScreen}
                  class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700"
                  title="${this.isFullScreen ? "화면 축소" : "전체화면"}"
                >
                  ${this.isFullScreen
                    ? html`<i data-lucide="minimize" class="h-5 w-5"></i>`
                    : html`<i data-lucide="maximize" class="h-5 w-5"></i>`}
                </button>
              </div>
            </div>
          </div>

          <!-- Render chat sidebar directly to support Light DOM layout -->
          <ll-chat
            .chatMessages=${this.chatMessages}
            .viewerCount=${this.viewerCount}
            .participants=${this.participants}
            .myNickname=${this.myNickname}
            @send-message=${this.onForwardSendMessage}
            class="block w-full xl:col-span-4"
          ></ll-chat>
        </div>
      </div>
    `;
  }

  private toggleFullScreen() {
    const wrapper = this.querySelector("#video-wrapper");
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable full-screen mode:", err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  private onToggleMute() {
    this.dispatchEvent(new CustomEvent("toggle-mute", { bubbles: true, composed: true }));
  }

  private onSimulateClick() {
    this.dispatchEvent(new CustomEvent("simulate-click", { bubbles: true, composed: true }));
  }

  private onToggleDraw() {
    this.dispatchEvent(new CustomEvent("toggle-draw", { bubbles: true, composed: true }));
  }

  private onLeaveSession() {
    this.dispatchEvent(new CustomEvent("leave-session", { bubbles: true, composed: true }));
  }

  private onForwardSendMessage(e: CustomEvent<{ text: string }>) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("send-message", { detail: e.detail, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-viewer": LlViewer;
  }
}
