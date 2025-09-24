
export type Question = {
  id: string
  text: string
  level: 'easy' | 'mid' | 'hard'
  category: 'introduction' | 'work_experience' | 'travel' | 'fun'
}

export const QUESTIONS: Question[] = [
  { id: 'intro_candidate', level: 'easy', category: 'introduction', text: 'I would love to hear about you. Could you please share a bit about your background, your professional experience, and some of your interests or hobbies?' },
  { id: 'we_overview', level: 'mid', category: 'work_experience', text: 'Could you tell me about any previous work experience you have had? And could you describe some of the main responsibilities or tasks you had in that role?' },
  { id: 'we_likes_dislikes', level: 'mid', category: 'work_experience', text: 'Thinking about your past work experience, could you tell me three aspects you enjoyed and three that you found challenging or less enjoyable?' },
  { id: 'we_biggest_challenge', level: 'hard', category: 'work_experience', text: 'What was the biggest challenge you faced in your previous job, or is there another experience-related aspect you would like to discuss?' },
  { id: 'we_dream_job', level: 'mid', category: 'work_experience', text: 'Let is imagine for a moment. If you could have your dream job, where would it be, and what role would you like to have?' },
  { id: 'travel_favorite_trip', level: 'mid', category: 'travel', text: 'I am curious about your travel experiences. Could you tell me about your favorite trip and what made it so special for you?' },
  { id: 'travel_anywhere_world', level: 'mid', category: 'travel', text: 'If you had the opportunity to travel anywhere in the world, where would you choose to go, and what would you like to do or experience there?' },
  { id: 'travel_ukraine_favorite_place', level: 'mid', category: 'travel', text: 'What is your favorite place in Ukraine and why?' },
  { id: 'joke_supermarket_last_five', level: 'easy', category: 'fun', text: 'I have one final, very serious question. Are you ready? Please recall and name the last five items you bought at the supermarket.' },
]
