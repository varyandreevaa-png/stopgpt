export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { text } = req.body;
  if (!text || text.length < 10) { res.status(400).json({ error: 'Текст слишком короткий' }); return; }

  const snippet = text.length > 3800 ? text.slice(0, 3800) + '…' : text;

  const prompt = `Ты — профессиональная система анализа текста на признаки ИИ-генерации и оригинальности.

ТЕКСТ:
"""
${snippet}
"""

Верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{"originality":<0-100>,"ai_probability":<0-100>,"readability":<0-100>,"verdict":"<3-6 слов>","orig_desc":"<5-7 слов>","ai_desc":"<5-7 слов>","read_desc":"<5-7 слов>","segments":[{"text":"<точный фрагмент>","type":"ai|plagiat|original","reason":"<причина>"}],"details":[{"type":"ai|plagiat|ok|info","title":"<заголовок>","body":"<1-2 предложения>"}]}

segments: 4-7 штук. details: 4-6 штук. Только JSON.`;

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
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(502).json({ error: err.error?.message || 'Ошибка Anthropic API: ' + response.status });
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
