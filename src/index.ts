/**
 * Public API for semwrapped.
 *
 * Typical usage:
 *
 *   import { login, fetchAll } from './index.js';
 *
 *   const jar = await login('PD0530', 'password');
 *   const data = await fetchAll(jar);
 *   console.log(data);
 */

export { startLogin, login } from './auth.js';
export type { LoginSession } from './auth.js';
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
  AttendanceCourse,
} from './types.js';
