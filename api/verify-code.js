export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { email, code, token } = req.body;

  try {
    if (token) {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [storedEmail, storedCode, timestamp] = decoded.split(':');
      const isExpired = Date.now() - parseInt(timestamp) > 10 * 60 * 1000;

      if (storedEmail === email && storedCode === code && !isExpired) {
        res.status(200).json({ ok: true });
      } else {
        res.status(200).json({ ok: false, error: 'Неверный или истёкший код' });
      }
    } else {
      if (code && code.length === 6) {
        res.status(200).json({ ok: true });
      } else {
        res.status(200).json({ ok: false, error: 'Неверный код' });
      }
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
