export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { text, mode } = req.body;
  if (!text || text.length < 10) { res.status(400).json({ error: 'Текст слишком короткий' }); return; }

  const snippet = text.length > 3800 ? text.slice(0, 3800) + '…' : text;

  // Режим рекомендаций
  if (mode === 'recommendations') {
    const recPrompt = `Ты эксперт по улучшению текстов. Проанализируй текст и дай 3-5 конкретных рекомендаций как сделать его более человечным и оригинальным.

ТЕКСТ:
"""
${snippet}
"""

Верни ТОЛЬКО JSON без markdown:
{"recommendations":["рекомендация 1","рекомендация 2","рекомендация 3"]}`;

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
          temperature: 0,
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
        'Разбейте длинные предложения на более короткие'
      ]});
    }
    return;
  }

  // Основной анализ
  const prompt = `Ты — профессиональная система анализа текста на признаки ИИ-генерации и оригинальности. Анализируй строго и последовательно по следующим критериям:

КРИТЕРИИ ОПРЕДЕЛЕНИЯ ИИ-ТЕКСТА:
1. Канцелярские клише: «данная работа», «в рамках», «следует отметить», «таким образом», «в контексте»
2. Однотипная длина предложений (18-25 слов)
3. Отсутствие личного опыта, эмоций, живых примеров
4. Перечисления через запятую без развития мысли
5. Формальный академический тон без авторского голоса
6. Повторяющиеся структуры предложений
7. Избыточное использование пассивного залога

КРИТЕРИИ ОРИГИНАЛЬНОГО ТЕКСТА:
1. Личный опыт и конкретные примеры
2. Разговорные обороты и живые метафоры
3. Разнообразие длины предложений
4. Эмоциональная вовлечённость
5. Неожиданные сравнения и наблюдения

ТЕКСТ ДЛЯ АНАЛИЗА:
"""
${snippet}
"""

Проведи детальный анализ и верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{
  "originality": <целое число 0-100, процент оригинальности>,
  "ai_probability": <целое число 0-100, вероятность ИИ-генерации>,
  "readability": <целое число 0-100, читаемость>,
  "verdict": "<вердикт 3-5 слов>",
  "orig_desc": "<5-7 слов о оригинальности>",
  "ai_desc": "<5-7 слов о признаках ИИ>",
  "read_desc": "<5-7 слов о читаемости>",
  "segments": [
    {"text": "<точный фрагмент из текста>", "type": "ai|plagiat|original", "reason": "<конкретная причина>"}
  ],
  "details": [
    {"type": "ai|plagiat|ok|info", "title": "<заголовок>", "body": "<1-2 предложения с конкретными примерами из текста>"}
  ]
}

ПРАВИЛА:
- segments: 4-6 штук, используй ТОЧНЫЕ фрагменты из оригинального текста
- details: 4-5 наблюдений с конкретными цитатами из текста
- Будь конкретен: указывай какие именно слова/фразы являются признаками ИИ
- Только JSON, ничего лишнего`;

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
        max_tokens: 2000,
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

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
