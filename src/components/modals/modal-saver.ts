import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("modal-saver")
export class ModalSaver extends LitElement {
  updated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) open = false;
  @property({ type: Number }) countdown = 60;

  render() {
    return html`
      <div
        id="idle-safeguard-overlay"
        class="${this.open
          ? ""
          : "hidden"} animate-in slide-in-from-bottom fixed bottom-6 left-6 z-50 w-full max-w-md rounded-2xl border-2 border-amber-500/40 bg-amber-50 p-5 shadow-2xl duration-300 dark:bg-slate-900"
      >
        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
            <i data-lucide="shield-alert" class="h-6 w-6 animate-pulse"></i>
          </div>
          <div class="grow space-y-1 text-left">
            <h4 class="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
              대역폭 보호 세이버 작동 예정 🚦
            </h4>
            <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              최근 30분간 참여한 팀원이 감지되지 않았습니다. 대역폭 및 PC 배터리 자원 방지를 위해
              <strong id="idle-timer-text" class="font-mono text-sm text-rose-500">${this.countdown}</strong>초 후
              공유방을 자동으로 완전 폭파합니다.
            </p>
            <div class="flex gap-2 pt-3">
              <button
                @click=${this.onKeepSession}
                class="rounded-lg bg-amber-500 px-3.5 py-1.5 text-[11px] font-black text-slate-950 shadow-md transition hover:bg-amber-600"
              >
                공유 계속 유지하기
              </button>
              <button
                @click=${this.onStopSession}
                class="rounded-lg bg-slate-200 px-3.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
              >
                지금 방송 끄기
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private onKeepSession() {
    this.dispatchEvent(new CustomEvent("keep-session", { bubbles: true, composed: true }));
  }

  private onStopSession() {
    this.dispatchEvent(new CustomEvent("stop-session", { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "modal-saver": ModalSaver;
  }
}
