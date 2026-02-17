# Просто.Онлайн

Готовый веб‑продукт на React + Vite + Tailwind CSS.

## Быстрый запуск

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

## Реальная авторизация по email (код из письма)

В проект добавлены серверные API-роуты (`/api/send-code`, `/api/verify-code`, `/api/session`) для настоящей отправки кода на почту.

Нужно задать переменные окружения (в Vercel/Netlify/локально):

```bash
AUTH_JWT_SECRET=your_long_random_secret
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=465
SMTP_USER=your_smtp_login
SMTP_PASS=your_smtp_password
SMTP_FROM="Prosto Online <no-reply@your-domain.com>"
```

После этого пользователь вводит email, получает код на почту и входит в приложение без заглушек.

## Что делать дальше
1. Нажать кнопку **Deploy** (Netlify/Vercel автоматически подхватят настройки).
2. Вставить ключ Groq в окне **«Настройки»** на сайте.
