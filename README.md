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

## Что делать дальше
1. Нажать кнопку **Deploy** (Netlify/Vercel автоматически подхватят настройки).
2. Вставить ключ Groq в окне **«Настройки»** на сайте.
3. Для реальной авторизации вставить данные Supabase (**Project URL** и **anon public key**) в том же окне.

## Реальная авторизация (email + код)
Приложение использует Supabase Auth:

1. Создайте проект в Supabase.
2. Включите Email OTP в Authentication.
3. Скопируйте в **Settings → API**:
   - `Project URL`
   - `anon public key`
4. Откройте сайт → **Настройки** → блок «Реальная авторизация через Supabase» и сохраните эти данные.
