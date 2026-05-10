/**
 * Tests the academia.srmist.edu.in attendance flow in isolation.
 * Run with: npx tsx src/test-academia.ts
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loginAcademia, fetchAttendance } from './index.js';
import { ACADEMIA_BASE, academiaGet } from './academia/client.js';

const rl = readline.createInterface({ input, output });
const username = await rl.question('Register number (e.g. RA2111003010001): ');
const password = await rl.question('Academia portal password: ');
rl.close();

const email = `${username.toLowerCase()}@srmist.edu.in`;
console.log(`\nLogging in as: ${email}`);

const jar = await loginAcademia(email, password);

console.log('\n── Cookies after login ─────────────────────────────');
console.log(jar.toString());

console.log('\n── Fetching raw attendance page ────────────────────');
const rawHtml = await academiaGet(
  `${ACADEMIA_BASE}/srm_university/academia-academic-services/page/My_Attendance`,
  jar,
  { 'X-Requested-With': 'XMLHttpRequest' },
);

// Show enough HTML to diagnose: the first 2000 chars and any pageSanitizer call
console.log('\n[First 2000 chars of response]:');
console.log(rawHtml.slice(0, 2000));

const hasSanitizer = rawHtml.includes('pageSanitizer.sanitize');
const hasContainer = rawHtml.includes('zc-viewcontainer_My_Attendance');
console.log(`\nContains pageSanitizer.sanitize: ${hasSanitizer}`);
console.log(`Contains zc-viewcontainer_My_Attendance: ${hasContainer}`);

if (hasSanitizer) {
  const snip = rawHtml.match(/pageSanitizer\.sanitize\s*\([^)]{0,80}/);
  console.log(`\npageSanitizer snippet: ${snip?.[0]}`);
}

console.log('\n── Parsed attendance result ────────────────────────');
try {
  const attendance = await fetchAttendance(jar);
  console.log(`Parsed ${attendance.length} course(s)`);
  attendance.forEach(c =>
    console.log(`  ${c.courseCode} — ${c.courseName}: ${c.attendancePercentage}%`),
  );
} catch (err) {
  console.error('fetchAttendance threw:', err);
}
