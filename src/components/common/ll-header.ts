import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("ll-header")
export class LlHeader extends LitElement {
  @state() private themeDropdownOpen = false;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this.handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this.handleOutsideClick);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (!this.themeDropdownOpen) return;
    const dropdown = this.querySelector(".theme-dropdown-container");
    if (dropdown && !dropdown.contains(e.target as Node)) {
      this.themeDropdownOpen = false;
    }
  };

  firstUpdated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: String }) currentNickname = "참여자";
  @property({ type: String }) currentTheme = "light";
  @property({ type: Boolean }) isSignalingConnected = false;

  render() {
    return html`
      <header
        class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/90"
      >
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <!-- Logo -->
          <div @click=${this.onLogoClick} class="flex cursor-pointer items-center space-x-3 select-none">
            <div class="bg-google-blue flex h-9 w-9 items-center justify-center rounded-lg shadow-md">
              <i data-lucide="zap" class="h-5 w-5 text-white"></i>
            </div>
            <div class="flex items-baseline space-x-2">
              <span class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">LANLink</span>
              <span
                class="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                >v1.2.3</span
              >
              <span class="hidden text-[11px] font-medium text-slate-500 sm:inline">다이렉트 화면공유 및 제어</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-2 md:space-x-3">
            <!-- LAN state -->
            <div class="flex items-center space-x-1.5 text-[13px] transition-colors shrink-0">
              <span class="relative flex h-2 w-2">
                ${this.isSignalingConnected
                  ? html`
                      <span
                        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
                      ></span>
                      <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    `
                  : html` <span class="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span> `}
              </span>
              <span
                class="${this.isSignalingConnected
                  ? "text-slate-600 dark:text-slate-300"
                  : "text-rose-500 dark:text-rose-400"} font-medium whitespace-nowrap"
              >
                ${this.isSignalingConnected ? "연결중" : "연결 실패"}
              </span>
            </div>

            <!-- Custom Theme Dropdown Select Option -->
            <div class="theme-dropdown-container relative">
              <button
                @click=${this.toggleThemeDropdown}
                class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1.5 text-xs font-semibold text-slate-700 transition select-none hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ${this.currentTheme === "light" ? html`<i data-lucide="sun" class="h-4.5 w-4.5"></i>` : ""}
                ${this.currentTheme === "dark" ? html`<i data-lucide="moon" class="h-4.5 w-4.5"></i>` : ""}
                ${this.currentTheme === "system" ? html`<i data-lucide="monitor" class="h-4.5 w-4.5"></i>` : ""}
              </button>

              <div
                class="${this.themeDropdownOpen
                  ? ""
                  : "hidden"} absolute right-0 mt-1.5 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
              >
                <button
                  @click=${() => this.selectTheme("light")}
                  class="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span class="flex items-center gap-2"><i data-lucide="sun" class="h-3.5 w-3.5"></i> 라이트</span>
                  ${this.currentTheme === "light"
                    ? html`<i data-lucide="check" class="text-google-blue h-3 w-3"></i>`
                    : ""}
                </button>
                <button
                  @click=${() => this.selectTheme("dark")}
                  class="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span class="flex items-center gap-2"><i data-lucide="moon" class="h-3.5 w-3.5"></i> 다크</span>
                  ${this.currentTheme === "dark"
                    ? html`<i data-lucide="check" class="text-google-blue h-3 w-3"></i>`
                    : ""}
                </button>
                <button
                  @click=${() => this.selectTheme("system")}
                  class="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span class="flex items-center gap-2"><i data-lucide="monitor" class="h-3.5 w-3.5"></i> 시스템</span>
                  ${this.currentTheme === "system"
                    ? html`<i data-lucide="check" class="text-google-blue h-3 w-3"></i>`
                    : ""}
                </button>
              </div>
            </div>

            <!-- Nickname -->
            <div
              class="flex items-center space-x-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs transition-colors dark:border-slate-700 dark:bg-slate-800 shrink-0"
            >
              <div class="bg-google-blue/10 text-google-blue flex h-4 w-4 items-center justify-center rounded-full">
                <i data-lucide="user" class="h-3.5 w-3.5"></i>
              </div>
              <span class="hidden text-slate-500 sm:inline dark:text-slate-400">닉네임:</span>
              <strong class="max-w-20 truncate font-bold text-slate-800 dark:text-slate-200"
                >${this.currentNickname}</strong
              >
              <button
                @click=${this.onEditNickname}
                class="hover:text-google-blue rounded p-0.5 text-slate-400 transition"
                title="닉네임 수정"
              >
                <i data-lucide="pencil" class="h-3.5 w-3.5"></i>
              </button>
            </div>

            <!-- PRO plan badge/button -->
            <!-- <button @click=${this
              .onOpenPro} class="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">
              <i data-lucide="crown" class="w-3 h-3 fill-slate-950"></i> PRO
            </button> -->
          </div>
        </div>
      </header>
    `;
  }

  private onEditNickname() {
    this.dispatchEvent(new CustomEvent("edit-nickname", { bubbles: true, composed: true }));
  }

  private onThemeChange(theme: string) {
    this.dispatchEvent(
      new CustomEvent("change-theme", {
        detail: { theme },
        bubbles: true,
        composed: true,
      })
    );
  }

  private onOpenPro() {
    this.dispatchEvent(new CustomEvent("open-pro", { bubbles: true, composed: true }));
  }

  private onLogoClick() {
    this.dispatchEvent(new CustomEvent("logo-click", { bubbles: true, composed: true }));
  }

  private toggleThemeDropdown(e: Event) {
    e.stopPropagation();
    this.themeDropdownOpen = !this.themeDropdownOpen;
  }

  private selectTheme(theme: string) {
    this.themeDropdownOpen = false;
    this.onThemeChange(theme);
    // Re-create icons inside dropdown
    setTimeout(() => {
      createIcons({
        icons: globalIcons,
        root: this,
      });
    }, 0);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-header": LlHeader;
  }
}
