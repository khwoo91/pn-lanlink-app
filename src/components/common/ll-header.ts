import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("ll-header")
export class LlHeader extends LitElement {
  updated() {
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

  render() {
    return html`
      <header
        class="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200"
      >
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <!-- Logo -->
          <div @click=${this.onLogoClick} class="flex items-center space-x-3 cursor-pointer select-none">
            <div class="w-9 h-9 rounded-lg bg-google-blue flex items-center justify-center shadow-md">
              <i data-lucide="zap" class="w-5 h-5 text-white"></i>
            </div>
            <div class="flex items-baseline space-x-2">
              <span class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">LANLink</span>
              <span
                class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 text-[9px] font-bold"
                >v1.1.8</span
              >
              <span class="text-[11px] text-slate-500 font-medium hidden sm:inline">사내망 다이렉트 제어</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-2 md:space-x-3">
            <!-- Nickname -->
            <div
              class="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs transition-colors"
            >
              <div class="w-4 h-4 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center">
                <i data-lucide="user" class="w-3.5 h-3.5"></i>
              </div>
              <span class="text-slate-500 dark:text-slate-400 hidden sm:inline">내 닉네임:</span>
              <strong class="text-slate-800 dark:text-slate-200 font-bold max-w-20 truncate">${this.currentNickname}</strong>
              <button @click=${this.onEditNickname} class="text-slate-400 hover:text-google-blue p-0.5 rounded transition" title="닉네임 수정">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- Theme Toggles -->
            <div class="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center border border-slate-200 dark:border-slate-700">
              <button
                @click=${() => this.onThemeChange("light")}
                class="p-1.5 rounded-md transition ${this.currentTheme === "light"
                  ? "bg-white dark:bg-slate-950 text-google-blue shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}"
                title="밝은 테마"
              >
                <i data-lucide="sun" class="w-3.5 h-3.5"></i>
              </button>
              <button
                @click=${() => this.onThemeChange("dark")}
                class="p-1.5 rounded-md transition ${this.currentTheme === "dark"
                  ? "bg-white dark:bg-slate-950 text-google-blue shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}"
                title="어두운 테마"
              >
                <i data-lucide="moon" class="w-3.5 h-3.5"></i>
              </button>
              <button
                @click=${() => this.onThemeChange("system")}
                class="p-1.5 rounded-md transition ${this.currentTheme === "system"
                  ? "bg-white dark:bg-slate-950 text-google-blue shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"}"
                title="시스템 테마 연동"
              >
                <i data-lucide="monitor" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- LAN state -->
            <div
              class="hidden md:flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 transition-colors text-[11px]"
            >
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span class="text-slate-600 dark:text-slate-300 font-medium">${window.location.hostname}</span>
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
      }),
    );
  }

  private onOpenPro() {
    this.dispatchEvent(new CustomEvent("open-pro", { bubbles: true, composed: true }));
  }

  private onLogoClick() {
    this.dispatchEvent(new CustomEvent("logo-click", { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-header": LlHeader;
  }
}
