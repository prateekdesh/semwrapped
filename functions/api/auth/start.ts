/// <reference types="@cloudflare/workers-types" />
import { startLogin } from '../../../src/index.js';

interface Env {
  PENDING_SESSIONS: KVNamespace;
}

function b64ToDataUri(b64: string): string {
  if (b64.startsWith('data:')) return b64;
  const head = b64.substring(0, 12);
  if (head.startsWith('/9j/') || head.startsWith('/9J/')) return `data:image/jpeg;base64,${b64}`;
  if (head.startsWith('iVBORw'))                            return `data:image/png;base64,${b64}`;
  if (head.startsWith('R0lGO'))                             return `data:image/gif;base64,${b64}`;
  return `data:image/jpeg;base64,${b64}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  try {
    const session = await startLogin();
    const id = crypto.randomUUID();
    await env.PENDING_SESSIONS.put(
      id,
      JSON.stringify({
        cookies: session.jar.serialize(),
        fpNonce: session.fpNonce,
        challengeId: session.challengeId,
        fpToken: session.fpToken,
        captchaFpToken: session.captchaFpToken,
      }),
      { expirationTtl: 600 },
    );
    return Response.json({ sessionId: id, captchaImage: b64ToDataUri(session.captchaImage) });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
