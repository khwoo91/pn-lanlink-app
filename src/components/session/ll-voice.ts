import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ll-voice")
export class LlVoice extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) localMuted = true;

  render() {
    return html`
      <div
        id="voice-wave-container"
        class="${!this.localMuted
          ? ""
          : "hidden"} absolute top-4 left-4 z-20 flex items-center gap-3 rounded-lg border border-blue-500/30 bg-slate-950/80 px-3 py-2"
      >
        <div class="flex h-6 items-end gap-1">
          <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.1s"></div>
          <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.4s"></div>
          <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.2s"></div>
          <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.6s"></div>
          <div class="audio-wave-bar bg-google-blue w-1" style="animation-delay: 0.3s"></div>
        </div>
        <span class="text-google-blue text-xs font-bold tracking-tight">LAN 보이스 음성 연결됨</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-voice": LlVoice;
  }
}
