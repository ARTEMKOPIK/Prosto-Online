import { parseBody, verifySessionToken } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionToken } = parseBody(req)

  if (!sessionToken) {
    return res.status(400).json({ error: 'Токен сессии не передан.' })
  }

  try {
    const payload = verifySessionToken(sessionToken)
    if (payload.type !== 'session' || !payload.email) {
      return res.status(401).json({ error: 'Неверный токен сессии.' })
    }

    return res.status(200).json({ ok: true, email: payload.email })
  } catch {
    return res.status(401).json({ error: 'Сессия недействительна.' })
  }
}
