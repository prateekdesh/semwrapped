/**
 * Parses studentMarksCredits.jsp HTML fragment.
 *
 * The main table in #tabcontent1 has rows of two kinds:
 *   - Course row:  semester | monthYear | code | description | credits | grade
 *   - SGPA row:    (colspan 5 "SGPA")                        | sgpa
 *   - CGPA row:    (colspan 5 "CGPA")                        | cgpa   (at the very end)
 *
 * A separate "Credit Details" table has Credits Registered / Credits Earned.
 */

import * as cheerio from 'cheerio';
import type { AcademicRecord, SemesterRecord, CourseGrade } from '../types.js';

export function parseAcademicRecord(html: string): AcademicRecord {
  const $ = cheerio.load(html);

  let cgpa = 0;
  let creditsRegistered = 0;
  let creditsEarned = 0;

  const semMap = new Map<number, SemesterRecord>();

  // Parse grades table (inside #tabcontent1 or the first .table)
  $('#tabcontent1 table tbody tr, .table-billing-history table tbody tr').each((_, el) => {
    const tds = $(el).find('td');
    const semText = tds.eq(0).text().trim();
    const labelTd = tds.filter('[colspan]').first();

    if (labelTd.length) {
      const label = labelTd.text().trim().toUpperCase();
      const value = parseFloat($(el).find('td').last().text().trim());
      if (isNaN(value)) return;

      if (label === 'CGPA') {
        cgpa = value;
      } else if (label === 'SGPA') {
        const semNum = parseInt(semText, 10);
        if (!isNaN(semNum) && semMap.has(semNum)) {
          semMap.get(semNum)!.sgpa = value;
        } else {
          // fallback: apply to the last open semester
          const last = [...semMap.values()].pop();
          if (last) last.sgpa = value;
        }
      }
      return;
    }

    const semNum = parseInt(semText, 10);
    if (isNaN(semNum) || tds.length < 6) return;

    const monthYear = tds.eq(1).text().trim();
    const code = tds.eq(2).text().trim();
    const name = tds.eq(3).text().trim();
    const credits = parseInt(tds.eq(4).text().trim(), 10);
    const grade = tds.eq(5).text().trim();

    if (!code) return;

    if (!semMap.has(semNum)) {
      semMap.set(semNum, { semester: semNum, monthYear, courses: [], sgpa: 0 });
    }

    const course: CourseGrade = {
      semester: semNum,
      monthYear,
      code,
      name,
      credits: isNaN(credits) ? 0 : credits,
      grade,
    };
    semMap.get(semNum)!.courses.push(course);
  });

  // Parse credit details table (the second table on the page)
  $('table').each((_, tbl) => {
    $(tbl).find('tr').each((_, row) => {
      const label = $(row).find('td').eq(0).text().trim().toLowerCase();
      const value = parseInt($(row).find('td').eq(1).text().trim(), 10);
      if (isNaN(value)) return;
      if (label.includes('registered')) creditsRegistered = value;
      else if (label.includes('earned')) creditsEarned = value;
    });
  });

  const semesters = [...semMap.values()].sort((a, b) => a.semester - b.semester);
  return { cgpa, creditsRegistered, creditsEarned, semesters };
}
