/**
 * Parses StudentExamTimeTable.jsp HTML fragment.
 *
 * Table structure:
 *   thead: Sem/Year/Trim | Subject Code | Subject Description | Date & Session | Hall No. | Seat No.
 *   tbody:
 *     - Section header: <tr><th colspan="7">May -2026</th></tr>
 *     - Data rows:      <tr><td>VI</td><td>21AIC303T</td><td>NAME</td><td>12-MAY-2026 AN (02:00-05:00)</td><td></td><td></td></tr>
 *
 * "- -" in the date column means no exam scheduled.
 */

import * as cheerio from 'cheerio';
import type { ExamEntry } from '../types.js';

function parseDate(raw: string): { date: string | null; session: string | null } {
  const text = raw.trim();
  if (!text || text === '- -' || text.startsWith('-')) return { date: null, session: null };

  // "12-MAY-2026 AN  (02:00-05:00)"  or  "12-MAY-2026 FN  (10:00-01:00)"
  const m = text.match(/^(\d{1,2}-[A-Z]+-\d{4})\s+(AN|FN)\s*\(([^)]+)\)/i);
  if (m) {
    return { date: m[1], session: `${m[2].toUpperCase()} (${m[3]})` };
  }

  // fallback: return the raw string as the date
  return { date: text, session: null };
}

export function parseTimetable(html: string): ExamEntry[] {
  const $ = cheerio.load(html);
  const entries: ExamEntry[] = [];

  $('table tbody tr').each((_, el) => {
    const tds = $(el).find('td');

    // Skip section-header rows (th children only)
    if (tds.length === 0) return;

    if (tds.length < 4) return;

    const semester = tds.eq(0).text().trim();
    const subjectCode = tds.eq(1).text().trim();
    const subjectName = tds.eq(2).text().trim();
    const dateRaw = tds.eq(3).text().trim();
    const hallNo = tds.eq(4).text().trim() || null;
    const seatNo = tds.eq(5).text().trim() || null;

    if (!subjectCode || !subjectName) return;

    const { date, session } = parseDate(dateRaw);

    entries.push({ semester, subjectCode, subjectName, date, session, hallNo, seatNo });
  });

  return entries;
}
