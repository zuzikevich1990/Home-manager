# Домашний менеджмент

Первый прототип семейного дашборда. Сейчас внутри два виджета заметок:

- Что смотрим
- Кактус

## Как открыть

Откройте файл `index.html` в браузере. Заметки сохраняются в `localStorage` конкретного браузера.

Если установлен Node.js, можно запустить локальный сервер:

```powershell
node server.mjs
```

После этого приложение будет доступно на `http://127.0.0.1:5173`.

Для проверки production-сборки:

```powershell
npm run build
```

## Дальше

Когда подключим GitHub-репозиторий и npm, проект можно перевести на React/Vite и добавить синхронизацию между устройствами.

## Telegram Mini App

Проект подготовлен к запуску как Telegram Mini App.

1. В Supabase откройте SQL Editor и выполните `supabase-schema.sql`.
2. Для локальной разработки скопируйте `config.example.js` в `config.js`.
3. В `config.js` укажите `Project URL` и `anon public key` из Supabase.
4. В Vercel добавьте переменные окружения `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` и `ALLOWED_TELEGRAM_IDS`.
5. В BotFather добавьте Vercel-домен приложения как Mini App URL.
6. После проверки API выполните `supabase-secure-access.sql`, чтобы закрыть публичный доступ к таблице.

`config.js` не коммитится в git. Для Vercel он создается автоматически во время `npm run build`.
