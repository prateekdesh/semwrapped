/**
 * Public API for semwrapped.
 *
 * Typical usage:
 *
 *   import { startLogin, completeLogin, fetchAll } from './index.js';
 *
 *   const session = await startLogin();
 *   // session.captchaImage is a base64 data URI — show it to the user
 *   console.log('Solve the CAPTCHA:', session.captchaImage);
 *
 *   const jar = await completeLogin(session, 'PD0530', 'password', 'captchaAnswer');
 *   const data = await fetchAll(jar);
 *   console.log(data);
 */

export { startLogin, completeLogin } from './auth.js';
export {
  fetchProfile,
  fetchCourses,
  fetchCourseComponents,
  fetchAcademicRecord,
  fetchExamTimetable,
  fetchAll,
} from './scraper.js';
export { loginAcademia } from './academia/auth.js';
export { fetchAttendance } from './academia/scraper.js';
export type {
  StudentProfile,
  Course,
  CourseDetail,
  ComponentMark,
  CourseGrade,
  SemesterRecord,
  AcademicRecord,
  ExamEntry,
  StudentData,
  LoginSession,
  AttendanceCourse,
} from './types.js';
