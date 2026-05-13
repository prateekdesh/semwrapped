import { chromium, type Browser, type Page } from 'playwright';
import { CookieJar, BASE_URL } from './client.js';

const LOGIN_URL = `${BASE_URL}/students/loginManager/youLogin.jsp`;

export interface LoginSession {
  captchaImage: string;
  _browser: Browser;
  _page: Page;
}

export async function startLogin(): Promise<LoginSession> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

  const captchaEl = page.locator('img[src*="SCaptchaServlet"]');
  await captchaEl.waitFor({ timeout: 8000 });
  const imgBuf = await captchaEl.screenshot();
  const captchaImage = `data:image/png;base64,${imgBuf.toString('base64')}`;

  // Keep browser open — the same session must be used for form submission
  return { captchaImage, _browser: browser, _page: page };
}

export async function login(
  session: LoginSession,
  username: string,
  password: string,
  captcha: string,
): Promise<CookieJar> {
  const { _browser: browser, _page: page } = session;

  try {
    await page.fill('#username', username.toUpperCase());
    await page.fill('#password', password);
    await page.fill('#captcha', captcha);

    await Promise.all([
      page.waitForURL((url) => !url.toString().includes('youLogin'), { timeout: 15000 }),
      page.click('button:has-text("Login")'),
    ]);

    if (page.url().includes('youLogin')) {
      throw new Error('Login failed: wrong credentials or captcha?');
    }

    const cookies = await page.context().cookies();
    const jar = new CookieJar(
      Object.fromEntries(cookies.map((c) => [c.name, c.value])),
    );
    return jar;
  } finally {
    await browser.close();
  }
}
