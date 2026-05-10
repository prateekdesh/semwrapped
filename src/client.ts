export const BASE_URL = 'https://sp.srmist.edu.in/srmiststudentportal';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  'Accept': 'text/html, */*; q=0.01',
};

export class CookieJar {
  private store = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    if (initial) for (const [k, v] of Object.entries(initial)) this.store.set(k, v);
  }

  serialize(): Record<string, string> {
    return Object.fromEntries(this.store);
  }

  static deserialize(data: Record<string, string>): CookieJar {
    return new CookieJar(data);
  }

  update(headers: Headers): void {
    // getSetCookie() is Node 18.14+; fall back gracefully
    const raw: string[] =
      typeof (headers as any).getSetCookie === 'function'
        ? (headers as any).getSetCookie()
        : (headers.get('set-cookie') ?? '').split(/,(?=[^ ])/).filter(Boolean);

    for (const entry of raw) {
      const [nameValue] = entry.split(';');
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx === -1) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();
      if (name) this.store.set(name, value);
    }
  }

  toString(): string {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.store.get(name);
  }

  clone(): CookieJar {
    const c = new CookieJar();
    for (const [k, v] of this.store) c.store.set(k, v);
    return c;
  }
}

export async function get(
  path: string,
  jar: CookieJar,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { ...DEFAULT_HEADERS, Cookie: jar.toString(), ...extraHeaders },
    redirect: 'manual',
  });
  jar.update(res.headers);
  return res.text();
}

export async function post(
  path: string,
  body: Record<string, string>,
  jar: CookieJar,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.toString(),
      ...extraHeaders,
    },
    body: new URLSearchParams(body).toString(),
    redirect: 'manual',
  });
  jar.update(res.headers);
  return res.text();
}

export async function ajaxPost(
  path: string,
  body: Record<string, string>,
  jar: CookieJar,
): Promise<string> {
  return post(path, body, jar, {
    'X-Requested-With': 'XMLHttpRequest',
    Referer: `${BASE_URL}/students/template/HRDSystem.jsp`,
    Accept: 'text/html, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  });
}
