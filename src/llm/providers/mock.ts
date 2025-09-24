import type { LLMProvider, LLMProviderParams, ProviderEvent } from '../provider'

const QUESTIONS = [
  'I would love to hear about you. Could you please share a bit about your background, your professional experience, and some of your interests or hobbies?',
  'Could you tell me about any previous work experience you have had? And could you describe some of the main responsibilities or tasks you had in that role?',
  'Thinking about your past work experience, could you tell me three aspects you enjoyed and three that you found challenging or less enjoyable?',
  'What was the biggest challenge you faced in your previous job, or is there another experience-related aspect you would like to discuss?',
  'Let is imagine for a moment. If you could have your dream job, where would it be, and what role would you like to have?',
  'I am curious about your travel experiences. Could you tell me about your favorite trip and what made it so special for you?',
  'If you had the opportunity to travel anywhere in the world, where would you choose to go, and what would you like to do or experience there?',
  'What is your favorite place in Ukraine and why?',
  'I have one final, very serious question. Are you ready? Please recall and name the last five items you bought at the supermarket.',
]

export class LLMProviderMock implements LLMProvider {
  private onEvent: (e: ProviderEvent) => void
  private disposed = false
  private idx = 0
  private energyTimer: number | null = null

  constructor(params: LLMProviderParams) {
    this.onEvent = params.onEvent
    this.bootstrap()
  }

  private async bootstrap() {
    this.emit({ type: 'state', state: 'greeting' })
    await this.sleep(500)
    this.emit({ type: 'assistant_said', text: "Welcome to the automated assessment system. You are about to take a short English test. Good luck. " })
    await this.sleep(400)
    this.askNext()
    this.energyTimer = window.setInterval(() => {
      this.emit({ type: 'energy', value: 0.2 + Math.random() * 0.6 })
    }, 100)
  }

  private askNext() {
    if (this.idx >= QUESTIONS.length) {
      this.emit({ type: 'state', state: 'finished' })
      if (this.energyTimer) clearInterval(this.energyTimer)
      return
    }
    this.emit({ type: 'state', state: 'asking' })
    const q = QUESTIONS[this.idx]
    this.emit({ type: 'assistant_said', text: q })
    this.emit({ type: 'progress', current: this.idx + 1, total: QUESTIONS.length })
    this.emit({ type: 'state', state: 'listening' })
    this.emit({ type: 'can_skip', value: true })
    // видалено автодовідповідь; очікуємо реальну відповідь (demo: можна викликати simulateAnswer вручну)
  }

  // Демонстраційний генератор відповіді видалено з автозапуску, залишаємо як референс

  repeat() { this.askNext() }
  skip() { this.idx += 1; this.askNext() }
  dispose() { this.disposed = true; if (this.energyTimer) clearInterval(this.energyTimer) }

  private emit(e: ProviderEvent) { if (!this.disposed) this.onEvent(e) }
  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
}


