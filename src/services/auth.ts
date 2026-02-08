import { db, type User } from '../db/database';
import bcryptjs from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const JWT_SECRET = 'patente-b-secret-key-2024-production';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

function base64Encode(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}

function base64Decode(str: string): string {
  return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

function createToken(payload: Omit<TokenPayload, 'exp'>): string {
  const header = base64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Date.now() + TOKEN_EXPIRY;
  const body = base64Encode(JSON.stringify({ ...payload, exp }));
  const signature = base64Encode(JSON.stringify({ sig: JWT_SECRET + body }));
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64Decode(parts[1])) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: Omit<User, 'password'>;
  token?: string;
  refreshToken?: string;
}

export const authService = {
  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    // Input validation
    if (!email || !password || !name) {
      return { success: false, message: 'جميع الحقول مطلوبة' };
    }
    if (password.length < 6) {
      return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: 'البريد الإلكتروني غير صحيح' };
    }

    // Check existing user
    const existing = await db.users.where('email').equals(email.toLowerCase()).first();
    if (existing) {
      return { success: false, message: 'البريد الإلكتروني مسجل مسبقاً' };
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);
    const refreshToken = uuid();

    const newUser: User = {
      id: uuid(),
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: email.toLowerCase() === 'admin@patente.com' ? 'admin' : 'user',
      banned: false,
      streak: 0,
      refreshToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.users.add(newUser);

    const token = createToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return {
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    if (!email || !password) {
      return { success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان' };
    }

    const user = await db.users.where('email').equals(email.toLowerCase()).first();
    if (!user) {
      return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }

    if (user.banned) {
      return { success: false, message: 'تم حظر حسابك. تواصل مع الإدارة' };
    }

    const validPassword = await bcryptjs.compare(password, user.password);
    if (!validPassword) {
      return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }

    const refreshToken = uuid();
    await db.users.update(user.id, {
      lastLogin: new Date().toISOString(),
      refreshToken,
    });

    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return {
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  },

  async getCurrentUser(token: string): Promise<AuthResponse> {
    const payload = verifyToken(token);
    if (!payload) {
      return { success: false, message: 'الجلسة منتهية، سجل دخول مرة أخرى' };
    }

    const user = await db.users.get(payload.userId);
    if (!user) {
      return { success: false, message: 'المستخدم غير موجود' };
    }

    if (user.banned) {
      return { success: false, message: 'تم حظر حسابك' };
    }

    const { password: _, ...userWithoutPassword } = user;
    return {
      success: true,
      message: 'مستخدم نشط',
      user: userWithoutPassword,
      token,
    };
  },

  async refreshToken(oldRefreshToken: string): Promise<AuthResponse> {
    const user = await db.users.where('refreshToken').equals(oldRefreshToken).first();
    if (!user) {
      return { success: false, message: 'رمز التحديث غير صحيح' };
    }

    const newRefreshToken = uuid();
    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await db.users.update(user.id, { refreshToken: newRefreshToken });

    const { password: _, ...userWithoutPassword } = user;
    return {
      success: true,
      message: 'تم تحديث الجلسة',
      user: userWithoutPassword,
      token,
      refreshToken: newRefreshToken,
    };
  },

  async updateProfile(userId: string, data: { name?: string; password?: string }): Promise<AuthResponse> {
    const user = await db.users.get(userId);
    if (!user) return { success: false, message: 'المستخدم غير موجود' };

    const updates: Partial<User> = { updatedAt: new Date().toISOString() };
    if (data.name) updates.name = data.name;
    if (data.password) updates.password = await bcryptjs.hash(data.password, 10);

    await db.users.update(userId, updates);
    const updated = await db.users.get(userId);
    if (!updated) return { success: false, message: 'خطأ' };
    
    const { password: _, ...userWithoutPassword } = updated;
    return { success: true, message: 'تم تحديث الملف الشخصي', user: userWithoutPassword };
  },

  verifyToken,
};
