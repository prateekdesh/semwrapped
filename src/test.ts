/**
 * Quick end-to-end test. Run with:
 *   npx tsx src/test.ts
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { startLogin, completeLogin, fetchAll } from './index.js';

const rl = readline.createInterface({ input, output });

console.log('Starting login flow...');
const session = await startLogin();

console.log('\nCAPTCHA image (base64 data URI):');
console.log(session.captchaImage.slice(0, 80) + '...');
console.log('\nPaste the base64 into a browser or image viewer to read it.\n');

const username = await rl.question('NetID (without @srmist.edu.in): ');
const password = await rl.question('Password: ');
const captcha = await rl.question('CAPTCHA answer: ');
rl.close();

console.log('\nLogging in...');
const jar = await completeLogin(session, username, password, captcha);
console.log('Logged in successfully.\n');

console.log('Fetching all data (parallel)...');
const data = await fetchAll(jar);

console.log('\n── Profile ─────────────────────────────');
console.log(JSON.stringify(data.profile, null, 2));

console.log('\n── Academic Record ──────────────────────');
console.log(`CGPA: ${data.academicRecord.cgpa}`);
console.log(`Credits earned: ${data.academicRecord.creditsEarned}`);
data.academicRecord.semesters.forEach(s =>
  console.log(`  Sem ${s.semester} (${s.monthYear}): SGPA ${s.sgpa}, ${s.courses.length} courses`),
);

console.log('\n── Current Semester Courses ─────────────');
data.courses.forEach(c => {
  console.log(`  ${c.code} — ${c.name}: ${c.mark}/${c.maxMark}`);
  c.components.forEach(comp =>
    console.log(`    ${comp.component}: ${comp.mark}/${comp.maxMark} (${comp.date})`),
  );
});

console.log('\n── Exam Timetable ───────────────────────');
data.examTimetable.forEach(e => {
  const when = e.date ? `${e.date} ${e.session ?? ''}`.trim() : 'TBD';
  console.log(`  ${e.subjectCode} — ${when}`);
});
