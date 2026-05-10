import * as cheerio from 'cheerio';
import type { AttendanceCourse } from '../types.js';

function unescapeJs(s: string): string {
  return s
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

export function parseAttendance(html: string): AttendanceCourse[] {
  const $ = cheerio.load(html);

  // Pass 1 — find the td container and the pageSanitizer script inside it
  const container = $('td#zc-viewcontainer_My_Attendance');
  if (!container.length) {
    throw new Error('Attendance container (td#zc-viewcontainer_My_Attendance) not found');
  }

  let scriptContent = '';
  container.find('script').each((_, el) => {
    const text = $(el).html() ?? '';
    if (text.includes('pageSanitizer.sanitize')) {
      scriptContent = text;
      return false; // break
    }
  });

  if (!scriptContent) {
    throw new Error('pageSanitizer.sanitize call not found in attendance response');
  }

  // Pass 2 — extract + unescape the JS string literal
  // Uses \x27 for ' and \x22 for " inside, so [^'\\] won't see raw single quotes
  const match = scriptContent.match(
    /pageSanitizer\.sanitize\s*\(\s*'((?:[^'\\]|\\.)*)'\s*\)/,
  );
  if (!match) {
    throw new Error('Could not extract attendance HTML from pageSanitizer.sanitize');
  }

  const innerHtml = unescapeJs(match[1]);

  // Pass 3 — parse the attendance table
  // Columns: Course Code | Course Title | Category | Faculty Name | Slot | Room No | Attn %
  const $$ = cheerio.load(innerHtml);
  const courses: AttendanceCourse[] = [];

  // The attendance table has bgcolor="#FAFAD2"
  $$('table[bgcolor="#FAFAD2"] tbody tr').each((_, row) => {
    const cells = $$(row).children('td').toArray();
    if (cells.length < 7) return;

    // Cell 0: "21CSE312P<br/><font color='red' size=2>Regular</font>"
    // Header row has no <font> child — skip it
    const cell0 = $$(cells[0]);
    if (!cell0.find('font').length) return;

    const courseType = cell0.find('font').first().text().trim();
    const courseCode = cell0.text().replace(courseType, '').trim();

    if (!courseCode) return;

    // Cell 6: "<font color='blue'><strong>77</font></strong>"
    const pct = parseFloat($$(cells[6]).text().trim()) || 0;

    courses.push({
      courseCode,
      courseType,
      courseName: $$(cells[1]).text().trim(),
      category: $$(cells[2]).text().trim(),
      faculty: $$(cells[3]).text().trim(),
      slot: $$(cells[4]).text().trim(),
      room: $$(cells[5]).text().trim(),
      attendancePercentage: pct,
    });
  });

  return courses;
}
