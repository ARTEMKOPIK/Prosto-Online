import { useEffect, useMemo, useState } from 'react'

const API_KEY_STORAGE = 'prosto-online-groq-key'

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

function App() {
  const [question, setQuestion] = useState('')
  const [level, setLevel] = useState('adult')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [savedApiKey, setSavedApiKey] = useState('')

  useEffect(() => {
    const key = localStorage.getItem(API_KEY_STORAGE) || ''
    setSavedApiKey(key)
    setApiKeyInput(key)
  }, [])

  const hasApiKey = useMemo(() => savedApiKey.trim().length > 0, [savedApiKey])

  const saveApiKey = () => {
    const cleaned = apiKeyInput.trim()
    localStorage.setItem(API_KEY_STORAGE, cleaned)
    setSavedApiKey(cleaned)
    setShowSettings(false)
    setError('')
  }

  const explain = async () => {
    if (!question.trim()) {
      setError('Напишите вопрос — и я сразу объясню без занудства 🙂')
      return
    }

    if (!hasApiKey) {
      setError('Сначала добавьте Groq API-ключ в настройках (кнопка «Настройки» сверху).')
      setShowSettings(true)
      return
    }

    setLoading(true)
    setError('')
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
              content: `Объясни это понятно: ${question}`,
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
    } catch (err) {
      setError(err.message || 'Что-то пошло не так, но мы уже почти у цели. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
              Просто.Онлайн
            </p>
            <h1 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
              Объясняем сложное
              <span className="text-blue-600"> простыми словами</span>
            </h1>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              Введите любой вопрос, выберите уровень, нажмите «Объяснить» — и получите понятный ответ за секунды.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Настройки
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Что нужно объяснить?</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="Например: Объясни, как работает ипотека простыми словами"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none ring-blue-200 transition focus:ring"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Уровень объяснения</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none ring-blue-200 transition focus:ring"
            >
              {Object.entries(levelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={explain}
            disabled={loading}
            className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? 'Объясняю...' : 'Объяснить'}
          </button>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Ответ</h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
              {answer || 'Здесь появится готовое понятное объяснение.'}
            </p>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-extrabold text-slate-900">Настройки Groq</h3>
            <p className="mt-2 text-sm text-slate-600">
              Вставьте ключ один раз — мы сохраним его в этом браузере. Получить ключ можно в личном кабинете:
              <span className="font-semibold"> https://console.groq.com/keys</span>
            </p>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Groq API Key</span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none ring-blue-200 transition focus:ring"
              />
            </label>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={saveApiKey}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white transition hover:bg-blue-500"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-2xl bg-slate-200 px-4 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
