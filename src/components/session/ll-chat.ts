import { LitElement, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('ll-chat')
export class LlChat extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Array }) chatMessages: Array<{ sender: string; content: string; system?: boolean }> = [];
  @property({ type: Number }) viewerCount = 0;

  @query('#chat-input-field') private chatInputElement?: HTMLInputElement;

  render() {
    return html`
      <div class="xl:col-span-4 bg-slate-50 dark:bg-slate-955 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-auto max-h-[460px]">
        <!-- Chat header -->
        <div class="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <i data-lucide="messages-square" class="w-4 h-4 text-[#1a73e8]"></i> 사내 다이렉트 채팅방
            </h4>
            <span class="bg-[#1a73e8]/10 text-[#1a73e8] text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1" title="채팅방 동시 참여 인원">
              <i data-lucide="users" class="w-2.5 h-2.5"></i> <span id="chat-user-count">${this.viewerCount + 1}</span>명
            </span>
          </div>
          <span class="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-mono">P2P 암호화</span>
        </div>
        
        <!-- Logs list -->
        <div id="chat-messages-box" class="flex-grow p-3 overflow-y-auto space-y-2 text-xs min-h-[250px] max-h-[350px]">
          ${this.chatMessages.map(msg => msg.system ? html`
            <div class="bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-lg text-slate-500 border border-[#1a73e8]/10 text-[11px] leading-relaxed">
              ${msg.content}
            </div>
          ` : html`
            <div class="flex flex-col items-start space-y-1">
              <span class="text-[10px] text-slate-400 font-semibold">${msg.sender}</span>
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl max-w-[85%] text-slate-700 dark:text-slate-300">
                ${msg.content}
              </div>
            </div>
          `)}
        </div>

        <!-- Chat form -->
        <div class="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl flex gap-1.5">
          <input type="text" id="chat-input-field" placeholder="보안 메시지 전송..." @keydown=${this.handleChatEnter} class="flex-grow bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-[#1a73e8] text-slate-800 dark:text-slate-200">
          <button @click=${this.onSendMessage} class="p-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg transition">
            <i data-lucide="send-horizontal" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }

  private onSendMessage() {
    const text = this.chatInputElement ? this.chatInputElement.value.trim() : '';
    if (!text) return;
    this.dispatchEvent(new CustomEvent('send-message', { detail: { text }, bubbles: true, composed: true }));
    if (this.chatInputElement) {
      this.chatInputElement.value = '';
    }
  }

  private handleChatEnter(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.onSendMessage();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'll-chat': LlChat;
  }
}
