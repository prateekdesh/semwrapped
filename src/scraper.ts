/**
 * High-level data fetch functions.
 * Each function takes an authenticated CookieJar and returns typed data.
 */

import { ajaxPost, CookieJar } from './client.js';
import { parseProfile } from './parsers/profile.js';
import { parseCourses } from './parsers/marks.js';
import { parseComponents } from './parsers/components.js';
import { parseAcademicRecord } from './parsers/grades.js';
import { parseTimetable } from './parsers/timetable.js';
import type {
  StudentProfile,
  Course,
  CourseDetail,
  AcademicRecord,
  ExamEntry,
  StudentData,
} from './types.js';

// ─── individual fetchers ──────────────────────────────────────────────────────

export async function fetchProfile(jar: CookieJar): Promise<StudentProfile> {
  const html = await ajaxPost(
    '/students/report/studentProfile.jsp',
    { iden: '1', filter: '', hdnFormDetails: '1', csrfPreventionSalt: '' },
    jar,
  );
  return parseProfile(html);
}

export async function fetchCourses(jar: CookieJar): Promise<Course[]> {
  const html = await ajaxPost(
    '/students/report/studentInternalMarkDetails.jsp',
    { iden: '13', filter: '', hdnFormDetails: '1', csrfPreventionSalt: '' },
    jar,
  );
  return parseCourses(html);
}

export async function fetchCourseComponents(
  jar: CookieJar,
  subjectId: string,
  status: number,
): Promise<ReturnType<typeof parseComponents>> {
  const html = await ajaxPost(
    '/students/report/studentInternalMarkDetailsInner.jsp',
    { iden: '1', hdnSubjectId: subjectId, status: String(status) },
    jar,
  );
  return parseComponents(html);
}

export async function fetchAcademicRecord(jar: CookieJar): Promise<AcademicRecord> {
  const html = await ajaxPost(
    '/students/report/studentMarksCredits.jsp',
    { iden: '8', filter: '', hdnFormDetails: '1', csrfPreventionSalt: '' },
    jar,
  );
  return parseAcademicRecord(html);
}

export async function fetchExamTimetable(jar: CookieJar): Promise<ExamEntry[]> {
  const html = await ajaxPost(
    '/students/transaction/StudentExamTimeTable.jsp',
    { iden: '126', filter: '', hdnFormDetails: '1', csrfPreventionSalt: '' },
    jar,
  );
  return parseTimetable(html);
}

// ─── composite fetcher ────────────────────────────────────────────────────────

export async function fetchAll(jar: CookieJar): Promise<StudentData> {
  // Fire independent requests in parallel
  const [profile, courses, academicRecord, examTimetable] = await Promise.all([
    fetchProfile(jar),
    fetchCourses(jar),
    fetchAcademicRecord(jar),
    fetchExamTimetable(jar),
  ]);

  // Fetch component-wise marks for each course (parallel, capped to avoid hammering)
  const courseDetails: CourseDetail[] = await Promise.all(
    courses.map(async (course): Promise<CourseDetail> => {
      const components = await fetchCourseComponents(jar, course.subjectId, course.status);
      return { ...course, components };
    }),
  );

  // attendance is populated separately via the academia portal (see server.ts)
  return { profile, courses: courseDetails, academicRecord, examTimetable, attendance: [] };
}
