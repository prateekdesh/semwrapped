import { CookieJar } from '../client.js';
import {
  ACADEMIA_BASE,
  ACCOUNTS_BASE,
  academiaGet,
  academiaPostForm,
  academiaPostJson,
} from './client.js';

const SERVICE_URL = `${ACADEMIA_BASE}/portal/academia-academic-services/redirectFromLogin`;

async function deleteBlockSessions(jar: CookieJar, iamcsr: string): Promise<string | undefined> {
  const res = await fetch(`${ACCOUNTS_BASE}/webclient/v1/announcement/pre/blocksessions`, {
    method: 'DELETE',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-ZCSRF-TOKEN': `iamcsrcoo=${encodeURIComponent(iamcsr)}`,
      Cookie: jar.toString(),
    },
  });
  jar.update(res.headers);
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { redirect_url?: string };
    return data.redirect_url ?? undefined;
  } catch {
    return undefined;
  }
}

export async function loginAcademia(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar();
  const signinUrl = `${ACCOUNTS_BASE}/signin?serviceurl=${encodeURIComponent(SERVICE_URL)}`;

  // Step 0 — GET signin page to obtain CSRF cookies (iamcsr, stk)
  await academiaGet(signinUrl, jar);

  const iamcsr = jar.get('iamcsr') ?? '';
  const csrfHeaders = {
    'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
    Referer: signinUrl,
  };

  // Step 1 — lookup: email → identifier + digest
  const { text: lookupText, status: lookupStatus } = await academiaPostForm(
    `${ACCOUNTS_BASE}/signin/v2/lookup/${encodeURIComponent(email)}`,
    { mode: 'primary', cli_time: String(Date.now()), serviceurl: SERVICE_URL },
    jar,
    csrfHeaders,
  );

  let identifier: string;
  let digest: string;
  try {
    const d = (JSON.parse(lookupText) as any);
    if (d.status_code === 400) {
      const errCode = d.errors?.[0]?.code ?? d.code ?? 'unknown';
      const msg = d.errors?.[0]?.message ?? d.message ?? lookupText.slice(0, 200);
      throw new Error(`Academia lookup failed [${errCode}]: ${msg}`);
    }
    identifier = d.lookup.identifier as string;
    digest = d.lookup.digest as string;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Academia lookup')) throw e;
    throw new Error(`Academia lookup (${lookupStatus}): ${lookupText.slice(0, 200)}`);
  }

  // Step 2 — password auth
  const passwordUrl =
    `${ACCOUNTS_BASE}/signin/v2/primary/${encodeURIComponent(identifier)}/password` +
    `?digest=${encodeURIComponent(digest)}&servicename=ZohoCreator` +
    `&serviceurl=${encodeURIComponent(SERVICE_URL)}&cli_time=${Date.now()}`;

  const { text: authText, status: authStatus } = await academiaPostJson(
    passwordUrl,
    { passwordauth: { password } },
    jar,
    csrfHeaders,
  );

  if (authStatus >= 400) {
    throw new Error(`Academia password auth failed (${authStatus}): ${authText.slice(0, 200)}`);
  }

  let redirectUri: string;
  try {
    const data = JSON.parse(authText) as any;
    redirectUri = data.passwordauth?.redirect_uri ?? data.redirect_uri;
    if (!redirectUri) throw new Error('no redirect_uri in response');
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Academia')) throw e;
    throw new Error(`Unexpected password auth response: ${authText.slice(0, 200)}`);
  }

  // Step 3 — follow the redirect (may be preannouncement/block-sessions)
  await academiaGet(redirectUri, jar);

  // Step 4 — if it was the block-sessions gate, DELETE it and follow the real redirect
  if (redirectUri.includes('preannouncement') || redirectUri.includes('block-sessions')) {
    const freshIamcsr = jar.get('iamcsr') ?? iamcsr;
    const nextUrl = await deleteBlockSessions(jar, freshIamcsr);
    if (nextUrl) {
      const fullNext = nextUrl.startsWith('http')
        ? nextUrl
        : `${ACADEMIA_BASE}${nextUrl}`;
      await academiaGet(fullNext, jar);
    }
  }

  return jar;
}
