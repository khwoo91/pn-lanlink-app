import { LitElement, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('modal-password')
export class ModalPassword extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) open = false;

  @query('#input-verify-password') private inputVerifyPasswordElement?: HTMLInputElement;

  render() {
    return html`
      <div id="password-verify-modal" class="${this.open ? '' : 'hidden'} fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border-2 border-indigo-500/30 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
          <div class="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-google-blue rounded-full flex items-center justify-center mx-auto mb-3">
            <i data-lucide="shield-alert" class="w-6 h-6"></i>
          </div>
          <h3 class="text-md font-bold text-slate-800 dark:text-white">보안 세션 입장 확인</h3>
          <p class="text-xs text-slate-500 mt-1">
            호스트가 보안 자산을 보호하기 위해 암호를 적용했습니다.<br>지정된 비밀번호를 입력해주세요.
          </p>

          <div class="my-4">
            <input type="password" id="input-verify-password" placeholder="비밀번호 4자리 입력" class="w-full text-center py-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-google-blue focus:outline-none font-mono text-sm tracking-widest text-slate-800 dark:text-white">
          </div>

          <div class="flex gap-2">
            <button @click=${this.onClose} class="flex-grow bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition">
              취소
            </button>
            <button @click=${this.onSubmit} class="flex-grow bg-google-blue hover:bg-google-blueHover text-white font-bold py-2.5 rounded-xl text-xs transition">
              인증 및 접속
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private onClose() {
    this.dispatchEvent(new CustomEvent('close-modal', { bubbles: true, composed: true }));
  }

  private onSubmit() {
    const password = this.inputVerifyPasswordElement ? this.inputVerifyPasswordElement.value : '';
    this.dispatchEvent(new CustomEvent('submit-verify-password', { detail: { password }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'modal-password': ModalPassword;
  }
}
