import { LitElement, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";

@customElement("ll-chat")
export class LlChat extends LitElement {
  firstUpdated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) isFullScreen = false;
  @property({ type: Array }) chatMessages: Array<{ sender: string; content: string; system?: boolean }> = [];
  @property({ type: Number }) viewerCount = 0;
  @property({ type: Array }) participants: string[] = [];
  @property({ type: String }) myNickname = "참여자";

  @query("#chat-input-field") chatInputElement?: HTMLInputElement;

  render() {
    return html`
      <div
        class="flex w-full flex-col rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 ${this.isFullScreen ? 'h-full max-h-full' : 'h-auto max-h-115'}"
      >
        <!-- Chat header -->
        <div class="flex flex-col gap-1.5 border-b border-slate-200 p-3 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <h4 class="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <i data-lucide="messages-square" class="text-google-blue h-4 w-4"></i>채팅방
              </h4>
              <span
                class="bg-google-blue/10 text-google-blue flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                title="채팅방 동시 참여 인원"
              >
                <i data-lucide="users" class="h-2.5 w-2.5"></i>
                <span id="chat-user-count">${this.participants.length || this.viewerCount + 1}</span>명
              </span>
            </div>
            <span class="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-500">보안됨</span>
          </div>

          <!-- 실시간 참여자 목록 노출 -->
          ${this.participants.length > 0
            ? html`
                <div class="flex items-center gap-1 truncate text-[10px] text-slate-400 dark:text-slate-500">
                  <span class="shrink-0 font-bold text-slate-500">참여 인원:</span>
                  <span class="truncate">${this.participants.join(", ")}</span>
                </div>
              `
            : ""}
        </div>

        <!-- Logs list -->
        <div
          id="chat-messages-box"
          class="custom-scrollbar grow space-y-3 overflow-y-auto p-3 text-xs ${this.isFullScreen ? 'flex-1 min-h-0' : 'max-h-87.5 min-h-62.5'}"
        >
          ${this.chatMessages.map((msg) => {
            if (msg.system) {
              return html`
                <div
                  class="border-google-blue/10 rounded-lg border bg-blue-50/50 p-2.5 text-xs leading-relaxed text-slate-500 dark:bg-blue-950/20"
                >
                  ${msg.content}
                </div>
              `;
            }

            const isMe = msg.sender === "나" || msg.sender === this.myNickname;

            return isMe
              ? html`
                  <div class="flex w-full flex-col items-end space-y-1">
                    <div
                      class="max-w-[85%] rounded-2xl rounded-tr-none border border-[#c4d4ed] bg-[#d9e4f5] p-2.5 text-slate-800 dark:border-blue-800/30 dark:bg-blue-900/40 dark:text-slate-200"
                    >
                      ${msg.content}
                    </div>
                  </div>
                `
              : html`
                  <div class="flex w-full flex-col items-start space-y-1">
                    <span class="text-[10px] font-semibold text-slate-400">${msg.sender}</span>
                    <div
                      class="max-w-[85%] rounded-2xl rounded-tl-none border border-slate-200 bg-white p-2.5 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      ${msg.content}
                    </div>
                  </div>
                `;
          })}
        </div>

        <!-- Chat form -->
        <div
          class="flex gap-1.5 rounded-b-2xl border-t border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <input
            type="text"
            id="chat-input-field"
            placeholder="메시지 전송..."
            @keydown=${this.handleChatEnter}
            class="focus:border-google-blue grow rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          />
          <button
            @click=${this.onSendMessage}
            class="bg-google-blue hover:bg-google-blueHover rounded-lg p-2 text-white transition"
          >
            <i data-lucide="send-horizontal" class="h-4 w-4"></i>
          </button>
        </div>
      </div>
    `;
  }

  private onSendMessage() {
    const text = this.chatInputElement?.value.trim() || "";
    if (!text) return;
    this.dispatchEvent(new CustomEvent("send-message", { detail: { text }, bubbles: true, composed: true }));
    if (this.chatInputElement) {
      this.chatInputElement.value = "";
    }
  }

  private handleChatEnter(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this.onSendMessage();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-chat": LlChat;
  }
}
