# СтопГПТ.ru — Инструкция по запуску

## Деплой на Vercel за 5 минут (БЕСПЛАТНО)

### Шаг 1 — Загрузи папку на GitHub
1. Зайди на github.com → New repository → назови `stopgpt`
2. Загрузи все файлы из этой папки (index.html, vercel.json, api/check.js)

### Шаг 2 — Подключи к Vercel
1. Зайди на vercel.com → Sign up (через GitHub)
2. New Project → выбери репозиторий `stopgpt`
3. Нажми Deploy

### Шаг 3 — Добавь API-ключ (ВАЖНО!)
1. В Vercel → Settings → Environment Variables
2. Добавь переменную:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-...` (твой ключ с console.anthropic.com)
3. Нажми Save → Redeploy

### Шаг 4 — Готово!
Сайт работает по адресу `https://stopgpt.vercel.app`
Пользователи открывают его без ключа — ключ спрятан на сервере.

## Подключение оплаты (ЮКасса)
1. Зарегистрируйся на yookassa.ru
2. В api/check.js найди функцию doPay() и вставь виджет ЮКассы
3. Или используй их готовую кнопку оплаты

## Структура файлов
```
stopgpt/
├── index.html        ← весь сайт (HTML + CSS + JS)
├── vercel.json       ← конфиг Vercel
├── api/
│   └── check.js      ← серверная функция (ключ Anthropic здесь)
└── README.md         ← эта инструкция
```
