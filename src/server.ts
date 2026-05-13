import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startLogin, login, LoginSession } from './auth.js';
import { fetchAll, loginAcademia, fetchAttendance } from './index.js';

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, '..', 'public')));

// Pending sessions: sessionId → LoginSession (live Playwright browser, max 5 min)
const pending = new Map<string, LoginSession>();
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, session] of pending) {
    if (Number(id.split('-')[0]) < cutoff) {
      session._browser.close().catch(() => {});
      pending.delete(id);
    }
  }
}, 60_000);

// Step 1 — start login, return captcha image
app.post('/api/auth/start', async (_req, res) => {
  try {
    const session = await startLogin();
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pending.set(sessionId, session);
    res.json({ sessionId, captchaImage: session.captchaImage });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Step 2 — complete login, fetch all data
app.post('/api/auth/login', async (req, res) => {
  const { sessionId, username, password, password2, captcha } = req.body as {
    sessionId: string;
    username: string;
    password: string;
    password2: string;
    captcha: string;
  };

  if (!sessionId || !username || !password || !password2 || !captcha) {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  const session = pending.get(sessionId);
  if (!session) {
    res.status(400).json({ error: 'Session expired. Please refresh the captcha.' });
    return;
  }
  pending.delete(sessionId);

  try {
    const academiaEmail = `${username.toLowerCase()}@srmist.edu.in`;
    const [jar, academiaJar] = await Promise.all([
      login(session, username, password, captcha),
      loginAcademia(academiaEmail, password2),
    ]);

    const [portalData, attendance] = await Promise.all([
      fetchAll(jar),
      fetchAttendance(academiaJar),
    ]);

    res.json({ ...portalData, attendance });
  } catch (err) {
    const msg = String(err);
    const status =
      msg.includes('Login failed') ||
      msg.includes('JSESSIONID') ||
      msg.includes('password auth failed') ||
      msg.includes('wrong credentials')
        ? 401
        : 500;
    res.status(status).json({ error: msg });
  }
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`\n  SemWrapped → http://localhost:${PORT}\n`);
});
