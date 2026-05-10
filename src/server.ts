import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { startLogin, completeLogin, fetchAll, loginAcademia, fetchAttendance } from './index.js';
import type { LoginSession } from './types.js';

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, '..', 'public')));

interface PendingSession {
  session: LoginSession;
  created: number;
}

const pending = new Map<string, PendingSession>();

// Clean up sessions older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, entry] of pending) {
    if (entry.created < cutoff) pending.delete(id);
  }
}, 60_000);

// Detect MIME type from the leading base64 bytes (magic bytes approach)
function b64ToDataUri(b64: string): string {
  if (b64.startsWith('data:')) return b64;
  const head = b64.substring(0, 12);
  if (head.startsWith('/9j/') || head.startsWith('/9J/')) return `data:image/jpeg;base64,${b64}`;
  if (head.startsWith('iVBORw'))                            return `data:image/png;base64,${b64}`;
  if (head.startsWith('R0lGO'))                             return `data:image/gif;base64,${b64}`;
  // SRM's SCaptchaServlet reliably returns JPEG — safe default
  return `data:image/jpeg;base64,${b64}`;
}

app.post('/api/auth/start', async (_req, res) => {
  try {
    const session = await startLogin();
    const id = randomUUID();
    pending.set(id, { session, created: Date.now() });
    res.json({ sessionId: id, captchaImage: b64ToDataUri(session.captchaImage) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/auth/complete', async (req, res) => {
  const { sessionId, username, password, password2, captcha } = req.body as {
    sessionId: string;
    username: string;
    password: string;
    password2: string;
    captcha: string;
  };

  const entry = pending.get(sessionId);
  if (!entry) {
    res.status(400).json({ error: 'Session expired. Please refresh and try again.' });
    return;
  }

  try {
    // Both portals log in concurrently — SRM needs CAPTCHA, Academia uses email+password
    const academiaEmail = `${username.toLowerCase()}@srmist.edu.in`;
    const [jar, academiaJar] = await Promise.all([
      completeLogin(entry.session, username, password, captcha),
      loginAcademia(academiaEmail, password2),
    ]);
    pending.delete(sessionId);

    // Fetch portal data and attendance in parallel
    const [portalData, attendance] = await Promise.all([
      fetchAll(jar),
      fetchAttendance(academiaJar),
    ]);

    res.json({ ...portalData, attendance });
  } catch (err) {
    const msg = String(err);
    const status = msg.includes('Login failed') || msg.includes('JSESSIONID') || msg.includes('password auth failed') ? 401 : 500;
    res.status(status).json({ error: msg });
  }
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`\n  SemWrapped → http://localhost:${PORT}\n`);
});
