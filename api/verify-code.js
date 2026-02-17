import {
  createSessionToken,
  parseBody,
  sanitizeEmail,
  verifyProofToken,
  isCodeValid,
} from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, mode, code, proofToken } = parseBody(req)
  const cleanEmail = sanitizeEmail(email)

  if (!cleanEmail || !proofToken || !code) {
    return res.status(400).json({ error: 'Недостаточно данных для проверки кода.' })
  }

  if (!/^\d{6}$/.test(String(code))) {
    return res.status(400).json({ error: 'Код должен содержать 6 цифр.' })
  }

  try {
    const payload = verifyProofToken(proofToken)

    if (payload.type !== 'email_code') {
      return res.status(401).json({ error: 'Некорректный токен подтверждения.' })
    }

    if (payload.email !== cleanEmail || payload.mode !== mode) {
      return res.status(401).json({ error: 'Код не подходит для этого email.' })
    }

    const valid = isCodeValid({
      email: cleanEmail,
      code: String(code),
      expectedHash: payload.codeHash,
    })

    if (!valid) {
      return res.status(401).json({ error: 'Неверный код подтверждения.' })
    }

    const sessionToken = createSessionToken({ email: cleanEmail })

    return res.status(200).json({
      ok: true,
      sessionToken,
    })
  } catch {
    return res.status(401).json({ error: 'Код устарел или недействителен. Запросите новый.' })
  }
}
