export type ProviderEvent =
  | { type: 'state'; state: 'idle' | 'greeting' | 'asking' | 'listening' | 'speaking' | 'analyzing' | 'finished' }
  | { type: 'assistant_said'; text: string }
  | { type: 'user_transcript'; text: string }
  | { type: 'analysis_ready'; payload: { questionId: string; transcript: string; metrics: Record<string, any>; relevant?: boolean; reply?: string | null } }
  | { type: 'energy'; value: number }
  | { type: 'can_skip'; value: boolean }
  | { type: 'progress'; current: number; total: number }

export type LLMProviderParams = {
  onEvent: (ev: ProviderEvent) => void
  getUserMediaStream: () => MediaStream | null
}

export interface LLMProvider {
  repeat(): void
  skip(): void
  dispose(): void
  onUserAnswered?(transcript: string): void
}

export async function createLLMProvider(params: LLMProviderParams): Promise<LLMProvider> {
  const provider = (import.meta.env.VITE_REALTIME_PROVIDER || 'openai') as string
  if (provider === 'gemini') {
    const { GeminiProvider } = await import('./providers/gemini.ts')
    return new GeminiProvider(params)
  }
  if (provider === 'mock') {
    const { LLMProviderMock } = await import('./providers/mock.ts')
    return new LLMProviderMock(params)
  }
  const { OpenAIProvider } = await import('./providers/openai.ts')
  return new OpenAIProvider(params)
}


