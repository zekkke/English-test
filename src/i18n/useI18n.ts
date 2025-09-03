const ua = {
  'consent.title': 'Згода на використання камери та мікрофона',
  'consent.body1': 'Ми використовуємо камеру і мікрофон виключно для проведення інтерв’ю в реальному часі.',
  'consent.body2': 'Дані не зберігаються локально без потреби. Натискаючи "Почати", ви погоджуєтесь.',
  'consent.accept': 'Почати',
  'state.idle': 'Готовність',
  'state.greeting': 'Привітання',
  'state.asking': 'Питання',
  'state.listening': 'Очікуємо відповідь',
  'state.speaking': 'Відповідь ШІ',
  'state.analyzing': 'Аналіз відповіді',
  'state.finished': 'Тест завершено',
}

type Dict = typeof ua

export function useI18n() {
  const t = (k: keyof Dict | string) => (ua as Record<string, string>)[k] ?? String(k)
  return { t }
}


