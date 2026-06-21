import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createIcons, ShieldAlert } from 'lucide';

@customElement('modal-saver')
export class ModalSaver extends LitElement {
  updated() {
    createIcons({
      icons: {
        ShieldAlert
      },
      root: this
    });
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) open = false;
  @property({ type: Number }) countdown = 60;

  render() {
    return html`
      <div id="idle-safeguard-overlay" class="${this.open ? '' : 'hidden'} fixed bottom-6 left-6 z-50 max-w-md w-full bg-amber-50 dark:bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div class="flex items-start gap-3">
          <div class="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
            <i data-lucide="shield-alert" class="w-6 h-6 animate-pulse"></i>
          </div>
          <div class="grow space-y-1 text-left">
            <h4 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              대역폭 보호 세이버 작동 예정 🚦
            </h4>
            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              최근 30분간 참여한 팀원이 감지되지 않았습니다. 대역폭 및 PC 배터리 자원 방지를 위해 <strong id="idle-timer-text" class="text-rose-500 font-mono text-sm">${this.countdown}</strong>초 후 공유방을 자동으로 완전 폭파합니다.
            </p>
            <div class="flex gap-2 pt-3">
              <button @click=${this.onKeepSession} class="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black px-3.5 py-1.5 rounded-lg transition shadow-md">
                공유 계속 유지하기
              </button>
              <button @click=${this.onStopSession} class="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-3.5 py-1.5 rounded-lg hover:bg-slate-300 transition">
                지금 방송 끄기
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private onKeepSession() {
    this.dispatchEvent(new CustomEvent('keep-session', { bubbles: true, composed: true }));
  }

  private onStopSession() {
    this.dispatchEvent(new CustomEvent('stop-session', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'modal-saver': ModalSaver;
  }
}
