type Message = {
  role: 'assistant' | 'user' | 'analysis'
  text: string
  ts?: string
}

type Props = { messages: Message[] }

const badgeCls: Record<Message['role'], string> = {
  assistant: 'bg-blue-50 text-blue-700',
  user: 'bg-emerald-50 text-emerald-700',
  analysis: 'bg-amber-50 text-amber-700',
}

export function TranscriptList({ messages }: Props) {
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${badgeCls[m.role]}`}>
            {m.role === 'assistant' ? 'AI' : m.role === 'user' ? 'YOU' : 'AI•analysis'}
          </span>
          <div className={`text-sm text-gray-800 bg-gray-100 rounded-md px-3 py-1.5 shadow-sm max-w-full truncate`}>{m.text}</div>
          <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{m.ts ?? ''}</span>
        </div>
      ))}
    </div>
  )
}


