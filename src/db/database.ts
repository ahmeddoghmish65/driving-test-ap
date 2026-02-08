import Dexie, { type Table } from 'dexie';

// ============ Database Schema Types ============

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  banned: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  lastActiveDate?: string;
  streak: number;
  refreshToken?: string;
}

export interface Category {
  id: string;
  nameAr: string;
  nameIt: string;
  descriptionAr: string;
  icon: string;
  color: string;
  imageUrl: string;
  order: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  categoryId: string;
  titleAr: string;
  titleIt: string;
  descriptionAr: string;
  descriptionIt: string;
  contentAr: string;
  contentIt: string;
  imageUrl: string;
  order: number;
  icon: string;
  color: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sign {
  id: string;
  nameAr: string;
  nameIt: string;
  descriptionAr: string;
  descriptionIt: string;
  category: 'warning' | 'prohibition' | 'obligation' | 'information' | 'priority' | 'temporary';
  imageEmoji: string;
  imageUrl?: string;
  createdAt: string;
}

export interface Question {
  id: string;
  textIt: string;
  textAr: string;
  correctAnswer: boolean;
  explanationAr: string;
  explanationIt: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lessonId?: string;
  signId?: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  userId: string;
  questions: string[];
  answers: Record<string, boolean | null>;
  score: number;
  total: number;
  passed: boolean;
  completedAt?: string;
  startedAt: string;
  timeSpent: number;
}

export interface Progress {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  score: number;
  completedAt?: string;
  lastAccessedAt: string;
}

export interface QuestionProgress {
  id: string;
  userId: string;
  questionId: string;
  correct: boolean;
  answeredAt: string;
  examId?: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  isDeleted: boolean;
}

export interface Like {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
  reviewedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'report' | 'system' | 'achievement';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

export interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface GlossaryTerm {
  id: string;
  termIt: string;
  termAr: string;
  definitionIt: string;
  definitionAr: string;
  category: string;
  createdAt: string;
}

// ============ Database Class ============

class PatenteDatabase extends Dexie {
  users!: Table<User>;
  categories!: Table<Category>;
  lessons!: Table<Lesson>;
  signs!: Table<Sign>;
  questions!: Table<Question>;
  exams!: Table<Exam>;
  progress!: Table<Progress>;
  questionProgress!: Table<QuestionProgress>;
  posts!: Table<Post>;
  comments!: Table<PostComment>;
  likes!: Table<Like>;
  reports!: Table<Report>;
  notifications!: Table<Notification>;
  adminLogs!: Table<AdminLog>;
  glossaryTerms!: Table<GlossaryTerm>;

  constructor() {
    super('PatenteBDatabaseV2');
    
    this.version(1).stores({
      users: 'id, email, role, banned, createdAt',
      categories: 'id, order, isPublished, createdAt',
      lessons: 'id, categoryId, order, isPublished, createdAt',
      signs: 'id, category, createdAt',
      questions: 'id, category, difficulty, lessonId, signId, createdAt',
      exams: 'id, userId, passed, startedAt',
      progress: 'id, userId, lessonId, completed, [userId+lessonId]',
      questionProgress: 'id, userId, questionId, correct, answeredAt, [userId+questionId]',
      posts: 'id, userId, createdAt, isDeleted',
      comments: 'id, postId, userId, createdAt, isDeleted',
      likes: 'id, postId, userId, [postId+userId]',
      reports: 'id, reporterId, targetType, status, createdAt',
      notifications: 'id, userId, read, createdAt',
      adminLogs: 'id, adminId, createdAt',
      glossaryTerms: 'id, category, termIt, termAr',
    });
  }
}

export const db = new PatenteDatabase();
