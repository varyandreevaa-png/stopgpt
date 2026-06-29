export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { text, style = 'casual', paid } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 5) {
    res.status(400).json({ error: 'Текст слишком короткий' }); return;
  }

  const isPaid = paid === true || paid === 'true';
  const MAX_CHARS = isPaid ? 8000 : 1500;

  if (text.length > MAX_CHARS) {
    res.status(400).json({ error: `Превышен лимит: ${text.length} из ${MAX_CHARS} симв.`, limit: MAX_CHARS });
    return;
  }

  const STYLE_HINTS = {
    casual:   'Пиши живо, разговорно, без пафоса — как сообщение другу.',
    academic: 'Пиши в академическом стиле: структурировано, грамотно, без штампов.',
    formal:   'Пиши в деловом стиле: официально, чётко, профессионально.',
  };
  const styleHint = STYLE_HINTS[style] || STYLE_HINTS.casual;

  const systemPrompt = `Ты — профессиональный редактор. Перепиши текст так, чтобы он звучал как написанный живым человеком, не ИИ. Правила: сохраняй смысл полностью; разнообразь длину предложений; убери фразы-штампы («в современном мире», «следует отметить», «таким образом», «необходимо подчеркнуть»); не добавляй объяснений — только переписанный текст. ${styleHint}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Перепиши этот текст:\n\n${text}` }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('Anthropic error:', data);
      res.status(500).json({ error: 'Ошибка API. Попробуйте ещё раз.' }); return;
    }

    const result = data.content?.[0]?.text || '';
    res.status(200).json({ result, chars_in: text.length, chars_out: result.length });
  } catch (err) {
    console.error('humanize error:', err);
    res.status(500).json({ error: 'Ошибка сервера. Попробуйте ещё раз.' });
  }
}
