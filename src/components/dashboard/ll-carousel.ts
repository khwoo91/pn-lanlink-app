import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ll-carousel')
export class LlCarousel extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Number }) carouselIndex = 0;

  private carouselData = [
    {
      title: "공유 가능한 링크 받기",
      desc: "새 공유방 개설을 클릭하여 회의에 초대할 동료에게 보낼 로컬 고유 주소 링크를 생성해 보세요."
    },
    {
      title: "사내망 단독 암호화 전송",
      desc: "모든 화면과 오디오는 외부 클라우드로 유출되지 않고 오직 사내망 공유기 내부에서 P2P 통신으로 처리됩니다."
    },
    {
      title: "설치가 불필요한 크롬 확장",
      desc: "대형 exe 프로그램 설치 없이 웹 브라우저에서 버튼 단 하나로 내 PC 전체 화면 또는 에디터를 공유하세요."
    }
  ];

  render() {
    return html`
      <div id="landing-visual-panel" class="flex flex-col items-center justify-center text-center">
        <div
          class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full custom-shadow space-y-6">
      
          <div
            class="w-48 h-48 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto relative">
            <svg class="w-32 h-32 text-google-blue" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round">
              <circle cx="50" cy="50" r="45" stroke-dasharray="4,4" class="text-slate-300 dark:text-slate-600" />
              <circle cx="30" cy="50" r="12" fill="white" class="dark:fill-slate-950" stroke="#1a73e8" stroke-width="3" />
              <path d="M18 72 C22 62, 38 62, 42 72" stroke="#1a73e8" stroke-width="3" />
              <circle cx="70" cy="50" r="12" fill="white" class="dark:fill-slate-950" stroke="#1a73e8" stroke-width="3" />
              <path d="M58 72 C62 62, 78 62, 82 72" stroke="#1a73e8" stroke-width="3" />
              <rect x="42" y="42" width="16" height="16" rx="4" fill="#1a73e8" class="animate-pulse" />
              <i data-lucide="link" class="w-4 h-4 text-white absolute top-22.5 left-25"></i>
            </svg>
          </div>
      
          <div class="space-y-2">
            <h2 id="carousel-title" class="text-base font-extrabold text-slate-900 dark:text-white">
              ${this.carouselData[this.carouselIndex].title}</h2>
            <p id="carousel-desc" class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              ${this.carouselData[this.carouselIndex].desc}
            </p>
          </div>
      
          <!-- Carousel Indicators -->
          <div class="flex items-center justify-center space-x-1.5 pt-2">
            <button @click=${()=> this.onSwitchCarousel(0)} id="carousel-dot-0" class="${this.carouselIndex === 0 ? 'w-2.5 h-2.5 bg-goggle-blue' : 'w-2 h-2 bg-slate-300 dark:bg-slate-700'} rounded-full transition-all"></button>
            <button @click=${()=> this.onSwitchCarousel(1)} id="carousel-dot-1" class="${this.carouselIndex === 1 ? 'w-2.5 h-2.5 bg-goggle-blue' : 'w-2 h-2 bg-slate-300 dark:bg-slate-700'} rounded-full transition-all"></button>
            <button @click=${()=> this.onSwitchCarousel(2)} id="carousel-dot-2" class="${this.carouselIndex === 2 ? 'w-2.5 h-2.5 bg-goggle-blue' : 'w-2 h-2 bg-slate-300 dark:bg-slate-700'} rounded-full transition-all"></button>
          </div>
        </div>
      </div>
    `;
  }

  private onSwitchCarousel(idx: number) {
    this.dispatchEvent(new CustomEvent('switch-carousel', { detail: { index: idx }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'll-carousel': LlCarousel;
  }
}
