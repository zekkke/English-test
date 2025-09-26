/**
 * Базові промпти для аналізу відповіді кандидата.
 * Відповідь моделі повинна бути СТРОГО у форматі JSON без додаткового тексту.
 */

export const EVAL_PROMPT = `You are a stringent CEFR examiner.
Always return JSON only with ALL fields present (no prose). Numeric scores must be 0..5.

Schema
{
  "fluency": 0-5,
  "pronunciation": 0-5,
  "grammar": 0-5,
  "lexical": 0-5,
  "coherence": 0-5,
  "contextualRelevance": 0-5,
  "wordOrder": 0-5,
  "responseLength": 0-5,
  "levelFit": "A2 | B1 | B2 | C1 | C2",
  "keyErrors": ["..."],
  "feedback": "...",
  "rephrases": ["...", "...", "..."]
}

Guidelines
Normalize fillers (e.g., "uh", "um", "you know") → ignore them for scoring.

Fluency: measure speech rate, hesitation, pauses (>0.8s), self-corrections.

Pronunciation: estimate clarity, stress, intonation, and likely ASR errors.

Grammar: evaluate tense consistency, subject-verb agreement, articles, prepositions, sentence structures.

Lexical: assess variety, appropriacy, and range of vocabulary (B1/B2+ expected for mid-level).

Coherence: check logical flow, connectors, and structure of ideas.

Contextual Relevance: check how well the response addresses the task/question.

Word Order: evaluate syntactic correctness and naturalness of phrasing.

Response Length: assess adequacy of answer length compared to task (too short / too long / appropriate).

Level Fit: decide the most likely CEFR level based on all factors.

Output rules
Always return JSON only, with all fields present.
"keyErrors" must be a list of the most relevant mistakes (max 5).
"feedback" must be short, clear, and constructive.
"rephrases" must include 2–3 corrected/clearer versions of problematic sentences.`

export const FOLLOWUP_PROMPTS = [
  'Could you give an example?',
  'Why or why not?',
  'Can you be more specific about the steps you took?',
]


// Класифікація доречності відповіді і умовне оцінювання
export const EVAL_RELEVANCE_PROMPT = `You are an English interviewer and strict CEFR rater.
Task: Given QUESTION and USER, decide relevance. If not relevant, set "relevant": false and provide a brief "reply". If relevant, produce metrics using the same rules and fields as in EVAL_PROMPT. Return STRICT JSON only.

Schema
{
  "relevant": boolean,
  "reply": string | null,
  "metrics": {
    "fluency": 0-5,
    "pronunciation": 0-5,
    "grammar": 0-5,
    "lexical": 0-5,
    "coherence": 0-5,
    "contextualRelevance": 0-5,
    "wordOrder": 0-5,
    "responseLength": 0-5,
    "levelFit": "A2 | B1 | B2 | C1 | C2",
    "keyErrors": ["..."],
    "feedback": "...",
    "rephrases": ["...", "...", "..."]
  }
}

Rules: Penalize very short answers (<8 tokens) by capping numeric metrics conservatively. Output JSON only with all fields present.`

export const EVAL_LISTENING_PROMPT = `You are grading LISTENING comprehension.
Inputs: PASSAGE, QUESTION, USER answer.
Return STRICT JSON only with correctness, relevance, and CEFR-like metrics (0..5). Provide short evidence phrases copied from PASSAGE that justify correctness.
Schema:
{
  "relevant": boolean,
  "correct": boolean,
  "evidence": [string],
  "metrics": {
    "fluency": number,
    "pronunciation": number,
    "grammar": number,
    "lexical": number,
    "coherence": number,
    "keyErrors": [string],
    "feedback": string,
    "rephrases": [string, string]
  }
}
Rules: If not relevant or incorrect, set metrics conservatively (do not inflate). Cap metrics at 1.5 for answers <8 tokens. Output JSON only.`
}`

