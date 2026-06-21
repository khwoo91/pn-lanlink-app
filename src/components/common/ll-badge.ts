import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ll-badge')
export class LlBadge extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: String }) text = 'PRO';
  @property({ type: String }) color = 'amber'; // amber, blue, emerald, rose

  render() {
    let colorClasses = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (this.color === 'blue') {
      colorClasses = 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    } else if (this.color === 'emerald') {
      colorClasses = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    } else if (this.color === 'rose') {
      colorClasses = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    }

    return html`
      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${colorClasses}">
        <slot></slot>${this.text}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'll-badge': LlBadge;
  }
}
