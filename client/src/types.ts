export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TAKER";
  disabled: boolean;
  createdAt: string;
  attemptCount?: number;
}
export type QuestionType = "MCQ" | "MULTI" | "TRUE_FALSE" | "SHORT" | "ESSAY";
export interface Question {
  id?: string;
  prompt: string;
  type: QuestionType;
  points: number;
  options: { key: string; text: string }[];
  correct?: string[];
  guidelines?: string;
  caseSensitive?: boolean;
}
export interface Test {
  id: string;
  title: string;
  description: string;
  duration: number;
  published: boolean;
  multipleAttempts: boolean;
  passMark: number | null;
  startsAt: string | null;
  endsAt: string | null;
  version: number;
  createdAt: string;
  questionCount: number;
  attemptCount: number;
  myAttempts: { id: string; status: string }[];
  questions?: Question[];
}
export interface Grade {
  status: "PENDING" | "PARTIALLY_GRADED" | "GRADED";
  released: boolean;
  total?: number;
  score?: number;
  releasedAt?: string;
}
export interface Answer {
  questionId: string;
  value: string | string[];
  score?: number | null;
  comment?: string;
}
export interface Attempt {
  id: string;
  testId: string;
  title: string;
  description: string;
  number: number;
  duration: number;
  passMark?: number | null;
  status: "IN_PROGRESS" | "SUBMITTED";
  startedAt: string;
  deadline: string;
  submittedAt: string | null;
  expired: boolean;
  serverNow: string;
  user?: Pick<User, "id" | "name" | "email">;
  questions: Question[];
  answers: Answer[];
  grade: Grade | null;
  feedback?: string;
}
export interface Dashboard {
  users: number;
  tests: number;
  attempts: number;
  pending: number;
  recent: Attempt[];
}
