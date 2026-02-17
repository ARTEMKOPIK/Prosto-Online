import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'

export const CODE_LENGTH = 6
export const CODE_TTL_SEC = 10 * 60
export const CODE_COOLDOWN_SEC = 60
export const SESSION_TTL_SEC = 7 * 24 * 60 * 60

const normalizeEmail = (value = '') => value.trim().toLowerCase()
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const requiredEnv = [
  'AUTH_JWT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
]

export const assertEnv = () => {
  const missing = requiredEnv.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Server auth env is missing: ${missing.join(', ')}`)
  }
}

export const parseBody = (req) => {
  if (!req.body) {
    return {}
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  return req.body
}

const codeHash = (email, code) => crypto.createHash('sha256').update(`${email}:${code}`).digest('hex')

export const makeCode = () => String(Math.floor(Math.random() * 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')

export const createProofToken = ({ email, mode, code }) => {
  const secret = process.env.AUTH_JWT_SECRET
  return jwt.sign(
    {
      type: 'email_code',
      email,
      mode,
      codeHash: codeHash(email, code),
    },
    secret,
    { expiresIn: CODE_TTL_SEC },
  )
}

export const verifyProofToken = (proofToken) => jwt.verify(proofToken, process.env.AUTH_JWT_SECRET)

export const isCodeValid = ({ email, code, expectedHash }) => {
  const actual = codeHash(email, code)
  const a = Buffer.from(actual)
  const b = Buffer.from(expectedHash)

  if (a.length !== b.length) {
    return false
  }

  return crypto.timingSafeEqual(a, b)
}

export const createSessionToken = ({ email }) =>
  jwt.sign(
    {
      type: 'session',
      email,
    },
    process.env.AUTH_JWT_SECRET,
    { expiresIn: SESSION_TTL_SEC },
  )

export const verifySessionToken = (token) => jwt.verify(token, process.env.AUTH_JWT_SECRET)

export const getTransporter = () => {
  const port = Number(process.env.SMTP_PORT)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export const sendCodeEmail = async ({ email, code }) => {
  const transporter = getTransporter()

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Код входа: ${code}`,
    text: `Ваш код подтверждения: ${code}. Он действует 10 минут. Если это были не вы — просто проигнорируйте письмо.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.4"><h2>Код подтверждения</h2><p>Ваш код: <b style="font-size:24px;letter-spacing:3px">${code}</b></p><p>Код действует 10 минут.</p><p>Если это были не вы — просто проигнорируйте письмо.</p></div>`,
  })
}

export const sanitizeEmail = (email) => {
  const value = normalizeEmail(email)
  if (!isValidEmail(value)) {
    return null
  }

  return value
}
