import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("ll-viewer")
export class LlViewer extends LitElement {
  @state() private isFullScreen = false;
  @state() private chatCollapsed = false;

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
    if (!this.isFullScreen) {
      this.chatCollapsed = false;
    }
  };

  firstUpdated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);

    // Safely assign srcObject to the video element to prevent flickering on other state updates
    const videoEl = this.querySelector("video") as HTMLVideoElement | null;
    if (videoEl && videoEl.srcObject !== this.stream) {
      videoEl.srcObject = this.stream;
    }

    if (
      changedProperties.has("localMuted") ||
      changedProperties.has("isFullScreen") ||
      changedProperties.has("speakerMuted") ||
      changedProperties.has("chatCollapsed")
    ) {
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
  @property({ type: Boolean }) speakerMuted = false;
  @property({ type: Number }) speakerVolume = 100;
  @property({ type: Array }) chatMessages: Array<{ sender: string; content: string; system?: boolean }> = [];
  @property({ type: Number }) viewerCount = 0;
  @property({ type: Array }) participants: string[] = [];
  @property({ type: String }) myNickname = "참여자";

  @property({ attribute: false }) stream: MediaStream | null = null;

  render() {
    return html`
      <div
        id="active-viewer-container"
        class="animate-in zoom-in-95 mx-auto w-full max-w-7xl space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl duration-200 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center dark:border-slate-800"
        >
          <div class="flex items-center gap-2">
            <span class="flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500"></span>
            <h3 class="text-xs leading-snug font-bold text-slate-800 sm:text-sm dark:text-white">
              <span id="target-host-name">${this.activeRoomName}</span>님의 화면을 공유하고 있습니다.
              <span class="block text-[10px] text-slate-500 sm:inline sm:text-xs dark:text-slate-400"
                >(${this.activeRoomIp})</span
              >
            </h3>
          </div>
          <div class="flex w-full items-center justify-end gap-2 text-xs sm:w-auto">
            <button
              @click=${this.onLeaveSession}
              class="shrink-0 text-xs font-semibold text-rose-600 transition hover:text-rose-400 sm:text-sm"
            >
              연결 끊기
            </button>
          </div>
        </div>

        <div
          id="fullscreen-wrapper"
          class="${this.isFullScreen
            ? "fixed inset-0 z-50 h-screen w-screen bg-slate-950 flex items-center overflow-hidden animate-in fade-in duration-200"
            : "grid grid-cols-1 gap-4 xl:grid-cols-12"}"
        >
          <!-- Left: 16:9 Screen Capturer Screen (8/12) -->
          <div
            class="${this.isFullScreen
              ? `relative h-full transition-all duration-300 ${this.chatCollapsed ? "w-full" : "w-[calc(100%-26rem)]"}`
              : "flex flex-col space-y-4 xl:col-span-8"}"
          >
            <div
              id="video-wrapper"
              class="dark:bg-slate-955 group ${this.isFullScreen
                ? "h-full w-full aspect-none"
                : "rounded-2xl border border-slate-200 dark:border-slate-800 aspect-video"} relative flex w-full items-center justify-center overflow-hidden bg-slate-900"
            >
              <!-- Video Stream player (Shows when stream is available) -->
              ${this.stream
                ? html`
                    <video
                      class="absolute inset-0 z-0 h-full w-full object-contain"
                      autoplay
                      playsinline
                      ?muted=${this.speakerMuted}
                      .volume=${this.speakerMuted ? 0 : this.speakerVolume / 100}
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
                class="pointer-events-auto absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 translate-y-0 items-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/85 p-2 opacity-100 shadow-lg backdrop-blur transition-all duration-300 md:pointer-events-none md:translate-y-20 md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100"
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

                <!-- Speaker Mute / Unmute and Volume Slider -->
                <div
                  class="group/vol flex items-center rounded-xl border border-slate-700/50 bg-slate-800/40 transition-all duration-300 hover:bg-slate-800/80"
                >
                  <button
                    id="btn-speaker-toggle"
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
                      @input=${this.onSpeakerVolumeInput}
                      class="accent-google-blue h-1 w-14 cursor-pointer appearance-none rounded-lg bg-slate-700 focus:outline-none"
                      title="스피커 볼륨 조절"
                    />
                    <span class="w-5 text-right font-mono text-[9px] text-slate-400">${this.speakerVolume}%</span>
                  </div>
                </div>

                <!-- Divider line -->
                <div class="mx-0.5 h-5 w-px bg-slate-700/50"></div>

                <!-- Chat Collapse Toggle (Only visible in fullscreen) -->
                ${this.isFullScreen
                  ? html`
                      <button
                        @click=${this.toggleChatCollapse}
                        class="${this.chatCollapsed
                          ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"} flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-colors"
                        title="${this.chatCollapsed ? "채팅창 열기" : "채팅창 접기"}"
                      >
                        <i data-lucide="messages-square" class="h-5 w-5"></i>
                      </button>
                    `
                  : ""}

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
            id="viewer-chat-element"
            .isFullScreen=${this.isFullScreen}
            .chatMessages=${this.chatMessages}
            .viewerCount=${this.viewerCount}
            .participants=${this.participants}
            .myNickname=${this.myNickname}
            @send-message=${this.onForwardSendMessage}
            class="${this.isFullScreen
              ? `absolute right-6 top-6 bottom-6 z-20 w-96 h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] overflow-hidden rounded-3xl shadow-2xl transition-all duration-300 ${this.chatCollapsed ? "opacity-0 pointer-events-none translate-x-16" : "opacity-100"}`
              : "block w-full xl:col-span-4"}"
          ></ll-chat>
        </div>
      </div>
    `;
  }

  private toggleFullScreen() {
    const wrapper = this.querySelector("#fullscreen-wrapper");
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable full-screen mode:", err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  private toggleChatCollapse() {
    this.chatCollapsed = !this.chatCollapsed;
  }

  private toggleSpeakerMute() {
    this.dispatchEvent(
      new CustomEvent("toggle-speaker", {
        bubbles: true,
        composed: true,
      })
    );
  }

  private onToggleMute() {
    this.dispatchEvent(new CustomEvent("toggle-mute", { bubbles: true, composed: true }));
  }

  private onLeaveSession() {
    this.dispatchEvent(new CustomEvent("leave-session", { bubbles: true, composed: true }));
  }

  private onForwardSendMessage(e: CustomEvent<{ text: string }>) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("send-message", { detail: e.detail, bubbles: true, composed: true }));
  }

  private onSpeakerVolumeInput(e: InputEvent) {
    const val = parseInt((e.target as HTMLInputElement).value);
    this.speakerVolume = val;
    this.dispatchEvent(
      new CustomEvent("change-speaker-volume", {
        detail: { volume: val },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-viewer": LlViewer;
  }
}
