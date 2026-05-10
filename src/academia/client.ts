import { CookieJar } from '../client.js';

export const ACADEMIA_BASE = 'https://academia.srmist.edu.in';
export const ACCOUNTS_BASE = `${ACADEMIA_BASE}/accounts/p/40-10002227248`;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

export async function academiaGet(
  url: string,
  jar: CookieJar,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Cookie: jar.toString(),
      ...extraHeaders,
    },
    redirect: 'follow',
  });
  jar.update(res.headers);
  return res.text();
}

export async function academiaPostForm(
  url: string,
  body: Record<string, string>,
  jar: CookieJar,
  extraHeaders: Record<string, string> = {},
): Promise<{ text: string; status: number }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.toString(),
      ...extraHeaders,
    },
    body: new URLSearchParams(body).toString(),
    redirect: 'follow',
  });
  jar.update(res.headers);
  return { text: await res.text(), status: res.status };
}

export async function academiaPostJson(
  url: string,
  body: unknown,
  jar: CookieJar,
  extraHeaders: Record<string, string> = {},
): Promise<{ text: string; status: number }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      Cookie: jar.toString(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  jar.update(res.headers);
  return { text: await res.text(), status: res.status };
}
