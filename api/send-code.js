import {
  CODE_COOLDOWN_SEC,
  CODE_TTL_SEC,
  assertEnv,
  createProofToken,
  makeCode,
  parseBody,
  sanitizeEmail,
  sendCodeEmail,
} from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    assertEnv()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { email, mode } = parseBody(req)
  const cleanEmail = sanitizeEmail(email)

  if (!cleanEmail) {
    return res.status(400).json({ error: 'Некорректный email.' })
  }

  if (!['login', 'signup'].includes(mode)) {
    return res.status(400).json({ error: 'Некорректный режим авторизации.' })
  }

  const code = makeCode()

  try {
    await sendCodeEmail({ email: cleanEmail, code })
  } catch {
    return res.status(502).json({ error: 'Не удалось отправить письмо. Проверьте SMTP-настройки.' })
  }

  const proofToken = createProofToken({
    email: cleanEmail,
    mode,
    code,
  })

  return res.status(200).json({
    ok: true,
    proofToken,
    expiresInSec: CODE_TTL_SEC,
    cooldownSec: CODE_COOLDOWN_SEC,
  })
}
