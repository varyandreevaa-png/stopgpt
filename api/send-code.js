export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Некорректный email' }); return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      res.status(200).json({ ok: true, dev_code: code });
      return;
    }

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'СтопГПТ <noreply@stopgpt.ru>',
        to: email,
        subject: 'Ваш код входа в СтопГПТ',
        html: `<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:32px"><h2>СтопГПТ.ru</h2><p style="color:#555">Ваш код для входа:</p><div style="background:#f5f5f5;border-radius:10px;padding:24px;text-align:center"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111">${code}</span></div><p style="color:#888;font-size:13px">Код действителен 10 минут.</p></div>`,
      }),
    });

    if (!emailResp.ok) {
      const err = await emailResp.json();
      throw new Error(err.message || 'Ошибка отправки');
    }

    const encoded = Buffer.from(`${email}:${code}:${Date.now()}`).toString('base64');
    res.status(200).json({ ok: true, token: encoded });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
