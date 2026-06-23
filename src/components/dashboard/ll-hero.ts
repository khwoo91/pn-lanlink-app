import { LitElement, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("ll-hero")
export class LlHero extends LitElement {
  updated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) hostSetupOpen = false;
  @property({ type: Boolean }) isRoomLocked = false;
  @property({ type: String }) hostPassword = "";

  @query("#join-code-input") private joinCodeInputElement?: HTMLInputElement;
  @query("#host-password-input") private hostPasswordInputElement?: HTMLInputElement;

  render() {
    return html`
      <div class="space-y-8">
        <div class="space-y-4 text-center">
          <h1 class="text-4xl leading-[1.15] font-extrabold tracking-tight text-slate-900 md:text-5xl dark:text-white">
            안전하고 자유로운 <br />
            <span class="text-google-blue">초고속 화면 공유</span> 서비스
          </h1>
          <p class="text-md mx-auto max-w-lg leading-relaxed text-slate-500 md:text-lg dark:text-slate-400">
            <i class="text-google-blue text-xl font-bold dark:text-blue-400">LAN</i>을 통해 딜레이 없는<br />초고속 화면
            공유를 경험해 보세요.
          </p>
        </div>

        <div class="space-y-4">
          <div
            class="mx-auto flex w-full max-w-xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          >
            <!-- Open host room setup -->
            <button
              @click=${this.onToggleHostSetupDrawer}
              class="bg-google-blue hover:bg-google-blueHover flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors"
            >
              <i data-lucide="video" class="h-4 w-4 fill-white"></i> 새 공유방 개설
            </button>

            <!-- Code input -->
            <div class="relative flex w-full grow items-center">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <i data-lucide="keyboard" class="h-4 w-4"></i>
              </div>
              <input
                type="text"
                id="join-code-input"
                placeholder="방 번호(예: 15) 또는 링크 입력"
                class="focus:border-google-blue dark:focus:border-google-blue focus:ring-google-blue w-full rounded-lg border border-slate-300 bg-white py-3 pr-12 pl-9 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:ring-1 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <!-- Join room button -->
              <button
                @click=${this.onJoinRoom}
                class="bg-google-blue hover:bg-google-blueHover absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white shadow-sm transition"
                title="참여"
              >
                <i data-lucide="arrow-right" class="h-4 w-4"></i>
              </button>
            </div>
          </div>

          <!-- Drawer panel -->
          <div
            id="host-setup-drawer"
            class="${this.hostSetupOpen
              ? ""
              : "hidden"} animate-in slide-in-from-top-4 mx-auto w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 duration-200 dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
              <h3 class="text-xs font-bold tracking-wider text-slate-500 uppercase">공유방 설정</h3>
              <button
                @click=${this.onToggleHostSetupDrawer}
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <i data-lucide="x" class="h-4 w-4"></i>
              </button>
            </div>

            <div class="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <!-- Toggle switch for password protection -->
              <label
                class="hover:border-google-blue flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition dark:border-slate-800 dark:bg-slate-950"
              >
                <div class="flex items-center gap-2.5">
                  <i data-lucide="lock" class="text-google-blue h-4 w-4"></i>
                  <div class="flex flex-col text-left">
                    <span class="font-bold text-slate-900 dark:text-white">비밀번호 잠금 설정</span>
                    <span class="text-[10px] text-slate-400">설정된 비밀번호를 아는 사람만 참여를 허용합니다.</span>
                  </div>
                </div>
                <div class="relative flex items-center">
                  <input
                    type="checkbox"
                    id="toggle-lock"
                    @change=${this.onToggleLock}
                    class="peer sr-only"
                    ?checked=${this.isRoomLocked}
                  />
                  <div
                    class="peer-checked:bg-google-blue relative h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:after:translate-x-4 dark:bg-slate-800"
                  ></div>
                </div>
              </label>
            </div>

            <!-- Password configuration -->
            <div
              id="password-setup-container"
              class="${this.isRoomLocked ? "" : "hidden"} animate-in fade-in-50 space-y-1.5 duration-200"
            >
              <span class="ml-1 text-[11px] font-bold text-slate-500">설정할 비밀번호</span>
              <input
                type="password"
                id="host-password-input"
                .value=${this.hostPassword}
                @input=${(e: Event) => {
                  this.hostPassword = (e.target as HTMLInputElement).value;
                }}
                placeholder="비밀번호 입력"
                class="focus:border-google-blue w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm placeholder:text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <button
              @click=${this.onStartSharing}
              class="bg-google-blue hover:bg-google-blueHover w-full rounded-xl py-3 text-xs font-bold text-white transition-colors"
            >
              화면 공유 시작
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private onToggleHostSetupDrawer() {
    this.dispatchEvent(new CustomEvent("toggle-drawer", { bubbles: true, composed: true }));
  }

  private onToggleLock(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new CustomEvent("toggle-lock", { detail: { checked }, bubbles: true, composed: true }));
  }

  private onStartSharing() {
    const password = this.hostPasswordInputElement ? this.hostPasswordInputElement.value : "";
    this.dispatchEvent(new CustomEvent("start-sharing", { detail: { password }, bubbles: true, composed: true }));
  }

  private onJoinRoom() {
    const code = this.joinCodeInputElement ? this.joinCodeInputElement.value.trim() : "";
    this.dispatchEvent(new CustomEvent("join-room", { detail: { code }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-hero": LlHero;
  }
}
