export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { text, mode, paid } = req.body;
  if (!text || text.length < 10) {
    res.status(400).json({ error: 'Текст слишком короткий' }); return;
  }

  // ── Режим рекомендаций ─────────────────────────────────────────────────────
  if (mode === 'recommendations') {
    const sample = text.length > 4000 ? text.slice(0, 4000) : text;
    const recPrompt = `Ты эксперт по улучшению текстов на русском языке. Проанализируй текст и дай 4-5 конкретных практических рекомендаций — как сделать его более живым, человечным, убедительным. Рекомендации должны быть конкретными (не «добавьте детали», а «замените фразу X на Y»).

ТЕКСТ:
"""
${sample}
"""

Верни ТОЛЬКО JSON без markdown:
{"recommendations":["рекомендация 1","рекомендация 2","рекомендация 3","рекомендация 4"]}`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          temperature: 0.2,
          messages: [{ role: 'user', content: recPrompt }],
        }),
      });
      const data = await resp.json();
      const raw = data.content.map(b => b.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      res.status(200).json(parsed);
    } catch(e) {
      res.status(200).json({ recommendations: [
        'Замените общие фразы конкретными примерами из личного опыта',
        'Добавьте живые детали и эмоции в первый абзац',
        'Разбейте длинные предложения на более короткие',
        'Уберите канцелярские обороты: «в рамках», «следует отметить», «таким образом»'
      ]});
    }
    return;
  }

  // ── Умное сэмплирование текста ─────────────────────────────────────────────
  // Для платных проверок берём начало + середину + конец текста.
  // Для бесплатных — только первые 500 символов (без разметки).
  const isPaid = paid === true || paid === 'true';
  let snippet;
  let analysisNote = '';

  if (!isPaid || text.length <= 6000) {
    // Короткий текст или бесплатно — берём как есть (до 6000)
    snippet = text.slice(0, 6000);
  } else {
    // Длинный текст + платная проверка: начало + середина + конец
    const chunkSize = 2500;
    const mid = Math.floor(text.length / 2);
    const start = text.slice(0, chunkSize);
    const middle = text.slice(mid - Math.floor(chunkSize / 2), mid + Math.floor(chunkSize / 2));
    const end = text.slice(text.length - chunkSize);
    snippet = `[НАЧАЛО ТЕКСТА]\n${start}\n\n[СЕРЕДИНА ТЕКСТА]\n${middle}\n\n[КОНЕЦ ТЕКСТА]\n${end}`;
    analysisNote = `Анализ по репрезентативным фрагментам (начало, середина, конец) текста объёмом ${Math.round(text.length / 1000)}к символов.`;
  }

  // ── Основной анализ ────────────────────────────────────────────────────────
  // Для БЕСПЛАТНЫХ проверок: только базовые метрики, без разметки и деталей.
  // Для ПЛАТНЫХ: полный анализ с сегментами, деталями, вердиктом.

  const freePrompt = `Ты — система анализа текста на признаки ИИ-генерации. Дай БАЗОВУЮ оценку (без деталей).

ТЕКСТ (до 150 символов):
"""
${snippet.slice(0, 150)}
"""

Верни ТОЛЬКО JSON:
{"originality":<0-100>,"ai_probability":<0-100>,"readability":<0-100>,"verdict":"<3-4 слова>","orig_desc":"<5-6 слов>","ai_desc":"<5-6 слов>","read_desc":"<5-6 слов>"}`;

  const paidPrompt = `Ты — профессиональная система глубокого анализа текста на признаки ИИ-генерации. Будь СТРОГИМ и КОНКРЕТНЫМ.

КРИТЕРИИ ИИ-ТЕКСТА (русский язык):
1. Канцелярские клише: «данная работа», «в рамках», «следует отметить», «таким образом», «в данном контексте», «необходимо учитывать», «представляется возможным»
2. Синтетическая структура: все предложения 18-25 слов, одинаковый ритм
3. Отсутствие живого голоса: нет личного опыта, эмоций, неожиданных оборотов
4. Шаблонные переходы: «во-первых», «во-вторых», «таким образом», «подводя итог»
5. Избыточная нейтральность: нет позиции автора, всё сбалансировано и осторожно
6. Характерные паттерны GPT/GigaChat: «важно отметить», «стоит подчеркнуть», «следует признать»
7. Повторяющиеся конструкции: «X является Y, что позволяет Z»
8. Псевдо-академизм без реальных данных: много общих утверждений, мало конкретики

КРИТЕРИИ ОРИГИНАЛЬНОГО ТЕКСТА:
1. Личный опыт, конкретные примеры, имена
2. Разговорные обороты, юмор, живые метафоры
3. Разная длина предложений (от 3 до 40 слов)
4. Авторская позиция, субъективность
5. Неожиданные сравнения, нестандартные формулировки
${analysisNote ? '\nПРИМЕЧАНИЕ: ' + analysisNote : ''}

ТЕКСТ ДЛЯ АНАЛИЗА:
"""
${snippet}
"""

Проведи СТРОГИЙ анализ. При малейшем сомнении — повышай вероятность ИИ.
Верни ТОЛЬКО валидный JSON (без markdown):
{
  "originality": <целое 0-100>,
  "ai_probability": <целое 0-100>,
  "readability": <целое 0-100>,
  "verdict": "<вердикт 3-5 слов>",
  "orig_desc": "<5-7 слов>",
  "ai_desc": "<5-7 слов>",
  "read_desc": "<5-7 слов>",
  "segments": [
    {"text": "<точный фрагмент из текста, 15-40 слов>", "type": "ai|plagiat|original", "reason": "<конкретная причина — какой именно паттерн>"}
  ],
  "details": [
    {"type": "ai|plagiat|ok|info", "title": "<заголовок>", "body": "<2-3 предложения с конкретными цитатами из текста>"}
  ]
}

ПРАВИЛА:
- segments: 5-7 штук, ТОЧНЫЕ фрагменты из текста (проверяй что они там есть)
- details: 4-5 наблюдений с цитатами
- Если текст короткий (<300 символов) — segments может быть 2-3
- originality + ai_probability не обязаны давать 100 (это независимые метрики)`;

  const prompt = isPaid ? paidPrompt : freePrompt;
  const maxTokens = isPaid ? 2500 : 300;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(502).json({ error: err.error?.message || 'Ошибка API: ' + response.status });
      return;
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else { res.status(500).json({ error: 'Не удалось разобрать ответ модели' }); return; }
    }

    // Для бесплатных — принудительно убираем разметку и детали
    if (!isPaid) {
      parsed.segments = [];
      parsed.details = [];
      parsed._free = true;
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
