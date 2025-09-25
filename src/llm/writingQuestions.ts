export type WritingQuestion = {
  id: string
  text: string
  level: 'easy' | 'mid' | 'hard'
  category: 'general' | 'work' | 'opinion' | 'problem_solving'
}

export const WRITING_QUESTIONS: WritingQuestion[] = [
  { id: 'w_remote_vs_office', level: 'mid', category: 'opinion', text: 'Some companies allow their employees to work remotely, while others insist on working from the office. Which option do you think is better? Explain your opinion and give examples.' },
  { id: 'w_memorable_trip', level: 'mid', category: 'general', text: 'Describe a trip that left a strong impression on you. What was special about this journey? What challenges or pleasant surprises did you experience?' },
  { id: 'w_hotel_complaint', level: 'hard', category: 'problem_solving', text: 'Imagine that you want to make a complaint to a hotel after your vacation. In the letter, explain what problems occurred, how they affected your stay, and what kind of compensation you expect.' },
]


