import { useEffect, useMemo, useRef, useState } from 'react'

const API_KEY_STORAGE = 'prosto-online-groq-key'
const THEME_STORAGE = 'prosto-online-theme'
const LEVEL_STORAGE = 'prosto-online-level'
const DRAFT_STORAGE = 'prosto-online-question-draft'
const MODE_STORAGE = 'prosto-online-mode'
const HISTORY_STORAGE = 'prosto-online-history'
const SUPABASE_URL_STORAGE = 'prosto-online-supabase-url'
const SUPABASE_ANON_STORAGE = 'prosto-online-supabase-anon'
const AUTH_PENDING_STORAGE = 'prosto-online-auth-pending'
const AUTH_SESSION_STORAGE = 'prosto-online-auth-session'
const MAX_QUESTION_LENGTH = 350
const MAX_HISTORY_ITEMS = 10
const CODE_LENGTH = 6
const CODE_COOLDOWN_SECONDS = 60

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

const lifeModes = {
  fast: {
    label: 'Быстро за 30 секунд',
    prompt: 'Ответ дай очень коротко: максимум 4-5 предложений и только самое главное.',
  },
  exam: {
    label: 'Перед экзаменом',
    prompt: 'Объясняй так, чтобы легче запомнить: структура, ключевые тезисы, мини-шпаргалка в конце.',
  },
  parents: {
    label: 'Для разговора с родителями',
    prompt: 'Объясняй спокойно и по-доброму, чтобы можно было пересказать дома без споров.',
  },
  interview: {
    label: 'Для собеседования',
    prompt: 'Сфокусируйся на практической стороне и формулировках, которые звучат уверенно в разговоре.',
  },
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

const templateCards = [
  {
    title: 'Деньги и бюджет',
    question: 'Объясни, как накопить финансовую подушку без жёсткой экономии',
  },
  {
    title: 'Техника дома',
    question: 'Почему телефон быстро разряжается и как это исправить?',
  },
  {
    title: 'Здоровье',
    question: 'Объясни простыми словами, как укреплять иммунитет каждый день',
  },
  {
    title: 'Документы и жизнь',
    question: 'Как работает ипотека простыми словами и на что смотреть в договоре?',
  },
]

const buildReliability = (answerText) => {
  const text = answerText.trim()

  if (!text) {
    return { level: '—', description: 'Пока нет ответа для оценки надёжности.' }
  }

  const lowConfidenceWords = ['возможно', 'может', 'примерно', 'иногда', 'зависит']
  const textLower = text.toLowerCase()
  const hasLowConfidenceWords = lowConfidenceWords.some((word) => textLower.includes(word))

  if (text.length < 220 || hasLowConfidenceWords) {
    return {
      level: 'Средний',
      description: 'Похоже на рабочее объяснение, но лучше перепроверить цифры и важные факты.',
    }
  }

  return {
    level: 'Высокий',
    description: 'Ответ выглядит уверенным и подробным. Всё равно полезно перепроверить важные решения.',
  }
}

const buildCheckQuestions = (questionText) => {
  if (!questionText.trim()) {
    return []
  }

  return [
    'Сможете объяснить эту тему своими словами в 2-3 коротких предложениях?',
    'Какой один практический шаг вы готовы сделать сегодня по этой теме?',
  ]
}

const normalizeEmail = (value) => value.trim().toLowerCase()
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const sanitizeSupabaseUrl = (value) => value.trim().replace(/\/$/, '')

const buildSupabaseHeaders = (anonKey) => ({
  'Content-Type': 'application/json',
  apikey: anonKey,
})

const parseApiJson = async (response) => {
  const raw = await response.text()

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function App() {
  const [question, setQuestion] = useState('')
  const [level, setLevel] = useState('adult')
  const [lifeMode, setLifeMode] = useState('fast')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [savedApiKey, setSavedApiKey] = useState('')
  const [theme, setTheme] = useState('light')
  const [showApiKey, setShowApiKey] = useState(false)
  const [history, setHistory] = useState([])
  const [selfCheck, setSelfCheck] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authPending, setAuthPending] = useState(null)
  const [authSession, setAuthSession] = useState(null)
  const [authNotice, setAuthNotice] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('')
  const [supabaseAnonInput, setSupabaseAnonInput] = useState('')
  const [savedSupabaseUrl, setSavedSupabaseUrl] = useState('')
  const [savedSupabaseAnon, setSavedSupabaseAnon] = useState('')
  const [showSupabaseAnon, setShowSupabaseAnon] = useState(false)
  const [now, setNow] = useState(Date.now())

  const questionRef = useRef(null)
  const settingsPanelRef = useRef(null)

  useEffect(() => {
    const key = localStorage.getItem(API_KEY_STORAGE) || ''
    const savedTheme = localStorage.getItem(THEME_STORAGE) || 'light'
    const savedLevel = localStorage.getItem(LEVEL_STORAGE) || 'adult'
    const savedDraft = localStorage.getItem(DRAFT_STORAGE) || ''
    const savedMode = localStorage.getItem(MODE_STORAGE) || 'fast'
    const savedSupabaseUrlValue = localStorage.getItem(SUPABASE_URL_STORAGE) || ''
    const savedSupabaseAnonValue = localStorage.getItem(SUPABASE_ANON_STORAGE) || ''
    const rawHistory = localStorage.getItem(HISTORY_STORAGE) || '[]'

    const hasTheme = themeOptions.some((option) => option.value === savedTheme)
    const hasLevel = Object.hasOwn(levelLabels, savedLevel)
    const hasMode = Object.hasOwn(lifeModes, savedMode)

    let parsedHistory = []
    try {
      const json = JSON.parse(rawHistory)
      if (Array.isArray(json)) {
        parsedHistory = json.filter((item) => item?.question && item?.answer).slice(0, MAX_HISTORY_ITEMS)
      }
    } catch {
      parsedHistory = []
    }

    setSavedApiKey(key)
    setApiKeyInput(key)
    setTheme(hasTheme ? savedTheme : 'light')
    setLevel(hasLevel ? savedLevel : 'adult')
    setLifeMode(hasMode ? savedMode : 'fast')
    setQuestion(savedDraft.slice(0, MAX_QUESTION_LENGTH))
    setHistory(parsedHistory)
    setSupabaseUrlInput(savedSupabaseUrlValue)
    setSupabaseAnonInput(savedSupabaseAnonValue)
    setSavedSupabaseUrl(savedSupabaseUrlValue)
    setSavedSupabaseAnon(savedSupabaseAnonValue)

    const rawPending = localStorage.getItem(AUTH_PENDING_STORAGE)
    const rawSession = localStorage.getItem(AUTH_SESSION_STORAGE)

    if (rawPending) {
      try {
        const parsedPending = JSON.parse(rawPending)
        if (parsedPending?.email && parsedPending?.expiresAt > Date.now()) {
          setAuthPending(parsedPending)
          setAuthEmail(parsedPending.email)
          setAuthMode(parsedPending.type || 'login')
          setAuthNotice(`Код уже отправлен на ${parsedPending.email}. Проверьте почту и введите ${CODE_LENGTH} цифр.`)
        }
      } catch {
        localStorage.removeItem(AUTH_PENDING_STORAGE)
      }
    }

    if (rawSession) {
      try {
        const parsedSession = JSON.parse(rawSession)
        if (parsedSession?.email) {
          setAuthSession(parsedSession)
          setAuthEmail(parsedSession.email)
        }
      } catch {
        localStorage.removeItem(AUTH_SESSION_STORAGE)
      }
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_STORAGE, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(LEVEL_STORAGE, level)
  }, [level])

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE, lifeMode)
  }, [lifeMode])

  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE, question)
  }, [question])

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    if (authPending) {
      localStorage.setItem(AUTH_PENDING_STORAGE, JSON.stringify(authPending))
      return
    }

    localStorage.removeItem(AUTH_PENDING_STORAGE)
  }, [authPending])

  useEffect(() => {
    if (authSession) {
      localStorage.setItem(AUTH_SESSION_STORAGE, JSON.stringify(authSession))
      return
    }

    localStorage.removeItem(AUTH_SESSION_STORAGE)
  }, [authSession])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (authPending && authPending.expiresAt <= now) {
      setAuthPending(null)
      setAuthCode('')
      setAuthNotice('Старый код истёк. Нажмите «Отправить код» снова.')
    }
  }, [authPending, now])

  useEffect(() => {
    if (showSettings) {
      settingsPanelRef.current?.focus()
      return
    }

    questionRef.current?.focus()
  }, [showSettings])

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const hasApiKey = useMemo(() => savedApiKey.trim().length > 0, [savedApiKey])
  const hasSupabaseConfig = useMemo(
    () => Boolean(savedSupabaseUrl.trim() && savedSupabaseAnon.trim()),
    [savedSupabaseAnon, savedSupabaseUrl],
  )
  const trimmedQuestion = question.trim()
  const isAuthed = Boolean(authSession?.email)
  const canExplain = isAuthed && trimmedQuestion.length > 3 && !loading && question.length <= MAX_QUESTION_LENGTH
  const questionLength = question.length
  const remainingChars = MAX_QUESTION_LENGTH - questionLength
  const isNearLimit = remainingChars <= 50
  const reliability = useMemo(() => buildReliability(answer), [answer])
  const isCodeFlowActive = Boolean(authPending)
  const cooldownLeft = authPending ? Math.max(0, Math.ceil((authPending.cooldownUntil - now) / 1000)) : 0
  const expiresIn = authPending ? Math.max(0, Math.ceil((authPending.expiresAt - now) / 1000)) : 0

  const saveAuthSettings = () => {
    const cleanedUrl = sanitizeSupabaseUrl(supabaseUrlInput)
    const cleanedAnon = supabaseAnonInput.trim()

    localStorage.setItem(SUPABASE_URL_STORAGE, cleanedUrl)
    localStorage.setItem(SUPABASE_ANON_STORAGE, cleanedAnon)

    setSupabaseUrlInput(cleanedUrl)
    setSupabaseAnonInput(cleanedAnon)
    setSavedSupabaseUrl(cleanedUrl)
    setSavedSupabaseAnon(cleanedAnon)
    setAuthError('')

    if (!cleanedUrl || !cleanedAnon) {
      setStatus('Реальная авторизация отключена: заполните URL и ANON KEY от Supabase.')
      return
    }

    setStatus('Настройки авторизации сохранены. Теперь вход работает через реальный Supabase.')
  }

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

  const addToHistory = (questionText, answerText) => {
    const entry = {
      id: Date.now(),
      question: questionText,
      answer: answerText,
      level,
      mode: lifeModes[lifeMode].label,
      createdAt: new Date().toISOString(),
    }

    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY_ITEMS))
  }

  const requestEmailCode = () => {
    if (!hasSupabaseConfig) {
      setAuthError('Сначала откройте «Настройки» и добавьте Supabase URL + ANON KEY.')
      setShowSettings(true)
      return
    }

    const email = normalizeEmail(authEmail)

    if (!isValidEmail(email)) {
      setAuthError('Введите корректную почту, например name@mail.ru.')
      return
    }

    if (authPending && cooldownLeft > 0) {
      setAuthError(`Подождите ${cooldownLeft} сек. и отправьте код снова.`)
      return
    }

    setAuthLoading(true)
    setAuthError('')
    setAuthNotice('Отправляем письмо с кодом...')

    const endpoint = `${savedSupabaseUrl}/auth/v1/otp`

    fetch(endpoint, {
      method: 'POST',
      headers: buildSupabaseHeaders(savedSupabaseAnon),
      body: JSON.stringify({
        email,
        create_user: authMode === 'signup',
      }),
    })
      .then(async (response) => {
        const data = await parseApiJson(response)

        if (!response.ok) {
          const apiMessage = data?.msg || data?.error_description || data?.error || 'Не удалось отправить код.'
          throw new Error(apiMessage)
        }

        const pending = {
          email,
          type: authMode,
          expiresAt: Date.now() + 10 * 60 * 1000,
          cooldownUntil: Date.now() + CODE_COOLDOWN_SECONDS * 1000,
        }

        setAuthPending(pending)
        setAuthCode('')
        setAuthEmail(email)
        setAuthError('')
        setAuthNotice(`Готово! Код отправлен на ${email}. Проверьте почту.`)
      })
      .catch((err) => {
        setAuthError(err.message || 'Не получилось отправить код. Попробуйте ещё раз.')
      })
      .finally(() => {
        setAuthLoading(false)
      })
  }

  const verifyEmailCode = async () => {
    if (!hasSupabaseConfig) {
      setAuthError('Нужно добавить Supabase URL и ANON KEY в «Настройки».')
      setShowSettings(true)
      return
    }

    if (!authPending) {
      setAuthError('Сначала нажмите «Отправить код».')
      return
    }

    const enteredCode = authCode.trim()
    if (!/^\d{6}$/.test(enteredCode)) {
      setAuthError('Код должен состоять из 6 цифр.')
      return
    }

    if (authPending.expiresAt <= Date.now()) {
      setAuthPending(null)
      setAuthCode('')
      setAuthError('Код истёк. Отправьте новый.')
      return
    }

    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await fetch(`${savedSupabaseUrl}/auth/v1/verify`, {
        method: 'POST',
        headers: buildSupabaseHeaders(savedSupabaseAnon),
        body: JSON.stringify({
          email: authPending.email,
          token: enteredCode,
          type: 'email',
        }),
      })

      const data = await parseApiJson(response)

      if (!response.ok) {
        const apiMessage = data?.msg || data?.error_description || data?.error || 'Код не подошёл.'
        throw new Error(apiMessage)
      }

      const session = {
        email: data?.user?.email || authPending.email,
        accessToken: data?.access_token || '',
        refreshToken: data?.refresh_token || '',
        signedInAt: new Date().toISOString(),
      }

      setAuthSession(session)
      setAuthPending(null)
      setAuthCode('')
      setAuthError('')
      setAuthNotice(`Готово! Вы вошли как ${session.email}.`)
      setStatus('Авторизация прошла успешно. Теперь доступны все функции.')
    } catch (err) {
      setAuthError(err.message || 'Код не подошёл. Проверьте цифры и попробуйте снова.')
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = () => {
    setAuthSession(null)
    setAuthCode('')
    setAuthPending(null)
    setAuthMode('login')
    setAuthNotice('Вы вышли из аккаунта. Чтобы продолжить, снова подтвердите вход.')
  }

  const explain = async (customPrompt = trimmedQuestion) => {
    const prompt = customPrompt.trim()

    if (prompt.length < 4) {
      setError('Добавьте чуть больше деталей (минимум 4 символа), и я всё разложу по полочкам.')
      return
    }

    if (questionLength > MAX_QUESTION_LENGTH && customPrompt === trimmedQuestion) {
      setError(`Сделайте вопрос чуть короче. Лимит: ${MAX_QUESTION_LENGTH} символов.`)
      return
    }

    if (!isAuthed) {
      setError('Сначала войдите через почту и код подтверждения.')
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
              content: `${levelPrompts[level]} ${lifeModes[lifeMode].prompt}`,
            },
            {
              role: 'user',
              content: `Объясни это понятно: ${prompt}`,
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
      setSelfCheck(buildCheckQuestions(prompt))
      addToHistory(prompt, text)
      setStatus('Готово! Ответ ниже. Если нужно — скопируйте одной кнопкой.')
    } catch (err) {
      setError(err.message || 'Что-то пошло не так, но мы уже почти у цели. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  const explainSimpler = () => {
    if (!answer.trim()) {
      setStatus('Сначала нужен обычный ответ, потом сделаем ещё проще.')
      return
    }

    explain(`Сделай объяснение ещё проще и короче, с 1 бытовым примером: ${answer}`)
  }

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      setError('В этом браузере нет голосового режима. Попробуйте открыть сайт в Chrome или Edge.')
      return
    }

    if (!answer.trim()) {
      setStatus('Сначала получите ответ, и я смогу его озвучить.')
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setStatus('Озвучку остановили.')
      return
    }

    const utterance = new SpeechSynthesisUtterance(answer)
    utterance.lang = 'ru-RU'
    utterance.rate = 1
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => {
      setIsSpeaking(false)
      setError('Не вышло запустить озвучку. Попробуйте ещё раз.')
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
    setStatus('Читаю вслух. Можно слушать и заниматься своими делами.')
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
        <section className="mb-5 rounded-2xl border border-main bg-card-soft p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-soft">Вход по почте с кодом подтверждения</p>
            {isAuthed ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Выполнен вход</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Требуется вход</span>
            )}
          </div>

          {!isAuthed ? (
            <>
              <div className="mb-3 inline-flex rounded-2xl border border-main p-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthError('')
                  }}
                  className={`focus-ring rounded-xl px-3 py-2 font-semibold ${authMode === 'login' ? 'bg-main-button text-main-button-text' : 'text-main'}`}
                >
                  Вход
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup')
                    setAuthError('')
                  }}
                  className={`focus-ring rounded-xl px-3 py-2 font-semibold ${authMode === 'signup' ? 'bg-main-button text-main-button-text' : 'text-main'}`}
                >
                  Регистрация
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2" htmlFor="auth-email-input">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-soft">Email</span>
                  <input
                    id="auth-email-input"
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="name@mail.ru"
                    className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
                  />
                </label>

                <button
                  type="button"
                  onClick={requestEmailCode}
                  disabled={Boolean((authPending && cooldownLeft > 0) || authLoading)}
                  className="focus-ring rounded-2xl bg-main-button px-4 py-3 text-sm font-semibold text-main-button-text transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authLoading
                    ? 'Отправляем...'
                    : authPending && cooldownLeft > 0
                      ? `Отправить снова через ${cooldownLeft} сек`
                      : 'Отправить код'}
                </button>

                <label className="block" htmlFor="auth-code-input">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-soft">Код из письма</span>
                  <input
                    id="auth-code-input"
                    type="text"
                    inputMode="numeric"
                    value={authCode}
                    maxLength={CODE_LENGTH}
                    onChange={(event) => setAuthCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base tracking-[0.25em] text-main"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={verifyEmailCode}
                disabled={!isCodeFlowActive || authLoading}
                className="focus-ring mt-3 w-full rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-accent-text transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading ? 'Проверяем...' : 'Подтвердить и войти'}
              </button>

              {isCodeFlowActive && (
                <p className="mt-2 text-xs text-soft">Код действителен ещё {expiresIn} сек.</p>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-100/70 px-4 py-3 text-sm text-emerald-900">
              <p>
                Вы вошли как <span className="font-bold">{authSession.email}</span>. Все функции открыты ✅
              </p>
              <button
                type="button"
                onClick={logout}
                className="focus-ring rounded-xl border border-emerald-400 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:-translate-y-0.5"
              >
                Выйти
              </button>
            </div>
          )}

          {authNotice && <p className="mt-3 rounded-xl border border-sky-300 bg-sky-100 px-3 py-2 text-sm text-sky-900">{authNotice}</p>}
          {authError && <p className="mt-3 rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-sm text-rose-800">{authError}</p>}
        </section>

        {!hasApiKey && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-100/90 p-4 text-sm text-amber-900">
            <p className="font-bold">Первый запуск за 3 шага:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Нажмите кнопку «Настройки» справа сверху.</li>
              <li>Вставьте ваш ключ Groq и данные Supabase (URL + ANON KEY).</li>
              <li>Введите вопрос и нажмите «Объяснить».</li>
            </ol>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="inline-flex rounded-full bg-badge px-3 py-1 text-xs font-bold text-badge-text">Просто.Онлайн</p>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${hasApiKey ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {hasApiKey ? 'Ключ подключён' : 'Добавьте API-ключ'}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              Объясняем сложное
              <span className="text-accent"> простыми словами</span>
            </h1>
            <p className="mt-3 text-base text-soft sm:text-lg">
              Введите вопрос, выберите формат и получите понятный ответ. Горячая клавиша: Ctrl + Enter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="focus-ring shrink-0 rounded-2xl bg-main-button px-4 py-3 text-sm font-semibold text-main-button-text transition hover:-translate-y-0.5 hover:opacity-90"
          >
            Настройки
          </button>
        </div>

        <div className="mb-4 grid gap-3 rounded-2xl border border-main bg-card-soft px-4 py-3 sm:grid-cols-2">
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

          <label className="block" htmlFor="level-select-inline">
            <span className="mb-2 block text-sm font-semibold text-soft">Кому объяснять</span>
            <select
              id="level-select-inline"
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

          <label className="block sm:col-span-2" htmlFor="mode-select-inline">
            <span className="mb-2 block text-sm font-semibold text-soft">Режим жизни</span>
            <select
              id="mode-select-inline"
              value={lifeMode}
              onChange={(e) => setLifeMode(e.target.value)}
              className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
            >
              {Object.entries(lifeModes).map(([value, mode]) => (
                <option key={value} value={value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-4 rounded-2xl border border-main bg-card-soft p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-soft">Готовые сценарии</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {templateCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setQuestion(card.question)}
                className="focus-ring rounded-2xl border border-main bg-input p-3 text-left transition hover:-translate-y-0.5"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-soft">{card.title}</p>
                <p className="mt-1 text-sm font-semibold text-main">{card.question}</p>
              </button>
            ))}
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canExplain) {
              explain()
            }
          }}
        >
          <label className="block" htmlFor="question-input">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="block text-sm font-semibold text-soft">Что нужно объяснить?</span>
              <span className={`text-xs font-semibold ${questionLength > MAX_QUESTION_LENGTH ? 'text-rose-600' : isNearLimit ? 'text-amber-600' : 'text-soft'}`}>
                {questionLength}/{MAX_QUESTION_LENGTH}
              </span>
            </div>
            <textarea
              ref={questionRef}
              id="question-input"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))
                if (error) {
                  setError('')
                }
              }}
              onKeyDown={onQuestionKeyDown}
              rows={5}
              placeholder="Например: Объясни, как работает ипотека простыми словами"
              className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
              aria-describedby="question-help"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p id="question-help" className="text-xs text-soft">
                Чем конкретнее вопрос, тем полезнее ответ.
              </p>
              <p className={`text-xs font-semibold ${isNearLimit ? 'text-amber-600' : 'text-soft'}`}>
                {remainingChars >= 0 ? `Осталось ${remainingChars} симв.` : 'Слишком длинный вопрос'}
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-main/10" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all ${questionLength > MAX_QUESTION_LENGTH ? 'bg-rose-500' : isNearLimit ? 'bg-amber-500' : 'bg-accent'}`}
                style={{ width: `${Math.min((questionLength / MAX_QUESTION_LENGTH) * 100, 100)}%` }}
              />
            </div>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={!canExplain}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-lg font-bold text-accent-text transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <span className="loader-dot" aria-hidden="true" />}
              {loading ? 'Объясняю…' : 'Объяснить'}
            </button>

            <button
              type="button"
              onClick={explainSimpler}
              disabled={loading || !answer.trim()}
              className="focus-ring w-full rounded-2xl border border-main bg-card-soft px-5 py-4 text-sm font-bold text-main transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ещё проще
            </button>

            <button
              type="button"
              onClick={() => {
                setQuestion('')
                setAnswer('')
                setError('')
                setSelfCheck([])
                setStatus('Поле очищено. Можно задать новый вопрос.')
              }}
              className="focus-ring w-full rounded-2xl border border-main bg-card-soft px-5 py-4 text-sm font-bold text-main transition hover:opacity-90 sm:max-w-40"
            >
              Очистить
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        )}

        {status && (
          <p role="status" aria-live="polite" className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
            {status}
          </p>
        )}

        <div className="mt-4 rounded-2xl border border-main bg-card-soft p-4" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Ответ</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyAnswer}
                disabled={!answer.trim()}
                className="focus-ring rounded-xl border border-main bg-input px-3 py-2 text-xs font-bold text-main transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Копировать
              </button>
              <button
                type="button"
                onClick={toggleSpeech}
                disabled={!answer.trim()}
                className="focus-ring rounded-xl border border-main bg-input px-3 py-2 text-xs font-bold text-main transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSpeaking ? 'Остановить голос' : 'Слушать голосом'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="skeleton-line h-4 w-11/12 rounded" />
              <div className="skeleton-line h-4 w-full rounded" />
              <div className="skeleton-line h-4 w-10/12 rounded" />
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-base leading-relaxed text-main">
              {answer || 'Здесь появится готовое понятное объяснение. Пока можно выбрать сценарий выше и нажать «Объяснить».'}
            </p>
          )}

          <div className="mt-4 rounded-xl border border-main bg-input p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-soft">Надёжность ответа: {reliability.level}</p>
            <p className="mt-1 text-sm text-main">{reliability.description}</p>
          </div>

          {selfCheck.length > 0 && (
            <div className="mt-4 rounded-xl border border-main bg-input p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-soft">Мини-проверка понимания</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-main">
                {selfCheck.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-main bg-card-soft p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">История последних объяснений</h2>
            <button
              type="button"
              onClick={() => {
                setHistory([])
                setStatus('История очищена.')
              }}
              className="focus-ring rounded-xl border border-main bg-input px-3 py-2 text-xs font-bold text-main"
            >
              Очистить историю
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-soft">Пока пусто. Первый ответ появится здесь автоматически.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setQuestion(item.question)
                    setAnswer(item.answer)
                    setSelfCheck(buildCheckQuestions(item.question))
                    setStatus('Открыли ответ из истории.')
                  }}
                  className="focus-ring w-full rounded-2xl border border-main bg-input p-3 text-left"
                >
                  <p className="text-xs font-semibold text-soft">{item.mode} · {item.level}</p>
                  <p className="mt-1 text-sm font-semibold text-main">{item.question}</p>
                </button>
              ))}
            </div>
          )}
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
            <div className="flex items-start justify-between gap-3">
              <h3 id="settings-title" className="text-2xl font-extrabold">
                Настройки Groq
              </h3>
              <button
                type="button"
                className="focus-ring rounded-xl border border-main px-3 py-2 text-xs font-bold"
                onClick={() => setShowSettings(false)}
                aria-label="Закрыть настройки"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-soft">
              Вставьте ключ один раз — мы сохраним его в этом браузере. Получить ключ можно в личном кабинете:
              <span className="font-semibold"> https://console.groq.com/keys</span>
            </p>

            <div className="mt-4 rounded-2xl border border-main bg-card-soft p-4">
              <p className="text-sm font-bold text-main">Реальная авторизация через Supabase</p>
              <p className="mt-1 text-xs text-soft">
                Откройте Supabase → Settings → API и вставьте Project URL и anon public key.
              </p>

              <label className="mt-3 block" htmlFor="supabase-url">
                <span className="mb-2 block text-sm font-semibold text-soft">Supabase Project URL</span>
                <input
                  id="supabase-url"
                  type="url"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://xxxxx.supabase.co"
                  className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
                />
              </label>

              <label className="mt-3 block" htmlFor="supabase-anon">
                <span className="mb-2 block text-sm font-semibold text-soft">Supabase ANON KEY</span>
                <div className="flex gap-2">
                  <input
                    id="supabase-anon"
                    type={showSupabaseAnon ? 'text' : 'password'}
                    value={supabaseAnonInput}
                    onChange={(e) => setSupabaseAnonInput(e.target.value)}
                    placeholder="eyJ..."
                    className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupabaseAnon((prev) => !prev)}
                    className="focus-ring rounded-2xl border border-main bg-card-soft px-3 py-2 text-xs font-bold"
                  >
                    {showSupabaseAnon ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
              </label>

              <button
                type="button"
                onClick={saveAuthSettings}
                className="focus-ring mt-3 rounded-2xl border border-main bg-input px-4 py-3 text-sm font-bold text-main"
              >
                Сохранить настройки авторизации
              </button>
            </div>

            <label className="mt-4 block" htmlFor="api-key">
              <span className="mb-2 block text-sm font-semibold text-soft">Groq API Key</span>
              <div className="flex gap-2">
                <input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="gsk_..."
                  className="focus-ring w-full rounded-2xl border border-main bg-input px-4 py-3 text-base text-main"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="focus-ring rounded-2xl border border-main bg-card-soft px-3 py-2 text-xs font-bold"
                >
                  {showApiKey ? 'Скрыть' : 'Показать'}
                </button>
              </div>
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
