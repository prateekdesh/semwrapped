import { CookieJar } from '../client.js';
import { ACADEMIA_BASE, academiaGet } from './client.js';
import { parseAttendance } from '../parsers/attendance.js';
import type { AttendanceCourse } from '../types.js';

export async function fetchAttendance(jar: CookieJar): Promise<AttendanceCourse[]> {
  const html = await academiaGet(
    `${ACADEMIA_BASE}/srm_university/academia-academic-services/page/My_Attendance`,
    jar,
    { 'X-Requested-With': 'XMLHttpRequest' },
  );
  return parseAttendance(html);
}
