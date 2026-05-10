/**
 * Parses studentProfile.jsp HTML fragment.
 *
 * The page is a table of label/value pairs:
 *   <tr><td>Label</td><td><div class="font-weight-bold">Value</div></td></tr>
 */

import * as cheerio from 'cheerio';
import type { StudentProfile } from '../types.js';

function cell(tr: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  return tr.find('td').eq(1).find('div').first().text().trim();
}

function labelOf(tr: cheerio.Cheerio<any>): string {
  return tr.find('td').eq(0).text().trim().toLowerCase().replace(/[\s.]+/g, '');
}

export function parseProfile(html: string): StudentProfile {
  const $ = cheerio.load(html);
  const data: Record<string, string> = {};

  $('table tr').each((_, el) => {
    const tr = $(el);
    if (tr.find('td').length < 2) return;
    data[labelOf(tr)] = cell(tr, $);
  });

  const program = data['program'] ?? '';

  // "B.Tech.-Artificial Intelligence[UG - FT - ACADEMIC]"  →  "B.Tech.-Artificial Intelligence"
  const degree = program.replace(/\[.*?\]/g, '').trim();

  // "Dr. Mohandas R [mohandar1@srmist.edu.in]"  →  "Dr. Mohandas R"
  const stripEmail = (s: string) => s.replace(/\[.*?\]/g, '').trim();

  return {
    name: data['studentname'] ?? '',
    studentId: data['studentid'] ?? '',
    registerNo: data['registerno'] ?? '',
    email: data['emailid'] ?? '',
    institution: data['institution'] ?? '',
    program,
    degree,
    facultyAdvisor: stripEmail(data['facultyadvisor'] ?? ''),
    academicAdvisor: data['academicadvisor'] ? stripEmail(data['academicadvisor']) : null,
  };
}
