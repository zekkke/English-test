const en = {
  'consent.title': 'Інструкція перед початком тестування',
  'consent.body1': 'Ласкаво просимо до Simply AI Interviewer!\nПеред початком ознайомтесь з правилами:\n\n1. Камера та мікрофон\n\nДля проходження інтерв’ю обов’язково використовується ваша камера та мікрофон.\n\nДані використовуються виключно для аналізу відповідей і не зберігаються локально без потреби.',
  'consent.body2': '2. Процес інтерв’ю\n\nШтучний інтелект поставить вам приблизно 10 запитань.\n\nЗапитання стосуються роботи, хобі, професійних і особистісних навичок.\n\nПісля завершення інтерв’ю система сформує повну аналітику ваших відповідей.\n\n3. Кнопки керування\n\n«Next» – перехід до наступного питання.\n\n«Repeat question» – якщо ви не почули або не зрозуміли запитання, система озвучить його ще раз.\n\n«Finish answer» – натисніть, коли ви закінчили відповідати на запитання.\n\n4. Поради\n\nНамагайтеся відповідати чітко та повними реченнями англійською.\n\nПеред початком перевірте гучність мікрофона та якість зображення з камери.\n\nЧас на тестування 15 хвилин.\n\nНатискаючи «Confirm», ви погоджуєтесь із використанням камери та мікрофона для проведення інтерв’ю.',
  'consent.checkbox': 'I have read the instructions and agree to the Terms and Privacy Policy',
  'consent.accept': 'Confirm',

  // Writing-specific instruction/consent
  'consent.writing.body1': 'Writing section instructions.\n\nYou will be given three prompts. Write a short response (80–160 words) for each prompt. Use clear structure: opening idea, supporting details/examples, short conclusion.',
  'consent.writing.body2': 'Agreement.\n\nYour text will be analyzed to provide feedback and CEFR-like metrics. By ticking the checkbox you confirm that the text is your own and you agree to the processing of the content for assessment purposes.',

  

  'state.idle': 'Idle',
  'state.greeting': 'Greeting',
  'state.asking': 'Question',
  'state.listening': 'Listening',
  'state.speaking': 'AI Response',
  'state.analyzing': 'Analyzing',
  'state.finished': 'Test finished',

  'ui.progress': 'Progress',
  'ui.time': 'Time',
  'header.start': 'Start test',
  'btn.repeat': 'Repeat question (R)',
  'btn.next': 'Next',
  'btn.finish': 'Finish answer',

  'report.title': 'Candidate summary card',
  'report.feedback': 'Feedback',
  'report.keyErrors': 'Key errors',
  'report.rephrases': 'Rephrase suggestions',
  'report.overdue': 'You did not finish within the allotted time and did not pass the test.',
  'report.answeredOf': (a: number, t: number) => `Answered ${a} of ${t} questions.`,
} as const

type Dict = typeof en

type Value = string | ((...args: any[]) => string)

type Dictionary = { [K in keyof Dict]: Value }

export function useI18n() {
  const t = (k: keyof Dictionary | string, ...args: any[]): string => {
    const v = (en as any)[k]
    if (typeof v === 'function') return (v as (...args: any[]) => string)(...args)
    if (typeof v === 'string') return v
    return String(k)
  }
  return { t }
}


