import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createIcons } from "lucide";
import { globalIcons } from "../../utils/icons";
import { mockRooms } from "../../infrastructure/mdns-signaling";
import type { LANRoom } from "../../infrastructure/mdns-signaling";

@customElement("ll-mdns-list")
export class LlMdnsList extends LitElement {
  updated() {
    createIcons({
      icons: globalIcons,
      root: this,
    });
  }
  createRenderRoot() {
    return this;
  }

  @property({ type: Array }) rooms: LANRoom[] = mockRooms;

  render() {
    return html`
      <div class="mx-auto w-full max-w-xl space-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
        <!-- Scanned rooms count -->
        <div class="flex items-center justify-between px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span class="flex items-center gap-1.5">
            <i data-lucide="search" class="text-google-blue h-3.5 w-3.5"></i>
            동일 IP 공유방 목록
          </span>
          <span class="text-google-blue animate-pulse text-[10px]">탐색 중...</span>
        </div>

        <!-- Scanned list -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${this.rooms.map(
            (room) => html`
              <div
                class="hover:border-google-blue group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs transition dark:border-slate-800 dark:bg-slate-900"
              >
                <div class="space-y-1">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-slate-800 dark:text-slate-200">${room.name}</span>
                    ${room.locked
                      ? html`
                          <span
                            class="bg-google-blue/10 text-google-blue flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold"
                          >
                            <i data-lucide="lock" class="h-2.5 w-2.5"></i> 잠금
                          </span>
                        `
                      : html`
                          <span
                            class="flex items-center gap-0.5 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:bg-slate-800"
                          >
                            <i data-lucide="unlock" class="h-2.5 w-2.5"></i> 공개
                          </span>
                        `}
                  </div>
                  <p class="text-[10px] text-slate-500">${room.ip} · ${room.fps} FPS</p>
                </div>
                <button
                  @click=${() => this.onSelectRoom(room)}
                  class="hover:bg-google-blue dark:hover:bg-google-blue rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-800 transition hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  참여
                </button>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  private onSelectRoom(room: LANRoom) {
    this.dispatchEvent(
      new CustomEvent("select-room", {
        detail: {
          name: room.name,
          ip: room.ip,
          code: room.code,
          locked: room.locked,
          passwordHash: room.passwordHash,
        },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-mdns-list": LlMdnsList;
  }
}
