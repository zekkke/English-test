import { useState } from 'react'
import Auth from './components/Auth.tsx'
import WritingTest from './components/WritingTest.tsx'
import SpeakingTest from './components/SpeakingTest.tsx'
import CombinedScoreCard from './components/CombinedScoreCard.tsx'
import { ScoreCard } from './components/ScoreCard.tsx'

// Note: legacy InterviewApp removed to avoid unused warnings in CI

export default function App() {
  const [authorized, setAuthorized] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [stage, setStage] = useState<'writing' | 'speaking' | 'report'>('writing')
  const [writingResult, setWritingResult] = useState<any | null>(null)
  const [speakingResult, setSpeakingResult] = useState<any | null>(null)

  if (!authorized) {
    return <Auth onSuccess={(em) => { setEmail(em); setAuthorized(true); setStage('writing') }} />
  }

  if (stage === 'writing') {
    return (
      <WritingTest
        onFinished={(res) => { setWritingResult(res) }}
        onProceedToSpeaking={() => setStage('speaking')}
      />
    )
  }

  if (stage === 'speaking') {
    return (
      <SpeakingTest
        userEmail={email}
        onFinished={(res) => { setSpeakingResult(res); setStage('report') }}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="max-w-5xl mx-auto w-full">
        {writingResult && speakingResult ? (
          <CombinedScoreCard writing={{ report: writingResult.report }} speaking={{ report: speakingResult.report }} />
        ) : speakingResult ? (
          <ScoreCard photoDataUrl={null} report={speakingResult.report} messages={speakingResult.messages} timeExpired={speakingResult.timeExpired} />
        ) : writingResult ? (
          <ScoreCard photoDataUrl={null} report={writingResult.report} messages={writingResult.messages} timeExpired={writingResult.timeExpired} />
        ) : (
          <div className="rounded-2xl bg-white/10 text-white p-6">Results are not available.</div>
        )}
      </div>
    </div>
  )
}

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="max-w-5xl mx-auto w-full">
        {writingResult && speakingResult ? (
          <CombinedScoreCard writing={{ report: writingResult.report }} speaking={{ report: speakingResult.report }} />
        ) : (
          <div className="rounded-2xl bg-white/10 text-white p-6">Results are not available.</div>
        )}
      </div>
    </div>
  )
}
