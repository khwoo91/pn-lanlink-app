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
  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    if (
      changedProperties.has("isFullScreen") ||
      changedProperties.has("isPiP") ||
      changedProperties.has("showPiPButton")
    ) {
      createIcons({
        icons: globalIcons,
        root: this,
      });
    }
    if (changedProperties.has("chatMessages")) {
      this.scrollToBottom();
    }
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) isFullScreen = false;
  @property({ type: Boolean }) isPiP = false;
  @property({ type: Boolean }) showPiPButton = false;
  @property({ type: Array }) chatMessages: Array<{ sender: string; content: string; system?: boolean }> = [];
  @property({ type: Number }) viewerCount = 0;
  @property({ type: Array }) participants: string[] = [];
  @property({ type: String }) myNickname = "참여자";

  @query("#chat-input-field") chatInputElement?: HTMLInputElement;

  render() {
    const isExpanded = this.isFullScreen || this.isPiP;

    return html`
      <div
        class="${this.isPiP
          ? "h-full max-h-full border-none rounded-none"
          : isExpanded
            ? "max-h-full rounded-3xl border border-slate-200 dark:border-slate-800"
            : "max-h-125 rounded-3xl border border-slate-200 dark:border-slate-800"} flex h-full w-full flex-col bg-slate-50 dark:bg-slate-950"
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
                title="채팅방 참여 인원"
              >
                <i data-lucide="users" class="h-2.5 w-2.5"></i>
                <span id="chat-user-count">${this.participants.length || this.viewerCount + 1}</span>명
              </span>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-500">보안됨</span>

              <!-- PiP Toggle Button -->
              ${this.showPiPButton
                ? html`
                    <button
                      @click=${this.onTriggerPiP}
                      class="flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                      title="채팅 팝업 (항상 위 플로팅)"
                    >
                      <i data-lucide="external-link" class="h-3.5 w-3.5"></i>
                    </button>
                  `
                : ""}
            </div>
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
          class="custom-scrollbar ${isExpanded
            ? "flex-1 min-h-0"
            : "min-h-80"} grow space-y-3 overflow-y-auto p-3 text-xs"
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
                    <span class="text-[10px] font-semibold text-slate-400">나 (${this.myNickname})</span>
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
          class="flex gap-1.5 rounded-b-3xl border-t border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <input
            type="text"
            id="chat-input-field"
            placeholder="메시지를 입력하세요..."
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
    this.scrollToBottom();
  }

  private handleChatEnter(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this.onSendMessage();
    }
  }

  private onTriggerPiP() {
    this.dispatchEvent(new CustomEvent("toggle-pip", { bubbles: true, composed: true }));
  }

  private scrollToBottom() {
    const box = this.querySelector("#chat-messages-box");
    if (box) {
      setTimeout(() => {
        box.scrollTop = box.scrollHeight;
      }, 50);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-chat": LlChat;
  }
}
