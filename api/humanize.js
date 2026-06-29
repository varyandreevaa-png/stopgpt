import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STYLE_PROMPTS = {
  casual: 'Перепиши текст в неформальном, живом, разговорном стиле. Используй простые слова, короткие предложения, личный тон. Звучи как реальный человек, а не как ИИ.',
  academic: 'Перепиши текст в академическом стиле — структурированно, грамотно, но без излишней сухости. Разнообразь синтаксис, избегай повторяющихся конструкций.',
  formal: 'Перепиши текст в деловом стиле — официально, чётко, профессионально. Избегай канцеляризмов и штампов ИИ.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, style = 'casual', paid } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Текст обязателен' });

  const isPaid = paid === true || paid === 'true';
  const MAX_CHARS = isPaid ? 8000 : 1500;

  if (text.length > MAX_CHARS) {
    return res.status(400).json({
      error: `Превышен лимит символов: ${text.length} из ${MAX_CHARS}`,
      limit: MAX_CHARS,
    });
  }

  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.casual;

  const systemPrompt = `Ты — профессиональный редактор-гуманайзер. Твоя задача: переписать текст так, чтобы он звучал как написанный живым человеком, а не ИИ.

Правила:
- Сохраняй смысл и факты оригинала полностью
- Разнообразь длину предложений (коротких и длинных — поровну)
- Убери шаблонные вводные фразы: «в современном мире», «следует отметить», «таким образом», «необходимо подчеркнуть»
- Добавь живые детали, конкретику, личные наблюдения там, где уместно
- Не пиши объяснений — только переписанный текст
- ${stylePrompt}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Перепиши этот текст:\n\n${text}` }],
    });

    const result = response.content[0]?.text || '';
    return res.status(200).json({ result, chars_in: text.length, chars_out: result.length });
  } catch (err) {
    console.error('humanize error:', err);
    return res.status(500).json({ error: 'Ошибка обработки. Попробуйте ещё раз.' });
  }
}
