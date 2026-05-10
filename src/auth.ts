/**
 * Login flow for sp.srmist.edu.in
 *
 * Steps:
 *  1. GET /students/loginManager/youLogin.jsp  → parse fpNonce + challengeId
 *  2. POST /fpToken (fingerprint)              → encrypted fpToken (stored in form)
 *  3. POST /fpCToken (fingerprint + challenge) → captcha encryption token
 *  4. POST /SCaptchaServlet                    → base64 CAPTCHA image
 *  5. (caller solves CAPTCHA)
 *  6. POST /LoginServlet                       → JSESSIONID set
 */

import { CookieJar, get, post, BASE_URL } from './client.js';
import type { LoginSession } from './types.js';

function fingerprint() {
  return {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    language: 'en-GB',
    screen: '1470x956',
    timezone: 'Asia/Calcutta',
  };
}

function parseHidden(html: string, id: string): string {
  const match = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`, 'i'))
    ?? html.match(new RegExp(`name="${id}"[^>]*value="([^"]*)"`, 'i'));
  if (!match) throw new Error(`Hidden field #${id} not found in login page`);
  return match[1];
}

function parseCaptchaParams(html: string): { ts: string; token: string } {
  // The server embeds a fresh ts and UUID token into the inline JS on every page load:
  //   "&ts=1778408980763" + "&token=a4e45606-2955-4685-8e25-35ef8cc1863c"
  const tsMatch = html.match(/&ts=(\d{10,})/);
  const tokenMatch = html.match(/&token=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (!tsMatch || !tokenMatch) {
    throw new Error('Could not parse captcha ts/token from login page JS');
  }
  return { ts: tsMatch[1], token: tokenMatch[1] };
}

export async function startLogin(): Promise<LoginSession> {
  const jar = new CookieJar();

  // Step 1 — load login page, get nonce + challengeId
  const loginPage = await get('/students/loginManager/youLogin.jsp', jar);
  const fpNonce = parseHidden(loginPage, 'fpNonce');
  const challengeId = parseHidden(loginPage, 'challengeId');
  const { ts: captchaTs, token: captchaToken } = parseCaptchaParams(loginPage);
  const ts = Date.now();

  // Steps 2 & 3 — run in parallel; both use the same fingerprint
  const fp = fingerprint();
  const loginReferer = { Referer: `${BASE_URL}/students/loginManager/youLogin.jsp` };
  const [fpTokenJson, captchaEncToken] = await Promise.all([
    post('/fpToken', { fpPayload: JSON.stringify({ fp, nonce: fpNonce, ts }) }, jar, loginReferer),
    post('/fpCToken', { fpPayload: JSON.stringify({ fp, nonce: fpNonce, challengeId, ts }) }, jar, loginReferer),
  ]);

  let fpToken: string;
  try {
    fpToken = (JSON.parse(fpTokenJson) as { fpToken: string }).fpToken;
  } catch {
    throw new Error(`Unexpected /fpToken response: ${fpTokenJson.slice(0, 200)}`);
  }

  // Step 4 — fetch CAPTCHA image
  const captchaRaw = await post(
    '/SCaptchaServlet',
    { fpToken: captchaEncToken, ts: captchaTs, token: captchaToken },
    jar,
    loginReferer,
  );

  let captchaImage: string;
  try {
    captchaImage = (JSON.parse(captchaRaw) as { image: string }).image;
  } catch {
    throw new Error(`Unexpected /SCaptchaServlet response: ${captchaRaw.slice(0, 200)}`);
  }

  return { jar, fpNonce, challengeId, fpToken, captchaFpToken: captchaEncToken, captchaImage };
}

export async function completeLogin(
  session: LoginSession,
  username: string,
  password: string,
  captchaAnswer: string,
): Promise<CookieJar> {
  const { jar, fpNonce, challengeId, fpToken } = session;

  await post(
    '/LoginServlet',
    {
      username: username.toUpperCase(),
      password,
      captcha: captchaAnswer,
      challengeId,
      fpNonce,
      fpPayload: '',
      fpToken,
      recaptchaToken: '',
    },
    jar,
    {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE_URL}/students/loginManager/youLogin.jsp`,
    },
  );

  if (!jar.get('JSESSIONID')) {
    throw new Error('Login failed: JSESSIONID not set. Wrong credentials or CAPTCHA?');
  }

  return jar;
}
