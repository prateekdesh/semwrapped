/**
 * Parses studentInternalMarkDetails.jsp HTML fragment.
 *
 * Main table columns: Code | Description | Mark / Max. Mark | (button cell)
 * The button's onclick contains the subjectId and status:
 *   funViewComponentWiseMarks('41728', '21AIC303T', 'NAME', 2)
 */

import * as cheerio from 'cheerio';
import type { Course } from '../types.js';

const ONCLICK_RE = /funViewComponentWiseMarks\(\s*'(\d+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)/;

function parseMarkFraction(text: string): { mark: number; maxMark: number } | null {
  const m = text.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (!m) return null;
  return { mark: parseFloat(m[1]), maxMark: parseFloat(m[2]) };
}

export function parseCourses(html: string): Course[] {
  const $ = cheerio.load(html);
  const courses: Course[] = [];

  $('table tbody tr').each((_, el) => {
    const tds = $(el).find('td');
    if (tds.length < 3) return;

    const code = tds.eq(0).text().trim();
    const name = tds.eq(1).text().trim();
    const markText = tds.eq(2).text().trim();
    const onclick = tds.find('[onclick]').attr('onclick') ?? '';

    if (!code || !name) return;

    const fraction = parseMarkFraction(markText);
    if (!fraction) return;

    const match = onclick.match(ONCLICK_RE);
    if (!match) return;

    const [, subjectId, , , statusStr] = match;
    courses.push({
      code,
      name,
      mark: fraction.mark,
      maxMark: fraction.maxMark,
      subjectId,
      status: parseInt(statusStr, 10),
    });
  });

  return courses;
}
