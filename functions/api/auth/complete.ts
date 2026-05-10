/// <reference types="@cloudflare/workers-types" />
import { completeLogin, fetchAll, loginAcademia, fetchAttendance } from '../../../src/index.js';
import { CookieJar } from '../../../src/client.js';
import type { LoginSession } from '../../../src/types.js';

interface Env {
  PENDING_SESSIONS: KVNamespace;
}

interface Body {
  sessionId: string;
  username: string;
  password: string;
  password2: string;
  captcha: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { sessionId, username, password, password2, captcha } = await request.json<Body>();

  const raw = await env.PENDING_SESSIONS.get(sessionId);
  if (!raw) {
    return Response.json({ error: 'Session expired. Please refresh and try again.' }, { status: 400 });
  }
  const stored = JSON.parse(raw) as {
    cookies: Record<string, string>;
    fpNonce: string;
    challengeId: string;
    fpToken: string;
    captchaFpToken: string;
  };
  await env.PENDING_SESSIONS.delete(sessionId);

  const session: LoginSession = {
    jar: CookieJar.deserialize(stored.cookies),
    fpNonce: stored.fpNonce,
    challengeId: stored.challengeId,
    fpToken: stored.fpToken,
    captchaFpToken: stored.captchaFpToken,
    captchaImage: '',
  };

  try {
    const academiaEmail = `${username.toLowerCase()}@srmist.edu.in`;
    const [jar, academiaJar] = await Promise.all([
      completeLogin(session, username, password, captcha),
      loginAcademia(academiaEmail, password2),
    ]);
    const [portalData, attendance] = await Promise.all([
      fetchAll(jar),
      fetchAttendance(academiaJar),
    ]);
    return Response.json({ ...portalData, attendance });
  } catch (err) {
    const msg = String(err);
    const status =
      msg.includes('Login failed') || msg.includes('JSESSIONID') || msg.includes('password auth failed')
        ? 401
        : 500;
    return Response.json({ error: msg }, { status });
  }
};
