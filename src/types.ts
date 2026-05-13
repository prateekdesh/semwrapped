export interface StudentProfile {
  name: string;
  studentId: string;
  registerNo: string;
  email: string;
  institution: string;
  program: string;
  degree: string;
  facultyAdvisor: string;
  academicAdvisor: string | null;
}

export interface Course {
  code: string;
  name: string;
  mark: number;
  maxMark: number;
  subjectId: string;
  status: number;
}

export interface ComponentMark {
  date: string;
  component: string;
  mark: number;
  maxMark: number;
}

export interface CourseDetail extends Course {
  components: ComponentMark[];
}

export interface CourseGrade {
  semester: number;
  monthYear: string;
  code: string;
  name: string;
  credits: number;
  grade: string;
}

export interface SemesterRecord {
  semester: number;
  monthYear: string;
  courses: CourseGrade[];
  sgpa: number;
}

export interface AcademicRecord {
  cgpa: number;
  creditsRegistered: number;
  creditsEarned: number;
  semesters: SemesterRecord[];
}

export interface ExamEntry {
  semester: string;
  subjectCode: string;
  subjectName: string;
  date: string | null;
  session: string | null;
  hallNo: string | null;
  seatNo: string | null;
}

export interface StudentData {
  profile: StudentProfile;
  courses: CourseDetail[];
  academicRecord: AcademicRecord;
  examTimetable: ExamEntry[];
  attendance: AttendanceCourse[];
}

export interface AttendanceCourse {
  courseCode: string;
  courseType: string;   // e.g. "Regular"
  courseName: string;
  category: string;     // "Theory" or "Practical"
  faculty: string;
  slot: string;         // timetable slot, e.g. "A", "LAB"
  room: string;
  attendancePercentage: number;
}
