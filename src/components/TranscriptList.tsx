type Message = {
  role: 'assistant' | 'user' | 'analysis'
  text: string
  ts?: string
}

type Props = { messages: Message[] }

const badgeCls: Record<Message['role'], string> = {
  assistant: 'bg-blue-100 text-blue-700',
  user: 'bg-green-100 text-green-700',
  analysis: 'bg-amber-100 text-amber-700',
}

export function TranscriptList({ messages }: Props) {
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${badgeCls[m.role]}`}>
            {m.role === 'assistant' ? 'AI' : m.role === 'user' ? 'YOU' : 'AI•analysis'}
          </span>
          <div className={`text-sm ${m.role === 'user' ? 'text-gray-900' : 'text-gray-800'}`}>{m.text}</div>
          <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{m.ts ?? ''}</span>
        </div>
      ))}
    </div>
  )
}


