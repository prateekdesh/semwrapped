/**
 * Parses studentInternalMarkDetailsInner.jsp HTML fragment.
 *
 * Table columns: Entered on | Component | Mark / Max. Mark
 * Example row:   24/Mar/2026 | FP-I | 8.20 / 10.00
 */

import * as cheerio from 'cheerio';
import type { ComponentMark } from '../types.js';

function parseMarkFraction(text: string): { mark: number; maxMark: number } | null {
  const m = text.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (!m) return null;
  return { mark: parseFloat(m[1]), maxMark: parseFloat(m[2]) };
}

export function parseComponents(html: string): ComponentMark[] {
  const $ = cheerio.load(html);
  const components: ComponentMark[] = [];

  $('table tbody tr').each((_, el) => {
    const tds = $(el).find('td');
    if (tds.length < 3) return;

    const date = tds.eq(0).text().trim();
    const component = tds.eq(1).text().trim();
    const markText = tds.eq(2).text().trim();

    if (!component || !markText) return;

    const fraction = parseMarkFraction(markText);
    if (!fraction) return;

    components.push({ date, component, mark: fraction.mark, maxMark: fraction.maxMark });
  });

  return components;
}
