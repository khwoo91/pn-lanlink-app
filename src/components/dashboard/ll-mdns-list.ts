import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createIcons, Search, Lock, Unlock } from 'lucide';
import { mockRooms } from '../../infrastructure/mdns-signaling';
import type { LANRoom } from '../../infrastructure/mdns-signaling';

@customElement('ll-mdns-list')
export class LlMdnsList extends LitElement {
  updated() {
    createIcons({
      icons: {
        Search,
        Lock,
        Unlock
      },
      root: this
    });
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: Array }) rooms: LANRoom[] = mockRooms;

  render() {
    return html`
      <div class="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
        <!-- Scanned rooms count -->
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
          <span class="flex items-center gap-1.5">
            <i data-lucide="search" class="w-3.5 h-3.5 text-google-blue"></i> 사내 네트워크 대기방 감지
          </span>
          <span class="text-[10px] text-google-blue animate-pulse">실시간 탐색 중...</span>
        </div>

        <!-- Scanned list -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${this.rooms.map(room => html`
            <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-google-blue transition group flex items-center justify-between text-xs">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-slate-800 dark:text-slate-200">${room.name}</span>
                  ${room.locked ? html`
                    <span class="bg-google-blue/10 text-google-blue text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                      <i data-lucide="lock" class="w-2.5 h-2.5"></i> 잠금
                    </span>
                  ` : html`
                    <span class="bg-slate-200 dark:bg-slate-800 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                      <i data-lucide="unlock" class="w-2.5 h-2.5"></i> 공개
                    </span>
                  `}
                </div>
                <p class="text-[10px] text-slate-500">${room.ip} · ${room.fps} FPS</p>
              </div>
              <button @click=${() => this.onSelectRoom(room)} class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-google-blue hover:text-white dark:hover:bg-google-blue px-2.5 py-1.5 rounded-md font-semibold transition text-slate-800 dark:text-slate-200">
                참여
              </button>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private onSelectRoom(room: LANRoom) {
    this.dispatchEvent(new CustomEvent('select-room', {
      detail: {
        name: room.name,
        ip: room.ip,
        locked: room.locked
      },
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'll-mdns-list': LlMdnsList;
  }
}
