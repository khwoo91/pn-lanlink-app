import { LitElement, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("modal-password")
export class ModalPassword extends LitElement {
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

  @query("#input-verify-password") inputVerifyPasswordElement?: HTMLInputElement;

  render() {
    return html`
      <div
        id="password-verify-modal"
        class="${this.open
          ? ""
          : "hidden"} fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
      >
        <div
          class="w-full max-w-sm rounded-2xl border-2 border-indigo-500/30 bg-white p-6 text-center shadow-2xl dark:bg-slate-900"
        >
          <div
            class="text-google-blue mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10"
          >
            <i data-lucide="shield-alert" class="h-6 w-6"></i>
          </div>
          <h3 class="text-md font-bold text-slate-800 dark:text-white">보안 세션 입장 확인</h3>
          <p class="mt-1 text-xs text-slate-500">
            호스트가 보안 자산을 보호하기 위해 암호를 적용했습니다.<br />지정된 비밀번호를 입력해주세요.
          </p>

          <div class="my-4">
            <input
              type="password"
              id="input-verify-password"
              placeholder="비밀번호 4자리 입력"
              class="focus:border-google-blue w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-center font-mono text-sm tracking-widest text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div class="flex gap-2">
            <button
              @click=${this.onClose}
              class="grow rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              취소
            </button>
            <button
              @click=${this.onSubmit}
              class="bg-google-blue hover:bg-google-blueHover grow rounded-xl py-2.5 text-xs font-bold text-white transition"
            >
              인증 및 접속
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private onClose() {
    this.dispatchEvent(new CustomEvent("close-modal", { bubbles: true, composed: true }));
  }

  private onSubmit() {
    const password = this.inputVerifyPasswordElement?.value || "";
    this.dispatchEvent(
      new CustomEvent("submit-verify-password", { detail: { password }, bubbles: true, composed: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "modal-password": ModalPassword;
  }
}
