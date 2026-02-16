import { useEffect, useMemo, useRef, useState } from 'react'

const API_KEY_STORAGE = 'prosto-online-groq-key'
const THEME_STORAGE = 'prosto-online-theme'
const LEVEL_STORAGE = 'prosto-online-level'
const MAX_QUESTION_LENGTH = 350

const levelPrompts = {
  child:
    'Ты объясняешь как добрый друг для ребёнка 8-10 лет. Используй простые слова, короткие предложения, реальные примеры из жизни и поддерживающий тон.',
  student:
    'Ты объясняешь как сильный школьный наставник. Давай структуру: что это, почему важно, как применять. Добавляй понятный пример и мини-проверку в конце.',
  adult:
    'Ты объясняешь взрослому занятому человеку: коротко, по делу, без воды. Делай акцент на практической пользе и шагах, которые можно выполнить сразу.',
  senior:
    'Ты объясняешь пожилому человеку спокойно, уважительно и очень понятно. Избегай сложных терминов, пиши крупными логическими блоками и мягко повторяй главное.',
}

const levelLabels = {
  child: 'Ребёнок',
  student: 'Школьник',
  adult: 'Взрослый',
  senior: 'Пожилой',
}

const themeOptions = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'forest', label: 'Лес' },
  { value: 'sunset', label: 'Закат' },
  { value: 'ocean', label: 'Океан' },
  { value: 'lavender', label: 'Лаванда' },
  { value: 'coffee', label: 'Кофе' },
  { value: 'neon', label: 'Неон' },
]

const quickExamples = [
  'Объясни, зачем нужна финансовая подушка',
  'Как работает инфляция простыми словами?',
  'Почему телефон быстро разряжается?',
]

function App() {
  const [question, setQuestion] = useState('')
  const [level, setLevel] = useState('adult')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [savedApiKey, setSavedApiKey] = useState('')
  const [theme, setTheme] = useState('light')

  const questionRef = useRef(null)
  const settingsPanelRef = useRef(null)

  useEffect(() => {
    const key = localStorage.getItem(API_KEY_STORAGE) || ''
    const savedTheme = localStorage.getItem(THEME_STORAGE) || 'light'
    const savedLevel = localStorage.getItem(LEVEL_STORAGE) || 'adult'

    const hasTheme = themeOptions.some((option) => option.value === savedTheme)
    const hasLevel = Object.hasOwn(levelLabels, savedLevel)

    setSavedApiKey(key)
    setApiKeyInput(key)
    setTheme(hasTheme ? savedTheme : 'light')
    setLevel(hasLevel ? savedLevel : 'adult')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_STORAGE, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(LEVEL_STORAGE, level)
  }, [level])

  useEffect(() => {
    if (showSettings) {
      settingsPanelRef.current?.focus()
      return
    }

    questionRef.current?.focus()
  }, [showSettings])

  const hasApiKey = useMemo(() => savedApiKey.trim().length > 0, [savedApiKey])
  const trimmedQuestion = question.trim()
  const canExplain = trimmedQuestion.length > 3 && !loading
  const questionLength = question.length

  const saveApiKey = () => {
    const cleaned = apiKeyInput.trim()
    localStorage.setItem(API_KEY_STORAGE, cleaned)
    setSavedApiKey(cleaned)
    setShowSettings(false)
    setError('')
    setStatus(cleaned ? 'Ключ сохранён. Можно получать объяснения.' : 'Ключ удалён из браузера.')
  }

  const copyAnswer = async () => {
    if (!answer.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(answer)
      setStatus('Ответ скопирован. Можно вставить в заметки или чат.')
    } catch {
      setError('Не получилось скопировать автоматически. Выделите текст вручную.')
    }
  }

  const explain = async () => {
    if (trimmedQuestion.length < 4) {
      setError('Добавьте чуть больше деталей (минимум 4 символа), и я всё разложу по полочкам.')
      return
    }

    if (!hasApiKey) {
      setError('Сначала добавьте Groq API-ключ в настройках (кнопка «Настройки» сверху).')
      setShowSettings(true)
      return
    }

    setLoading(true)
    setError('')
    setStatus('')
    setAnswer('')

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          temperature: 0.5,
          messages: [
            {
              role: 'system',
              content: levelPrompts[level],
            },
            {
              role: 'user',
              content: `Объясни это понятно: ${trimmedQuestion}`,
            },
          ],
        }),
      })

      const rawBody = await response.text()
      let data = null

      if (rawBody) {
        try {
          data = JSON.parse(rawBody)
        } catch {
          data = null
        }
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            'Похоже, ключ не подошёл. Откройте Настройки и вставьте действующий ключ с https://console.groq.com/keys',
          )
        }

        const apiMessage = data?.error?.message?.trim()
        if (apiMessage) {
          throw new Error(apiMessage)
        }

        throw new Error('Сервис временно недоступен. Попробуйте снова через минуту 🙌')
      }

      const text = data?.choices?.[0]?.message?.content?.trim()
      if (!text) {
        throw new Error('Ответ получился пустым. Давайте попробуем переформулировать вопрос.')
      }

      setAnswer(text)
      setStatus('Готово! Ответ ниже. Если нужно — скопируйте одной кнопкой.')
    } catch (err) {
      setError(err.message || 'Что-то пошло не так, но мы уже почти у цели. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const onQuestionKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      if (canExplain) {
        explain()
      }
    }
  }

  const closeOnEscape = (event) => {
    if (event.key === 'Escape') {
      setShowSettings(false)
    }
  }

  return (
    <div className="min-h-screen bg-app px-4 py-6 text-main transition-colors sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-main bg-card p-5 shadow-xl transition-colors sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 inline-flex rounded-full bg-badge px-3 py-1 text-xs font-bold text-badge-text">Просто.Онлайн</p>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              Объясняем сложное
              <span className="text-accent"> простыми словами</span>
            </h1>
            <p className="mt-3 text-base text-soft sm:text-lg">
              Введите вопрос, выберите уровень и получите понятный ответ. Горячая клавиша: Ctrl + Enter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="focus-ring shrink-0 rounded-2xl bg-main-button px-4 py-3 text-sm font-semibold text-main-button-text transition hover:opacity-90"
          >
            Настройки
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-main bg-card-soft px-4 py-3">
          <label className="block" htmlFor="theme-select">
            <span className="mb-2 block text-sm font-semibold text-soft">Тема оформления</span>
            <select
              id="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
            >
              {themeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-4">
          <label className="block" htmlFor="question-input">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="block text-sm font-semibold text-soft">Что нужно объяснить?</span>
              <span className={`text-xs font-semibold ${questionLength > MAX_QUESTION_LENGTH ? 'text-rose-600' : 'text-soft'}`}>
                {questionLength}/{MAX_QUESTION_LENGTH}
              </span>
            </div>
            <textarea
              ref={questionRef}
              id="question-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH + 25))}
              onKeyDown={onQuestionKeyDown}
              rows={5}
              placeholder="Например: Объясни, как работает ипотека простыми словами"
              className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
              aria-describedby="question-help"
            />
            <p id="question-help" className="mt-2 text-xs text-soft">
              Чем конкретнее вопрос, тем полезнее ответ.
            </p>
          </label>

          <div className="flex flex-wrap gap-2">
            {quickExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuestion(example)}
                className="focus-ring rounded-full border border-main bg-card-soft px-3 py-2 text-xs font-semibold text-main transition hover:-translate-y-0.5 hover:opacity-95"
              >
                {example}
              </button>
            ))}
          </div>

          <label className="block" htmlFor="level-select">
            <span className="mb-2 block text-sm font-semibold text-soft">Уровень объяснения</span>
            <select
              id="level-select"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
            >
              {Object.entries(levelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={explain}
              disabled={!canExplain}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-lg font-bold text-accent-text transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <span className="loader-dot" aria-hidden="true" />}
              {loading ? 'Объясняю…' : 'Объяснить'}
            </button>

            <button
              type="button"
              onClick={() => {
                setQuestion('')
                setAnswer('')
                setError('')
                setStatus('')
              }}
              className="focus-ring w-full rounded-2xl border border-main bg-card-soft px-5 py-4 text-sm font-bold text-main transition hover:opacity-90 sm:max-w-40"
            >
              Очистить
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">
              {error}
            </div>
          )}

          {status && (
            <p role="status" aria-live="polite" className="rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
              {status}
            </p>
          )}

          <div className="rounded-2xl border border-main bg-card-soft p-4" aria-live="polite">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Ответ</h2>
              <button
                type="button"
                onClick={copyAnswer}
                disabled={!answer.trim()}
                className="focus-ring rounded-xl border border-main bg-input px-3 py-2 text-xs font-bold text-main transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Копировать
              </button>
            </div>

            {loading ? (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-4 w-11/12 rounded bg-main/10" />
                <div className="h-4 w-full rounded bg-main/10" />
                <div className="h-4 w-10/12 rounded bg-main/10" />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-base leading-relaxed text-main">
                {answer || 'Здесь появится готовое понятное объяснение.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowSettings(false)
            }
          }}
          onKeyDown={closeOnEscape}
        >
          <div
            ref={settingsPanelRef}
            tabIndex={-1}
            className="w-full max-w-lg rounded-3xl border border-main bg-card p-6 shadow-2xl focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <h3 id="settings-title" className="text-2xl font-extrabold">
              Настройки Groq
            </h3>
            <p className="mt-2 text-sm text-soft">
              Вставьте ключ один раз — мы сохраним его в этом браузере. Получить ключ можно в личном кабинете:
              <span className="font-semibold"> https://console.groq.com/keys</span>
            </p>

            <label className="mt-4 block" htmlFor="api-key">
              <span className="mb-2 block text-sm font-semibold text-soft">Groq API Key</span>
              <input
                id="api-key"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
              />
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="focus-ring rounded-2xl border border-main bg-card-soft px-4 py-3 text-sm font-semibold text-main transition hover:opacity-90"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveApiKey}
                className="focus-ring rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-accent-text transition hover:brightness-110"
              >
                Сохранить ключ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
