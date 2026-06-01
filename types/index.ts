// types/index.ts
export interface Student {
  id: number;
  name: string;
}

export interface Class {
  id: string;
  name: string;
  grade: number;
  letter: string;
  students: Student[];
  ownerId: string;
  sharedWith: { id: string; name: string }[];
}

export interface Attendance {
  id: string;
  date: Date;
  classId: string;
  teacherId: string;
  presentStudents: number[];
  absentStudents: number[];
  absentReasons: Record<number, string>;
}

export interface Pass {
  id: string;
  date: Date;
  classId: string;
  teacherId: string;
  students: Student[];
  exitTime: string;
  reason: string;
  used: boolean;
  usedAt: Date;
  createdAt: Date;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  role: "TEACHER" | "ADMIN";
}