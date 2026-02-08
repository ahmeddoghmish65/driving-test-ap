import { useState, useEffect, useCallback, createContext, useContext, useMemo, useRef } from 'react';
import { db } from './db/database';
import type { User, Category, Lesson, Sign, Question, Post, PostComment, Like, GlossaryTerm, QuestionProgress } from './db/database';
import { seedDatabase } from './db/seed';
import { authService } from './services/auth';
import { v4 as uuid } from 'uuid';
import { Icon } from './components/Icon';

// ==================== AUTH CONTEXT ====================
interface AuthCtx {
  user: Omit<User, 'password'> | null;
  token: string | null;
  loading: boolean;
  login: (e: string, p: string) => Promise<{ success: boolean; message: string }>;
  register: (e: string, p: string, n: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}
const AuthContext = createContext<AuthCtx | null>(null);
function useAuth() { const c = useContext(AuthContext); if (!c) throw new Error('No AuthContext'); return c; }

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin' || user?.email === 'admin@patente.com';
  useEffect(() => {
    const t = sessionStorage.getItem('auth_token');
    if (t) { authService.getCurrentUser(t).then(r => { if (r.success && r.user) { setUser(r.user); setToken(t); } else sessionStorage.removeItem('auth_token'); setLoading(false); }); }
    else setLoading(false);
  }, []);
  const login = useCallback(async (email: string, password: string) => {
    const r = await authService.login(email, password);
    if (r.success && r.user && r.token) {
      // Update streak
      const today = new Date().toDateString();
      const u = await db.users.get(r.user.id);
      if (u) {
        const lastActive = u.lastActiveDate;
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        let newStreak = u.streak || 0;
        if (lastActive === yesterday) newStreak += 1;
        else if (lastActive !== today) newStreak = 1;
        await db.users.update(u.id, { lastActiveDate: today, streak: newStreak });
        r.user = { ...r.user, streak: newStreak, lastActiveDate: today };
      }
      setUser(r.user); setToken(r.token); sessionStorage.setItem('auth_token', r.token);
    }
    return r;
  }, []);
  const register = useCallback(async (email: string, password: string, name: string) => { const r = await authService.register(email, password, name); if (r.success && r.user && r.token) { setUser(r.user); setToken(r.token); sessionStorage.setItem('auth_token', r.token); } return r; }, []);
  const logout = useCallback(() => { setUser(null); setToken(null); sessionStorage.removeItem('auth_token'); }, []);
  const refreshUser = useCallback(async () => { if (!token) return; const r = await authService.getCurrentUser(token); if (r.success && r.user) setUser(r.user); }, [token]);
  return <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin, refreshUser }}>{children}</AuthContext.Provider>;
}

// ==================== TOAST ====================
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'success' ? 'bg-accent-600' : type === 'error' ? 'bg-danger-600' : 'bg-primary-600';
  return (<div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] ${bg} text-white px-6 py-3 rounded-xl shadow-2xl animate-slideUp flex items-center gap-2`}><Icon name={type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'} size={20} /><span className="text-sm font-medium">{message}</span></div>);
}

// ==================== CONFIRM DIALOG ====================
function ConfirmDialog({ open, title, message, onConfirm, onCancel }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Icon name="warning" size={28} className="text-red-600" /></div>
        <h3 className="text-lg font-black text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm">تأكيد الحذف</button>
        </div>
      </div>
    </div>
  );
}

// ==================== MODAL ====================
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-black text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><Icon name="close" size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ==================== IMAGE PICKER COMPONENT ====================
function ImagePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') onChange(reader.result); };
    reader.readAsDataURL(file);
  };
  return (
    <div>
      {label && <label className="text-sm font-bold text-gray-700 block mb-1.5">{label}</label>}
      {value && <div className="mb-2 rounded-xl overflow-hidden border border-gray-200"><img src={value} alt="preview" className="w-full h-32 object-cover" /></div>}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <div className="flex gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 bg-primary-50 text-primary-700 rounded-xl text-sm font-bold border border-primary-200 flex items-center justify-center gap-1.5">
          <Icon name="image" size={16} />اختيار صورة من الجهاز
        </button>
        {value && <button type="button" onClick={() => onChange('')} className="px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-200"><Icon name="delete" size={16} /></button>}
      </div>
    </div>
  );
}

// ==================== LANDING PAGE ====================
function LandingPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center"><Icon name="directions_car" size={22} className="text-white" /></div><span className="text-xl font-bold text-gray-900">Patente<span className="text-primary-600">B</span></span></div>
          <div className="flex gap-2"><button onClick={() => onNavigate('login')} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-600">تسجيل الدخول</button><button onClick={() => onNavigate('register')} className="px-5 py-2 text-sm font-bold bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-200">ابدأ مجاناً</button></div>
        </div>
      </nav>
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 bg-gradient-to-b from-primary-50 via-white to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6"><Icon name="auto_awesome" size={16} />مدعوم بالذكاء الاصطناعي</div>
          <h1 className="text-4xl sm:text-6xl font-black text-gray-900 leading-tight mb-6">اجتز امتحان رخصة القيادة<br /><span className="text-primary-600">الإيطالية بثقة</span></h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">تطبيق ذكي مصمم خصيصاً للعرب في إيطاليا. تعلم بالعربية، تدرب على أسئلة حقيقية، واحصل على شرح مبسط لكل ما يصعب عليك.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => onNavigate('register')} className="px-8 py-4 bg-primary-600 text-white rounded-2xl font-bold text-lg hover:bg-primary-700 shadow-xl shadow-primary-200 flex items-center justify-center gap-2"><Icon name="rocket_launch" size={22} />ابدأ التعلم الآن</button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-white text-gray-700 rounded-2xl font-bold text-lg border-2 border-gray-200 hover:border-primary-300 flex items-center justify-center gap-2"><Icon name="info" size={22} />اعرف المزيد</button>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-500"><div className="flex items-center gap-2"><Icon name="people" size={20} className="text-primary-500" /> +5,000 مستخدم</div><div className="flex items-center gap-2"><Icon name="quiz" size={20} className="text-accent-500" /> +2,000 سؤال</div><div className="flex items-center gap-2"><Icon name="emoji_events" size={20} className="text-warning-500" /> نسبة نجاح 94%</div></div>
        </div>
      </section>
      <section id="features" className="py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto"><div className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">كل ما تحتاجه في مكان واحد</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[{ icon: 'menu_book', title: 'دروس شاملة', desc: 'كل قواعد المرور مترجمة ومشروحة بالعربية', color: 'from-blue-500 to-blue-600' },{ icon: 'signpost', title: 'إشارات المرور', desc: 'جميع الإشارات مع شرح عربي مفصل وصور حقيقية', color: 'from-red-500 to-red-600' },{ icon: 'quiz', title: 'اختبارات تفاعلية', desc: 'تدرب على أسئلة حقيقية من الامتحان', color: 'from-green-500 to-green-600' },{ icon: 'psychology', title: 'ذكاء اصطناعي', desc: 'اضغط "مش فاهم" واحصل على شرح مبسط', color: 'from-purple-500 to-purple-600' },{ icon: 'translate', title: 'قاموس المصطلحات', desc: 'كل المصطلحات الإيطالية مترجمة', color: 'from-orange-500 to-orange-600' },{ icon: 'forum', title: 'مجتمع المتعلمين', desc: 'تواصل مع متعلمين آخرين', color: 'from-teal-500 to-teal-600' }].map((f, i) => (<div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:shadow-xl transition-all group"><div className={`w-12 h-12 bg-gradient-to-br ${f.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}><Icon name={f.icon} size={24} className="text-white" /></div><h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3><p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p></div>))}
          </div>
        </div>
      </section>
      <section className="py-16 sm:py-24 px-4 bg-gray-50"><div className="max-w-3xl mx-auto"><div className="text-center mb-12"><h2 className="text-3xl font-black text-gray-900 mb-4">أسئلة شائعة</h2></div>{[{ q: 'هل التطبيق مجاني؟', a: 'نعم، التطبيق مجاني بالكامل.' },{ q: 'هل الأسئلة مطابقة للامتحان؟', a: 'الأسئلة مبنية على قاعدة بيانات الامتحان الرسمي.' },{ q: 'كم سؤال في الامتحان الحقيقي؟', a: '30 سؤال، 3 أخطاء كحد أقصى.' }].map((faq, i) => (<details key={i} className="bg-white rounded-xl mb-3 border border-gray-100 group"><summary className="px-6 py-4 cursor-pointer font-bold text-gray-900 flex items-center justify-between">{faq.q}<Icon name="expand_more" size={20} className="text-gray-400 group-open:rotate-180 transition-transform" /></summary><div className="px-6 pb-4 text-gray-600 text-sm">{faq.a}</div></details>))}</div></section>
      <section className="py-16 px-4"><div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-8 sm:p-12"><h2 className="text-3xl font-black text-white mb-4">جاهز تبدأ؟</h2><p className="text-primary-100 text-lg mb-8">انضم لآلاف العرب الذين نجحوا في امتحان الباتنتي</p><button onClick={() => onNavigate('register')} className="px-8 py-4 bg-white text-primary-700 rounded-2xl font-bold text-lg hover:bg-primary-50 shadow-xl">سجل حسابك المجاني الآن</button></div></section>
      <footer className="bg-gray-900 text-gray-400 py-12 px-4"><div className="max-w-6xl mx-auto"><div className="border-t border-gray-800 pt-6 text-center text-sm">© 2024 PatenteB. جميع الحقوق محفوظة.</div></div></footer>
    </div>
  );
}

// ==================== AUTH PAGES ====================
function LoginPage({ onNavigate, showToast }: { onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const { login } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); const r = await login(email, password); setLoading(false); if (r.success) { showToast('تم تسجيل الدخول بنجاح!', 'success'); onNavigate('dashboard'); } else showToast(r.message, 'error'); };
  return (<div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center p-4" dir="rtl"><div className="w-full max-w-md"><div className="text-center mb-8"><div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4"><Icon name="directions_car" size={32} className="text-white" /></div><h1 className="text-2xl font-black text-gray-900">مرحباً بعودتك</h1></div><form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-gray-100"><div><label className="text-sm font-bold text-gray-700 block mb-1.5">البريد الإلكتروني</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none text-right" required /></div><div><label className="text-sm font-bold text-gray-700 block mb-1.5">كلمة المرور</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none" required /></div><button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">{loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</button><div className="text-center text-sm text-gray-500">ليس لديك حساب؟ <button type="button" onClick={() => onNavigate('register')} className="text-primary-600 font-bold">سجل الآن</button></div><button type="button" onClick={() => onNavigate('landing')} className="text-sm text-gray-400 mx-auto flex items-center gap-1"><Icon name="arrow_back" size={16} /> العودة</button></form><div className="mt-4 p-3 bg-primary-50 rounded-xl text-center text-xs text-primary-700 border border-primary-100"><strong>حساب المدير:</strong> admin@patente.com / admin123</div></div></div>);
}
function RegisterPage({ onNavigate, showToast }: { onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const { register } = useAuth(); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); const r = await register(email, password, name); setLoading(false); if (r.success) { showToast('تم إنشاء حسابك!', 'success'); onNavigate('dashboard'); } else showToast(r.message, 'error'); };
  return (<div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center p-4" dir="rtl"><div className="w-full max-w-md"><div className="text-center mb-8"><div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4"><Icon name="person_add" size={32} className="text-white" /></div><h1 className="text-2xl font-black text-gray-900">إنشاء حساب جديد</h1></div><form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-gray-100"><div><label className="text-sm font-bold text-gray-700 block mb-1.5">الاسم الكامل</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="اسمك" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none" required /></div><div><label className="text-sm font-bold text-gray-700 block mb-1.5">البريد الإلكتروني</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none text-right" required /></div><div><label className="text-sm font-bold text-gray-700 block mb-1.5">كلمة المرور</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 outline-none" required minLength={6} /></div><button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50">{loading ? 'جارٍ التسجيل...' : 'إنشاء الحساب'}</button><div className="text-center text-sm text-gray-500">لديك حساب؟ <button type="button" onClick={() => onNavigate('login')} className="text-primary-600 font-bold">سجل دخول</button></div><button type="button" onClick={() => onNavigate('landing')} className="text-sm text-gray-400 mx-auto flex items-center gap-1"><Icon name="arrow_back" size={16} /> العودة</button></form></div></div>);
}

// ==================== BOTTOM NAV ====================
function BottomNav({ page, onNavigate }: { page: string; onNavigate: (p: string) => void }) {
  const { isAdmin } = useAuth();
  const items = [{ id: 'dashboard', icon: 'home', label: 'الرئيسية' },{ id: 'lessons', icon: 'menu_book', label: 'الدروس' },{ id: 'exam-sim', icon: 'quiz', label: 'الامتحان' },{ id: 'community', icon: 'forum', label: 'المجتمع' },{ id: isAdmin ? 'admin' : 'profile', icon: isAdmin ? 'admin_panel_settings' : 'person', label: isAdmin ? 'الإدارة' : 'حسابي' }];
  return (<nav className="fixed bottom-0 w-full bg-white border-t border-gray-100 z-50 safe-area-bottom"><div className="flex items-center justify-around py-1">{items.map(item => (<button key={item.id} onClick={() => onNavigate(item.id)} className={`flex flex-col items-center py-2 px-3 min-w-[60px] transition-all ${page === item.id ? 'text-primary-600' : 'text-gray-400'}`}><Icon name={item.icon} size={24} /><span className="text-[10px] mt-0.5 font-medium">{item.label}</span></button>))}</div></nav>);
}

// ==================== DASHBOARD (Updated stats) ====================
function DashboardPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ streak: 0, level: 1, correctRate: 0 });
  useEffect(() => { if (!user) return; (async () => {
    const qp = await db.questionProgress.where('userId').equals(user.id).toArray();
    const correct = qp.filter(q => q.correct).length;
    const rate = qp.length > 0 ? Math.round((correct / qp.length) * 100) : 0;
    const u = await db.users.get(user.id);
    const streak = u?.streak || 0;
    const level = Math.max(1, Math.floor(qp.length / 20) + 1);
    // Update streak for today
    const today = new Date().toDateString();
    if (u && u.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let newStreak = u.streak || 0;
      if (u.lastActiveDate === yesterday) newStreak += 1;
      else if (u.lastActiveDate !== today) newStreak = 1;
      await db.users.update(u.id, { lastActiveDate: today, streak: newStreak });
    }
    setStats({ streak, level, correctRate: rate });
  })(); }, [user]);

  const readiness = Math.min(100, stats.correctRate);
  const menuItems = [{ id: 'lessons', icon: 'menu_book', title: 'الدروس', desc: 'تعلم قواعد المرور', color: 'from-blue-500 to-blue-600' },{ id: 'signs', icon: 'signpost', title: 'الإشارات', desc: 'إشارات المرور', color: 'from-red-500 to-red-600' },{ id: 'practice', icon: 'fitness_center', title: 'التدريب', desc: 'تمارين على الأسئلة', color: 'from-green-500 to-green-600' },{ id: 'exam-sim', icon: 'assignment', title: 'محاكي الامتحان', desc: 'امتحان كامل 30 سؤال', color: 'from-purple-500 to-purple-600' },{ id: 'glossary', icon: 'translate', title: 'القاموس', desc: 'مصطلحات إيطالية', color: 'from-orange-500 to-orange-600' },{ id: 'mistakes', icon: 'error_outline', title: 'أخطائي', desc: 'راجع أخطاءك', color: 'from-pink-500 to-pink-600' },{ id: 'community', icon: 'forum', title: 'المجتمع', desc: 'اسأل واستفد', color: 'from-teal-500 to-teal-600' },{ id: 'progress', icon: 'trending_up', title: 'تقدمي', desc: 'إحصائياتك', color: 'from-indigo-500 to-indigo-600' }];
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center justify-between mb-6"><div><h1 className="text-xl font-black text-gray-900">أهلاً {user?.name?.split(' ')[0]} 👋</h1><p className="text-gray-500 text-sm">واصل التعلم اليوم!</p></div><button onClick={() => onNavigate('profile')} className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center"><Icon name="person" size={22} className="text-primary-600" /></button></div>
    <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 mb-6 text-white"><div className="flex items-center justify-between mb-3"><div><p className="text-primary-200 text-sm">نسبة جاهزيتك للامتحان</p><p className="text-3xl font-black">{readiness}%</p></div><div className="w-16 h-16 rounded-full border-4 border-primary-300 flex items-center justify-center"><Icon name={readiness >= 80 ? 'emoji_events' : 'school'} size={28} /></div></div><div className="w-full bg-primary-900/30 rounded-full h-2.5"><div className="bg-white rounded-full h-2.5 transition-all duration-1000" style={{ width: `${readiness}%` }} /></div></div>
    {/* Updated stats: streak, level, accuracy */}
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
        <div className="flex items-center justify-center gap-1 mb-1"><Icon name="local_fire_department" size={20} className="text-orange-500" /></div>
        <p className="text-2xl font-black text-orange-500">{stats.streak}</p><p className="text-xs text-gray-500">أيام متتالية</p>
      </div>
      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
        <div className="flex items-center justify-center gap-1 mb-1"><Icon name="military_tech" size={20} className="text-primary-600" /></div>
        <p className="text-2xl font-black text-primary-600">{stats.level}</p><p className="text-xs text-gray-500">المستوى</p>
      </div>
      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
        <div className="flex items-center justify-center gap-1 mb-1"><Icon name="target" size={20} className="text-accent-600" /></div>
        <p className="text-2xl font-black text-accent-600">{stats.correctRate}%</p><p className="text-xs text-gray-500">دقة الإجابة</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">{menuItems.map(item => (<button key={item.id} onClick={() => onNavigate(item.id)} className="bg-white rounded-2xl p-4 border border-gray-100 text-right hover:shadow-lg transition-all active:scale-[0.98]"><div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-3`}><Icon name={item.icon} size={22} className="text-white" /></div><h3 className="font-bold text-gray-900 text-sm">{item.title}</h3><p className="text-gray-500 text-xs mt-0.5">{item.desc}</p></button>))}</div></div>);
}

// ==================== LESSONS WITH CATEGORIES (Thumbnail on right) ====================
function LessonsPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  useEffect(() => { (async () => {
    const cats = await db.categories.toArray();
    const published = cats.filter(c => c.isPublished).sort((a, b) => a.order - b.order);
    setCategories(published);
    const counts: Record<string, number> = {};
    const completed: Record<string, number> = {};
    for (const cat of published) {
      const lessons = await db.lessons.where('categoryId').equals(cat.id).toArray();
      const pubLessons = lessons.filter(l => l.isPublished);
      counts[cat.id] = pubLessons.length;
      if (user) {
        const prog = await db.progress.where('userId').equals(user.id).toArray();
        const completedLessonIds = prog.filter(p => p.completed).map(p => p.lessonId);
        completed[cat.id] = pubLessons.filter(l => completedLessonIds.includes(l.id)).length;
      }
    }
    setLessonCounts(counts);
    setCompletedCounts(completed);
  })(); }, [user]);

  return (
    <div className="pb-20 px-4 pt-4" dir="rtl">
      <div className="flex items-center gap-3 mb-6"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} className="text-gray-600" /></button><div><h1 className="text-xl font-black text-gray-900">الدروس</h1><p className="text-gray-500 text-xs">{categories.length} أقسام</p></div></div>
      <div className="space-y-3">
        {categories.map(cat => {
          const total = lessonCounts[cat.id] || 0;
          const done = completedCounts[cat.id] || 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <button key={cat.id} onClick={() => onNavigate(`category-${cat.id}`)} className="w-full bg-white rounded-2xl p-4 border border-gray-100 hover:shadow-lg transition-all text-right flex items-center gap-4">
              {/* Thumbnail on right */}
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.nameAr} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center" style={{ background: cat.color }}><Icon name={cat.icon} size={28} className="text-white/80" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-gray-900 text-base">{cat.nameAr}</h3>
                <p className="text-gray-400 text-sm" dir="ltr">{cat.nameIt}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">{total} درس</span>
                  <span className="text-xs text-gray-300">•</span>
                  <span className="text-xs font-bold" style={{ color: cat.color }}>{pct}% مكتمل</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5"><div className="rounded-full h-1.5 transition-all" style={{ width: `${pct}%`, background: cat.color }} /></div>
              </div>
              <Icon name="chevron_left" size={20} className="text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryLessonsPage({ categoryId, onNavigate }: { categoryId: string; onNavigate: (p: string) => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  useEffect(() => { (async () => {
    const cat = await db.categories.get(categoryId);
    if (cat) setCategory(cat);
    const ls = await db.lessons.where('categoryId').equals(categoryId).toArray();
    setLessons(ls.filter(l => l.isPublished).sort((a, b) => a.order - b.order));
    if (user) {
      const prog = await db.progress.where('userId').equals(user.id).toArray();
      setCompletedIds(prog.filter(p => p.completed).map(p => p.lessonId));
    }
  })(); }, [categoryId, user]);

  if (!category) return <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>;
  return (
    <div className="pb-20 px-4 pt-4" dir="rtl">
      <div className="flex items-center gap-3 mb-6"><button onClick={() => onNavigate('lessons')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} className="text-gray-600" /></button><div><h1 className="text-xl font-black text-gray-900">{category.nameAr}</h1><p className="text-gray-500 text-xs">{lessons.length} درس</p></div></div>
      <div className="space-y-3">
        {lessons.map(lesson => {
          const isCompleted = completedIds.includes(lesson.id);
          return (
            <button key={lesson.id} onClick={() => onNavigate(`lesson-${lesson.id}`)} className="w-full bg-white rounded-2xl p-4 border border-gray-100 text-right hover:shadow-md transition-all flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isCompleted ? 'bg-accent-100' : ''}`} style={!isCompleted ? { background: `linear-gradient(135deg, ${lesson.color}, ${lesson.color}dd)` } : {}}>
                {isCompleted ? <Icon name="check_circle" size={28} className="text-accent-600" /> : <Icon name={lesson.icon} size={24} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-sm ${isCompleted ? 'text-accent-700' : 'text-gray-900'}`}>{lesson.titleAr}</h3>
                <p className="text-gray-400 text-sm mt-0.5" dir="ltr">{lesson.titleIt}</p>
              </div>
              {isCompleted && <span className="text-xs bg-accent-100 text-accent-700 px-2 py-1 rounded-lg font-bold shrink-0">مكتمل ✓</span>}
              <Icon name="chevron_left" size={20} className="text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== LESSON DETAIL WITH TABS ====================
function LessonDetailPage({ lessonId, onNavigate, showToast }: { lessonId: string; onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [tab, setTab] = useState<'explanation' | 'questions'>('explanation');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [quizCurrent, setQuizCurrent] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, boolean>>({});
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => { (async () => {
    const l = await db.lessons.get(lessonId);
    if (l) setLesson(l);
    const qs = await db.questions.where('lessonId').equals(lessonId).toArray();
    setQuestions(qs);
    if (user) {
      const prog = await db.progress.where('[userId+lessonId]').equals([user.id, lessonId]).first();
      if (prog?.completed) setIsCompleted(true);
    }
  })(); }, [lessonId, user]);

  const handleQuizAnswer = (answer: boolean) => {
    const q = questions[quizCurrent];
    if (!q) return;
    const correct = answer === q.correctAnswer;
    setQuizAnswers(prev => ({ ...prev, [q.id]: correct }));
    if (user) {
      db.questionProgress.add({ id: uuid(), userId: user.id, questionId: q.id, correct, answeredAt: new Date().toISOString() });
    }
    if (quizCurrent < questions.length - 1) {
      setQuizCurrent(quizCurrent + 1);
    } else {
      setQuizFinished(true);
      const correctCount = Object.values({ ...quizAnswers, [q.id]: correct }).filter(Boolean).length;
      const passed = correctCount >= Math.ceil(questions.length * 0.7);
      if (passed && user) {
        markLessonComplete();
        showToast('🎉 مبروك! اجتزت اختبار الدرس بنجاح!', 'success');
      } else {
        showToast(`أجبت ${correctCount}/${questions.length} - حاول مرة أخرى`, 'info');
      }
    }
  };

  const markLessonComplete = async () => {
    if (!user) return;
    const existing = await db.progress.where('[userId+lessonId]').equals([user.id, lessonId]).first();
    if (existing) {
      await db.progress.update(existing.id, { completed: true, score: 100, completedAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString() });
    } else {
      await db.progress.add({ id: uuid(), userId: user.id, lessonId, completed: true, score: 100, completedAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString() });
    }
    setIsCompleted(true);
  };

  if (!lesson) return <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>;

  // Quiz Mode
  if (quizMode) {
    if (quizFinished) {
      const correctCount = Object.values(quizAnswers).filter(Boolean).length;
      const passed = correctCount >= Math.ceil(questions.length * 0.7);
      return (
        <div className="pb-20 px-4 pt-4" dir="rtl">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? 'bg-green-100' : 'bg-red-100'}`}><Icon name={passed ? 'emoji_events' : 'sentiment_dissatisfied'} size={48} className={passed ? 'text-green-600' : 'text-red-600'} /></div>
            <h2 className="text-2xl font-black mb-2">{passed ? '🎉 مبروك! نجحت!' : '😔 حاول مرة أخرى'}</h2>
            <p className="text-4xl font-black text-gray-900 mb-2">{correctCount}/{questions.length}</p>
            {passed && <p className="text-green-600 font-bold mb-4">✅ تم تأكيد إكمال الدرس!</p>}
            <div className="grid grid-cols-2 gap-3 mt-4"><button onClick={() => { setQuizMode(false); setQuizFinished(false); setQuizCurrent(0); setQuizAnswers({}); }} className="py-3 bg-primary-600 text-white rounded-xl font-bold">إعادة</button><button onClick={() => onNavigate(`lesson-${lessonId}`)} className="py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">العودة</button></div>
          </div>
        </div>
      );
    }
    const q = questions[quizCurrent];
    if (!q) return null;
    return (
      <div className="pb-20 px-4 pt-4" dir="rtl">
        <div className="flex items-center justify-between mb-4"><button onClick={() => setQuizMode(false)} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><span className="text-sm font-bold text-gray-500">{quizCurrent + 1}/{questions.length}</span></div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6"><div className="bg-primary-600 rounded-full h-2 transition-all" style={{ width: `${((quizCurrent + 1) / questions.length) * 100}%` }} /></div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-gray-600 text-base mb-2" dir="ltr">{q.textIt}</p>
          <p className="text-gray-900 font-bold text-base">{q.textAr}</p>
        </div>
        <div className="grid grid-cols-2 gap-3"><button onClick={() => handleQuizAnswer(true)} className="py-4 bg-accent-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"><Icon name="check" size={24} /> صح</button><button onClick={() => handleQuizAnswer(false)} className="py-4 bg-danger-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"><Icon name="close" size={24} /> خطأ</button></div>
      </div>
    );
  }

  return (
    <div className="pb-20 px-4 pt-4" dir="rtl">
      <div className="flex items-center gap-3 mb-4"><button onClick={() => onNavigate(`category-${lesson.categoryId}`)} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} className="text-gray-600" /></button><div className="flex-1"><h1 className="text-lg font-black text-gray-900">{lesson.titleAr}</h1><p className="text-gray-400 text-sm" dir="ltr">{lesson.titleIt}</p></div>{isCompleted && <span className="bg-accent-100 text-accent-700 px-3 py-1 rounded-lg text-xs font-bold">مكتمل ✓</span>}</div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('explanation')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${tab === 'explanation' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}><Icon name="menu_book" size={18} />الشرح</button>
        <button onClick={() => setTab('questions')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${tab === 'questions' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}><Icon name="quiz" size={18} />الأسئلة ({questions.length})</button>
      </div>
      {tab === 'explanation' && (
        <div>
          {lesson.imageUrl && <div className="rounded-2xl overflow-hidden mb-4 border border-gray-100"><img src={lesson.imageUrl} alt={lesson.titleAr} className="w-full h-48 object-cover" /></div>}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
            <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2"><Icon name="translate" size={18} className="text-primary-500" />الشرح بالإيطالية</h3>
            <div className="text-gray-600 text-base leading-relaxed" dir="ltr">{lesson.contentIt}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2"><Icon name="menu_book" size={18} className="text-accent-500" />الشرح بالعربية</h3>
            {lesson.contentAr.split('\n').map((line, i) => (<p key={i} className={`${line.startsWith('•') || line.startsWith('-') ? 'mr-4 text-gray-700' : line.startsWith('#') ? 'font-bold text-gray-900 text-lg' : 'text-gray-700'} mb-2 leading-relaxed text-base`}>{line}</p>))}
          </div>
        </div>
      )}
      {tab === 'questions' && (
        <div>
          {questions.length === 0 ? (<div className="text-center py-12 text-gray-400"><Icon name="quiz" size={48} className="mx-auto mb-3" /><p>لا توجد أسئلة لهذا الدرس بعد</p></div>) : (
            <>
              {/* Questions shown with correct answer visible (not a quiz) */}
              <div className="space-y-3 mb-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold shrink-0">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-gray-600 text-base" dir="ltr">{q.textIt}</p>
                        <p className="text-gray-900 font-bold text-base mt-1">{q.textAr}</p>
                      </div>
                    </div>
                    {/* Show the correct answer directly */}
                    <div className={`mt-3 p-3 rounded-xl ${q.correctAnswer ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon name={q.correctAnswer ? 'check_circle' : 'cancel'} size={18} className={q.correctAnswer ? 'text-green-600' : 'text-red-600'} />
                        <span className={`text-sm font-bold ${q.correctAnswer ? 'text-green-700' : 'text-red-700'}`}>
                          الإجابة: {q.correctAnswer ? 'صح (Vero) ✓' : 'خطأ (Falso) ✗'}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mt-1">{q.explanationAr}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setQuizMode(true); setQuizCurrent(0); setQuizAnswers({}); setQuizFinished(false); }} className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary-200"><Icon name="assignment" size={22} />اختبار الدرس</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== SIGNS (Image based, not emoji) ====================
function SignsPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [signs, setSigns] = useState<Sign[]>([]); const [filter, setFilter] = useState('all');
  useEffect(() => { db.signs.toArray().then(setSigns); }, []);
  const cats = [{ id: 'all', label: 'الكل', icon: 'apps' },{ id: 'warning', label: 'خطر', icon: 'warning' },{ id: 'prohibition', label: 'منع', icon: 'block' },{ id: 'obligation', label: 'إلزام', icon: 'check_circle' },{ id: 'priority', label: 'أولوية', icon: 'priority_high' },{ id: 'information', label: 'إرشاد', icon: 'info' }];
  const filtered = filter === 'all' ? signs : signs.filter(s => s.category === filter);
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center gap-3 mb-4"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">إشارات المرور</h1></div><div className="flex gap-2 overflow-x-auto pb-3 mb-4">{cats.map(c => (<button key={c.id} onClick={() => setFilter(c.id)} className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 ${filter === c.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}><Icon name={c.icon} size={16} />{c.label}</button>))}</div><div className="grid grid-cols-1 gap-3">{filtered.map(sign => (<div key={sign.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-start gap-4">
    {/* Image-based sign display */}
    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
      {sign.imageUrl ? <img src={sign.imageUrl} alt={sign.nameAr} className="w-full h-full object-contain" /> : <span className="text-3xl">{sign.imageEmoji}</span>}
    </div>
    <div className="flex-1"><h3 className="font-bold text-gray-900 text-base">{sign.nameAr}</h3><p className="text-gray-500 text-sm" dir="ltr">{sign.nameIt}</p><p className="text-gray-600 text-base mt-1">{sign.descriptionAr}</p></div></div>))}</div></div>);
}

// ==================== PRACTICE (with category/lesson selection) ====================
function PracticePage({ onNavigate, showToast }: { onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const { user } = useAuth();
  const [started, setStarted] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [selectedLesson, setSelectedLesson] = useState<string>('all');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [showResult, setShowResult] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  useEffect(() => {
    db.categories.toArray().then(c => setCategories(c.filter(x => x.isPublished)));
    db.lessons.toArray().then(l => setLessons(l.filter(x => x.isPublished)));
  }, []);

  const filteredLessons = selectedCat === 'all' ? lessons : lessons.filter(l => l.categoryId === selectedCat);

  const startPractice = async () => {
    let qs = await db.questions.toArray();
    if (selectedLesson !== 'all') {
      qs = qs.filter(q => q.lessonId === selectedLesson);
    } else if (selectedCat !== 'all') {
      const catLessonIds = lessons.filter(l => l.categoryId === selectedCat).map(l => l.id);
      qs = qs.filter(q => q.lessonId && catLessonIds.includes(q.lessonId));
    }
    if (qs.length === 0) { showToast('لا توجد أسئلة في هذا الاختيار', 'info'); return; }
    setQuestions(qs.sort(() => Math.random() - 0.5).slice(0, 10));
    setStarted(true);
  };

  const handleAnswer = async (answer: boolean) => {
    if (!user || questions.length === 0) return;
    const q = questions[current];
    const correct = answer === q.correctAnswer;
    setAnswered(prev => ({ ...prev, [q.id]: correct }));
    setShowResult(q.id);
    await db.questionProgress.add({ id: uuid(), userId: user.id, questionId: q.id, correct, answeredAt: new Date().toISOString() });
  };

  const nextQuestion = () => {
    setShowResult(null); setAiExplanation(null);
    if (current < questions.length - 1) setCurrent(current + 1);
    else { const c = Object.values(answered).filter(Boolean).length; showToast(`انتهت التمارين! ${c}/${questions.length} صحيح`, c >= 7 ? 'success' : 'info'); setStarted(false); setCurrent(0); setAnswered({}); }
  };

  if (!started) {
    return (
      <div className="pb-20 px-4 pt-4" dir="rtl">
        <div className="flex items-center gap-3 mb-6"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">التدريب</h1></div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Icon name="tune" size={20} className="text-primary-600" />اختر نطاق التدريب</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">القسم</label>
              <select value={selectedCat} onChange={e => { setSelectedCat(e.target.value); setSelectedLesson('all'); }} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm bg-white">
                <option value="all">جميع الأقسام</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">الدرس</label>
              <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm bg-white">
                <option value="all">جميع الدروس</option>
                {filteredLessons.map(l => <option key={l.id} value={l.id}>{l.titleAr}</option>)}
              </select>
            </div>
          </div>
          <button onClick={startPractice} className="w-full mt-4 py-4 bg-primary-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"><Icon name="play_arrow" size={24} />ابدأ التدريب</button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><button onClick={() => setStarted(false)} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">التدريب</h1></div><span className="text-sm text-gray-500 font-bold">{current + 1}/{questions.length}</span></div><div className="w-full bg-gray-200 rounded-full h-2 mb-6"><div className="bg-primary-600 rounded-full h-2 transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div>
    <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
      <p className="text-gray-600 text-base mb-2" dir="ltr">{q.textIt}</p>
      <p className="text-gray-900 font-bold text-base">{q.textAr}</p>
    </div>
    <button onClick={() => setAiExplanation(`🤖 شرح مبسط:\n\n${q.explanationAr}\n\n✅ الإجابة الصحيحة: ${q.correctAnswer ? 'صح (Vero)' : 'خطأ (Falso)'}`)} className="w-full mb-4 py-3 bg-purple-50 text-purple-700 rounded-xl font-bold text-sm border border-purple-200 flex items-center justify-center gap-2"><Icon name="psychology" size={20} />مش فاهم السؤال؟ 🤔</button>
    {aiExplanation && <div className="bg-purple-50 rounded-2xl p-4 mb-4 border border-purple-200">{aiExplanation.split('\n').map((line, i) => <p key={i} className="text-purple-900 text-sm">{line}</p>)}</div>}
    {!showResult ? (<div className="grid grid-cols-2 gap-3"><button onClick={() => handleAnswer(true)} className="py-4 bg-accent-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"><Icon name="check" size={24} /> صح</button><button onClick={() => handleAnswer(false)} className="py-4 bg-danger-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"><Icon name="close" size={24} /> خطأ</button></div>) : (<div><div className={`p-4 rounded-2xl mb-3 ${answered[q.id] ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}><div className="flex items-center gap-2 mb-2"><Icon name={answered[q.id] ? 'check_circle' : 'cancel'} size={24} className={answered[q.id] ? 'text-green-600' : 'text-red-600'} /><span className={`font-bold ${answered[q.id] ? 'text-green-700' : 'text-red-700'}`}>{answered[q.id] ? 'صحيح! 🎉' : 'خطأ ❌'}</span></div><p className="text-gray-700 text-sm">{q.explanationAr}</p></div><button onClick={nextQuestion} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Icon name="arrow_back" size={20} />{current < questions.length - 1 ? 'التالي' : 'إنهاء'}</button></div>)}</div>);
}

function ExamSimPage({ onNavigate, showToast }: { onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const { user } = useAuth(); const [started, setStarted] = useState(false); const [questions, setQuestions] = useState<Question[]>([]); const [current, setCurrent] = useState(0); const [answers, setAnswers] = useState<Record<string, boolean | null>>({}); const [timeLeft, setTimeLeft] = useState(1800); const [finished, setFinished] = useState(false); const [examResult, setExamResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);
  useEffect(() => { if (!started || finished) return; const iv = setInterval(() => { setTimeLeft(p => { if (p <= 1) { finishExam(); return 0; } return p - 1; }); }, 1000); return () => clearInterval(iv); }, [started, finished]);
  const startExam = async () => { const all = await db.questions.toArray(); const sh = all.sort(() => Math.random() - 0.5).slice(0, 30); setQuestions(sh); const init: Record<string, boolean | null> = {}; sh.forEach(q => { init[q.id] = null; }); setAnswers(init); setStarted(true); };
  const finishExam = async () => { if (!user) return; setFinished(true); let score = 0; const qIds: string[] = []; questions.forEach(q => { qIds.push(q.id); if (answers[q.id] === q.correctAnswer) score++; db.questionProgress.add({ id: uuid(), userId: user.id, questionId: q.id, correct: answers[q.id] === q.correctAnswer, answeredAt: new Date().toISOString() }); }); const passed = score >= 27; await db.exams.add({ id: uuid(), userId: user.id, questions: qIds, answers, score, total: questions.length, passed, startedAt: new Date(Date.now() - (1800 - timeLeft) * 1000).toISOString(), completedAt: new Date().toISOString(), timeSpent: 1800 - timeLeft }); setExamResult({ score, total: questions.length, passed }); showToast(passed ? '🎉 مبروك!' : '❌ حاول مرة أخرى', passed ? 'success' : 'error'); };
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  if (!started) return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center gap-3 mb-6"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">محاكي الامتحان</h1></div><div className="bg-white rounded-2xl p-6 border border-gray-100 text-center"><div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4"><Icon name="assignment" size={40} className="text-primary-600" /></div><h2 className="text-xl font-black mb-2">امتحان Patente B</h2><div className="grid grid-cols-2 gap-3 mb-6 text-sm"><div className="bg-gray-50 rounded-xl p-3"><span className="font-bold text-gray-900">30</span><br /><span className="text-gray-500">سؤال</span></div><div className="bg-gray-50 rounded-xl p-3"><span className="font-bold text-gray-900">30</span><br /><span className="text-gray-500">دقيقة</span></div><div className="bg-gray-50 rounded-xl p-3"><span className="font-bold text-gray-900">27</span><br /><span className="text-gray-500">للنجاح</span></div><div className="bg-gray-50 rounded-xl p-3"><span className="font-bold text-gray-900">3</span><br /><span className="text-gray-500">أخطاء مسموحة</span></div></div><button onClick={startExam} className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"><Icon name="play_arrow" size={24} /> ابدأ</button></div></div>);
  if (finished && examResult) return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="bg-white rounded-2xl p-6 border border-gray-100 text-center"><div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${examResult.passed ? 'bg-green-100' : 'bg-red-100'}`}><Icon name={examResult.passed ? 'emoji_events' : 'sentiment_dissatisfied'} size={48} className={examResult.passed ? 'text-green-600' : 'text-red-600'} /></div><h2 className="text-2xl font-black mb-2">{examResult.passed ? '🎉 نجحت!' : '😔 حاول مرة أخرى'}</h2><p className="text-4xl font-black mb-4">{examResult.score}/{examResult.total}</p><div className="grid grid-cols-2 gap-3"><button onClick={() => { setStarted(false); setFinished(false); setCurrent(0); setTimeLeft(1800); }} className="py-3 bg-primary-600 text-white rounded-xl font-bold">امتحان جديد</button><button onClick={() => onNavigate('dashboard')} className="py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">العودة</button></div></div></div>);
  const q = questions[current]; if (!q) return null;
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><Icon name="timer" size={20} className={timeLeft < 300 ? 'text-red-500' : 'text-gray-500'} /><span className={`font-mono font-bold ${timeLeft < 300 ? 'text-red-500' : 'text-gray-700'}`}>{fmt(timeLeft)}</span></div><span className="text-sm font-bold text-gray-500">{current + 1}/{questions.length}</span></div><div className="w-full bg-gray-200 rounded-full h-1.5 mb-6"><div className="bg-primary-600 rounded-full h-1.5 transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div><div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4"><p className="text-gray-600 text-base mb-2" dir="ltr">{q.textIt}</p><p className="text-gray-900 font-bold text-base">{q.textAr}</p></div><div className="grid grid-cols-2 gap-3 mb-4"><button onClick={() => setAnswers(p => ({ ...p, [q.id]: true }))} className={`py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${answers[q.id] === true ? 'bg-accent-500 text-white ring-2 ring-accent-300' : 'bg-white border-2 border-gray-200 text-gray-700'}`}><Icon name="check" size={22} /> صح</button><button onClick={() => setAnswers(p => ({ ...p, [q.id]: false }))} className={`py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${answers[q.id] === false ? 'bg-danger-500 text-white ring-2 ring-danger-300' : 'bg-white border-2 border-gray-200 text-gray-700'}`}><Icon name="close" size={22} /> خطأ</button></div><div className="flex gap-3">{current > 0 && <button onClick={() => setCurrent(current - 1)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">السابق</button>}{current < questions.length - 1 ? <button onClick={() => setCurrent(current + 1)} className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold">التالي</button> : <button onClick={finishExam} className="flex-1 py-3 bg-accent-600 text-white rounded-xl font-bold">إنهاء</button>}</div><div className="flex flex-wrap gap-1.5 mt-4 justify-center">{questions.map((qq, i) => (<button key={qq.id} onClick={() => setCurrent(i)} className={`w-7 h-7 rounded-lg text-xs font-bold ${i === current ? 'bg-primary-600 text-white' : answers[qq.id] !== null ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}>{i + 1}</button>))}</div></div>);
}

function GlossaryPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]); const [search, setSearch] = useState('');
  useEffect(() => { db.glossaryTerms.toArray().then(setTerms); }, []);
  const filtered = useMemo(() => terms.filter(t => t.termAr.includes(search) || t.termIt.toLowerCase().includes(search.toLowerCase()) || t.definitionAr.includes(search)), [terms, search]);
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center gap-3 mb-4"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">قاموس المصطلحات</h1></div><div className="relative mb-4"><Icon name="search" size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث..." className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-primary-500 outline-none" /></div><div className="space-y-2">{filtered.map(t => (<div key={t.id} className="bg-white rounded-xl p-4 border border-gray-100"><h3 className="font-bold text-gray-900 text-base">{t.termAr}</h3><p className="text-primary-600 text-base font-medium" dir="ltr">{t.termIt}</p><p className="text-gray-600 text-base mt-2">{t.definitionAr}</p><p className="text-gray-400 text-sm mt-1" dir="ltr">{t.definitionIt}</p></div>))}</div></div>);
}

function MistakesPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { user } = useAuth(); const [mistakes, setMistakes] = useState<(QuestionProgress & { question?: Question })[]>([]);
  useEffect(() => { if (!user) return; db.questionProgress.where('userId').equals(user.id).and(qp => !qp.correct).toArray().then(async qps => { const wq = await Promise.all(qps.map(async qp => ({ ...qp, question: await db.questions.get(qp.questionId) }))); setMistakes(wq.filter((v, _i, a) => a.findIndex(t => t.questionId === v.questionId) === _i)); }); }, [user]);
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center gap-3 mb-6"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><div><h1 className="text-xl font-black text-gray-900">أخطائي</h1><p className="text-gray-500 text-xs">{mistakes.length} خطأ</p></div></div>{mistakes.length === 0 ? (<div className="text-center py-12"><Icon name="celebration" size={48} className="text-accent-500 mx-auto mb-3" /><p className="text-gray-500">لا توجد أخطاء! 🎉</p></div>) : (<div className="space-y-3">{mistakes.map(m => m.question && (<div key={m.id} className="bg-white rounded-2xl p-4 border border-red-100"><p className="text-gray-600 text-base" dir="ltr">{m.question.textIt}</p><p className="text-gray-900 font-bold text-base mt-1">{m.question.textAr}</p><div className="mt-2 p-2 bg-green-50 rounded-lg"><p className="text-green-700 text-sm"><strong>الصحيح:</strong> {m.question.correctAnswer ? 'صح' : 'خطأ'}</p><p className="text-green-600 text-sm mt-1">{m.question.explanationAr}</p></div></div>))}</div>)}</div>);
}

function ProgressPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { user } = useAuth(); const [stats, setStats] = useState({ total: 0, correct: 0, wrong: 0, exams: 0, passed: 0 });
  useEffect(() => { if (!user) return; Promise.all([db.questionProgress.where('userId').equals(user.id).toArray(), db.exams.where('userId').equals(user.id).toArray()]).then(([qps, exams]) => { setStats({ total: qps.length, correct: qps.filter(q => q.correct).length, wrong: qps.filter(q => !q.correct).length, exams: exams.length, passed: exams.filter(e => e.passed).length }); }); }, [user]);
  const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center gap-3 mb-6"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">تقدمي</h1></div><div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 text-white text-center mb-6"><p className="text-primary-200 text-sm mb-1">نسبة الصحيحة</p><p className="text-5xl font-black">{rate}%</p></div><div className="grid grid-cols-2 gap-3 mb-6"><div className="bg-white rounded-xl p-4 border border-gray-100 text-center"><p className="text-2xl font-black text-accent-600">{stats.correct}</p><p className="text-xs text-gray-500">صحيحة</p></div><div className="bg-white rounded-xl p-4 border border-gray-100 text-center"><p className="text-2xl font-black text-danger-600">{stats.wrong}</p><p className="text-xs text-gray-500">خاطئة</p></div><div className="bg-white rounded-xl p-4 border border-gray-100 text-center"><p className="text-2xl font-black text-primary-600">{stats.exams}</p><p className="text-xs text-gray-500">امتحان</p></div><div className="bg-white rounded-xl p-4 border border-gray-100 text-center"><p className="text-2xl font-black text-warning-600">{stats.passed}</p><p className="text-xs text-gray-500">نجاح</p></div></div><div className="bg-purple-50 rounded-2xl p-5 border border-purple-200"><div className="flex items-center gap-2 mb-3"><Icon name="psychology" size={24} className="text-purple-600" /><h3 className="font-bold text-purple-900">خطة تعلم ذكية 🤖</h3></div><div className="space-y-2 text-sm text-purple-800">{rate < 50 && <p>📚 ركز على الدروس الأساسية أولاً</p>}{rate >= 50 && rate < 85 && <p>💪 راجع الأخطاء وأعد حلها</p>}{rate >= 85 && <p>🏆 أنت جاهز للامتحان!</p>}{stats.wrong > 0 && <p>🔍 لديك {stats.wrong} خطأ - راجعها</p>}</div></div></div>);
}

function CommunityPage({ onNavigate, showToast }: { onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const { user, isAdmin } = useAuth(); const [posts, setPosts] = useState<Post[]>([]); const [newPost, setNewPost] = useState(''); const [comments, setComments] = useState<Record<string, PostComment[]>>({}); const [likes, setLikes] = useState<Record<string, Like[]>>({}); const [showComments, setShowComments] = useState<string | null>(null); const [newComment, setNewComment] = useState('');
  const loadPosts = useCallback(async () => { const all = await db.posts.toArray(); const filtered = all.filter(p => !p.isDeleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); setPosts(filtered); const ac = await db.comments.toArray(); const al = await db.likes.toArray(); const cm: Record<string, PostComment[]> = {}; const lm: Record<string, Like[]> = {}; filtered.forEach(p => { cm[p.id] = ac.filter(c => c.postId === p.id && !c.isDeleted); lm[p.id] = al.filter(l => l.postId === p.id); }); setComments(cm); setLikes(lm); }, []);
  useEffect(() => { loadPosts(); }, [loadPosts]);
  const createPost = async () => { if (!user || !newPost.trim()) return; await db.posts.add({ id: uuid(), userId: user.id, userName: user.name, content: newPost.trim(), likesCount: 0, commentsCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false }); setNewPost(''); showToast('تم النشر', 'success'); loadPosts(); };
  const deletePost = async (id: string) => { await db.posts.update(id, { isDeleted: true }); showToast('تم الحذف', 'info'); loadPosts(); };
  const toggleLike = async (postId: string) => { if (!user) return; const ex = await db.likes.where('[postId+userId]').equals([postId, user.id]).first(); if (ex) { await db.likes.delete(ex.id); } else { await db.likes.add({ id: uuid(), postId, userId: user.id, createdAt: new Date().toISOString() }); } loadPosts(); };
  const addComment = async (postId: string) => { if (!user || !newComment.trim()) return; await db.comments.add({ id: uuid(), postId, userId: user.id, userName: user.name, content: newComment.trim(), createdAt: new Date().toISOString(), isDeleted: false }); setNewComment(''); loadPosts(); };
  const userLiked = (postId: string) => user ? likes[postId]?.some(l => l.userId === user.id) : false;
  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'الآن'; if (m < 60) return `${m} دقيقة`; const h = Math.floor(m / 60); if (h < 24) return `${h} ساعة`; return `${Math.floor(h / 24)} يوم`; };
  return (<div className="pb-20 px-4 pt-4" dir="rtl"><div className="flex items-center gap-3 mb-4"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">المجتمع</h1></div><div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4"><textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="شارك سؤالك..." className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary-500 resize-none text-sm" rows={3} /><div className="flex justify-end mt-2"><button onClick={createPost} disabled={!newPost.trim()} className="px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1"><Icon name="send" size={16} /> نشر</button></div></div><div className="space-y-3">{posts.map(post => (<div key={post.id} className="bg-white rounded-2xl p-4 border border-gray-100"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center"><Icon name="person" size={18} className="text-primary-600" /></div><div><p className="font-bold text-gray-900 text-sm">{post.userName}</p><p className="text-gray-400 text-xs">{timeAgo(post.createdAt)}</p></div></div>{(user?.id === post.userId || isAdmin) && <button onClick={() => deletePost(post.id)}><Icon name="delete" size={16} className="text-gray-400 hover:text-red-500" /></button>}</div><p className="text-gray-700 text-sm mt-3">{post.content}</p><div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50"><button onClick={() => toggleLike(post.id)} className={`flex items-center gap-1 text-sm ${userLiked(post.id) ? 'text-red-500' : 'text-gray-400'}`}><Icon name={userLiked(post.id) ? 'favorite' : 'favorite_border'} size={18} />{likes[post.id]?.length || 0}</button><button onClick={() => setShowComments(showComments === post.id ? null : post.id)} className="flex items-center gap-1 text-sm text-gray-400"><Icon name="chat_bubble_outline" size={18} />{comments[post.id]?.length || 0}</button></div>{showComments === post.id && <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">{comments[post.id]?.map(c => (<div key={c.id} className="bg-gray-50 rounded-lg p-2"><p className="text-xs font-bold text-gray-700">{c.userName}</p><p className="text-xs text-gray-600">{c.content}</p></div>))}<div className="flex gap-2"><input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="تعليق..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none" onKeyDown={e => e.key === 'Enter' && addComment(post.id)} /><button onClick={() => addComment(post.id)} className="px-3 py-2 bg-primary-600 text-white rounded-lg"><Icon name="send" size={14} /></button></div></div>}</div>))}</div></div>);
}

// ==================== PROFILE PAGE (Enhanced) ====================
function ProfilePage({ onNavigate, showToast }: { onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const { user, logout, isAdmin, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [stats, setStats] = useState({ total: 0, correct: 0, exams: 0, passed: 0, lessonsComplete: 0, totalLessons: 0, streak: 0 });

  useEffect(() => { if (!user) return; (async () => {
    const [qps, exams, progress, lessons, u] = await Promise.all([
      db.questionProgress.where('userId').equals(user.id).toArray(),
      db.exams.where('userId').equals(user.id).toArray(),
      db.progress.where('userId').equals(user.id).toArray(),
      db.lessons.count(),
      db.users.get(user.id),
    ]);
    setStats({
      total: qps.length,
      correct: qps.filter(q => q.correct).length,
      exams: exams.length,
      passed: exams.filter(e => e.passed).length,
      lessonsComplete: progress.filter(p => p.completed).length,
      totalLessons: lessons,
      streak: u?.streak || 0,
    });
  })(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const r = await authService.updateProfile(user.id, { name: name || undefined, password: newPassword || undefined });
    if (r.success) {
      showToast('تم تحديث الملف الشخصي', 'success');
      await refreshUser();
      setEditing(false);
      setNewPassword('');
    } else showToast(r.message, 'error');
  };

  const resetProgress = async () => {
    if (!user) return;
    await db.questionProgress.where('userId').equals(user.id).delete();
    await db.progress.where('userId').equals(user.id).delete();
    await db.exams.where('userId').equals(user.id).delete();
    showToast('تم مسح جميع بيانات التقدم', 'success');
  };

  const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const level = Math.max(1, Math.floor(stats.total / 20) + 1);

  return (<div className="pb-20 px-4 pt-4" dir="rtl">
    <div className="flex items-center gap-3 mb-6"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><h1 className="text-xl font-black text-gray-900">حسابي</h1></div>

    {/* Profile Card */}
    <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 text-white text-center mb-4">
      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><Icon name="person" size={40} /></div>
      <h2 className="text-xl font-black">{user?.name}</h2>
      <p className="text-primary-200 text-sm">{user?.email}</p>
      {isAdmin && <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold"><Icon name="admin_panel_settings" size={14} /> مدير</span>}
      <div className="flex items-center justify-center gap-1 mt-2">
        <Icon name="calendar_today" size={14} className="text-primary-200" />
        <span className="text-primary-200 text-xs">عضو منذ {new Date(user?.createdAt || '').toLocaleDateString('ar')}</span>
      </div>
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
        <Icon name="local_fire_department" size={22} className="text-orange-500 mx-auto" />
        <p className="text-xl font-black text-orange-500 mt-1">{stats.streak}</p><p className="text-xs text-gray-500">أيام متتالية</p>
      </div>
      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
        <Icon name="military_tech" size={22} className="text-primary-600 mx-auto" />
        <p className="text-xl font-black text-primary-600 mt-1">{level}</p><p className="text-xs text-gray-500">المستوى</p>
      </div>
      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
        <Icon name="target" size={22} className="text-accent-600 mx-auto" />
        <p className="text-xl font-black text-accent-600 mt-1">{rate}%</p><p className="text-xs text-gray-500">الدقة</p>
      </div>
    </div>

    {/* Detailed Stats */}
    <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Icon name="bar_chart" size={20} className="text-primary-600" />الإحصائيات التفصيلية</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">الأسئلة المُجابة</span><span className="font-bold text-gray-900">{stats.total}</span></div>
        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">الإجابات الصحيحة</span><span className="font-bold text-accent-600">{stats.correct}</span></div>
        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">الدروس المكتملة</span><span className="font-bold text-primary-600">{stats.lessonsComplete}/{stats.totalLessons}</span></div>
        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">الامتحانات</span><span className="font-bold text-gray-900">{stats.passed}/{stats.exams} ناجح</span></div>
      </div>
    </div>

    {/* Edit Profile */}
    {editing ? (
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 space-y-3">
        <h3 className="font-bold text-gray-900 mb-2">تعديل الملف الشخصي</h3>
        <div><label className="text-sm font-bold text-gray-700 block mb-1">الاسم</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /></div>
        <div><label className="text-sm font-bold text-gray-700 block mb-1">كلمة مرور جديدة</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="اتركها فارغة إذا لم ترد التغيير" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /></div>
        <div className="flex gap-3">
          <button onClick={handleSave} className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm">حفظ</button>
          <button onClick={() => setEditing(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm">إلغاء</button>
        </div>
      </div>
    ) : null}

    {/* Actions */}
    <div className="space-y-2">
      {!editing && <button onClick={() => setEditing(true)} className="w-full bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3 hover:bg-gray-50"><Icon name="edit" size={22} className="text-primary-500" /><span className="font-bold text-gray-900">تعديل الملف الشخصي</span></button>}
      {isAdmin && <button onClick={() => onNavigate('admin')} className="w-full bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3 hover:bg-gray-50"><Icon name="admin_panel_settings" size={22} className="text-red-500" /><span className="font-bold text-gray-900">لوحة التحكم</span></button>}
      <button onClick={() => onNavigate('progress')} className="w-full bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3"><Icon name="trending_up" size={22} className="text-primary-500" /><span className="font-bold text-gray-900">إحصائياتي المفصلة</span></button>
      <button onClick={resetProgress} className="w-full bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3"><Icon name="restart_alt" size={22} className="text-orange-500" /><span className="font-bold text-gray-900">مسح بيانات التقدم</span></button>
      <button onClick={() => { logout(); showToast('تم الخروج', 'success'); onNavigate('landing'); }} className="w-full bg-red-50 rounded-xl p-4 border border-red-100 flex items-center gap-3"><Icon name="logout" size={22} className="text-red-500" /><span className="font-bold text-red-600">تسجيل الخروج</span></button>
    </div>
  </div>);
}

// ==================== ADMIN PANEL (FULL with Import/Export + Confirm Delete) ====================
function AdminPage({ onNavigate, showToast }: { onNavigate: (p: string) => void; showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('stats');
  if (!isAdmin) return <div className="p-8 text-center text-red-500">غير مصرح</div>;
  const tabs = [
    { id: 'stats', icon: 'dashboard', label: 'إحصائيات' },
    { id: 'categories', icon: 'category', label: 'الأقسام' },
    { id: 'lessons', icon: 'menu_book', label: 'الدروس' },
    { id: 'questions', icon: 'quiz', label: 'الأسئلة' },
    { id: 'signs', icon: 'signpost', label: 'الإشارات' },
    { id: 'glossary', icon: 'translate', label: 'القاموس' },
    { id: 'users', icon: 'people', label: 'المستخدمين' },
    { id: 'posts', icon: 'article', label: 'المنشورات' },
  ];
  return (
    <div className="pb-20 px-4 pt-4" dir="rtl">
      <div className="flex items-center gap-3 mb-4"><button onClick={() => onNavigate('dashboard')} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Icon name="arrow_forward" size={20} /></button><div><h1 className="text-xl font-black text-gray-900">لوحة التحكم</h1><p className="text-gray-500 text-xs">إدارة النظام</p></div></div>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1 ${tab === t.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}><Icon name={t.icon} size={14} />{t.label}</button>))}</div>
      {tab === 'stats' && <AdminStats />}
      {tab === 'categories' && <AdminCategories showToast={showToast} />}
      {tab === 'lessons' && <AdminLessons showToast={showToast} />}
      {tab === 'questions' && <AdminQuestions showToast={showToast} />}
      {tab === 'signs' && <AdminSigns showToast={showToast} />}
      {tab === 'glossary' && <AdminGlossary showToast={showToast} />}
      {tab === 'users' && <AdminUsers showToast={showToast} />}
      {tab === 'posts' && <AdminPosts showToast={showToast} />}
    </div>
  );
}

// ========== IMPORT/EXPORT HELPER ===========
function ImportExportBar({ tableName, onExport, onImport }: { tableName: string; onExport: () => void; onImport: (data: unknown[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data)) onImport(data);
        else alert('الملف يجب أن يحتوي على مصفوفة JSON');
      } catch { alert('خطأ في قراءة الملف'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  return (
    <div className="flex gap-2 mb-3">
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-200"><Icon name="upload" size={14} />استيراد {tableName}</button>
      <button onClick={onExport} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200"><Icon name="download" size={14} />تصدير {tableName}</button>
    </div>
  );
}

function downloadJSON(data: unknown[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function AdminStats() {
  const [s, setS] = useState({ users: 0, categories: 0, lessons: 0, questions: 0, signs: 0, glossary: 0, posts: 0, exams: 0, reports: 0, totalAnswers: 0, correctAnswers: 0, passedExams: 0, totalExams: 0, activeToday: 0 });
  useEffect(() => { (async () => {
    const today = new Date().toDateString();
    const allUsers = await db.users.toArray();
    const activeToday = allUsers.filter(u => u.lastActiveDate === today).length;
    const [cat, l, q, si, g, p, e, r, qp] = await Promise.all([db.categories.count(), db.lessons.count(), db.questions.count(), db.signs.count(), db.glossaryTerms.count(), db.posts.count(), db.exams.toArray(), db.reports.where('status').equals('pending').count(), db.questionProgress.toArray()]);
    setS({ users: allUsers.length, categories: cat, lessons: l, questions: q, signs: si, glossary: g, posts: p, exams: e.length, reports: r, totalAnswers: qp.length, correctAnswers: qp.filter(x => x.correct).length, passedExams: e.filter(x => x.passed).length, totalExams: e.length, activeToday });
  })(); }, []);
  const successRate = s.totalAnswers > 0 ? Math.round((s.correctAnswers / s.totalAnswers) * 100) : 0;
  const examPassRate = s.totalExams > 0 ? Math.round((s.passedExams / s.totalExams) * 100) : 0;
  return (
    <div>
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">{[
        { label: 'المستخدمين', value: s.users, icon: 'people', color: 'text-blue-600 bg-blue-100' },
        { label: 'نشطون اليوم', value: s.activeToday, icon: 'person_pin', color: 'text-green-600 bg-green-100' },
        { label: 'الأقسام', value: s.categories, icon: 'category', color: 'text-purple-600 bg-purple-100' },
        { label: 'الدروس', value: s.lessons, icon: 'menu_book', color: 'text-indigo-600 bg-indigo-100' },
        { label: 'الأسئلة', value: s.questions, icon: 'quiz', color: 'text-cyan-600 bg-cyan-100' },
        { label: 'الإشارات', value: s.signs, icon: 'signpost', color: 'text-red-600 bg-red-100' },
        { label: 'القاموس', value: s.glossary, icon: 'translate', color: 'text-orange-600 bg-orange-100' },
        { label: 'المنشورات', value: s.posts, icon: 'article', color: 'text-teal-600 bg-teal-100' },
        { label: 'الامتحانات', value: s.exams, icon: 'assignment', color: 'text-pink-600 bg-pink-100' },
        { label: 'البلاغات', value: s.reports, icon: 'flag', color: 'text-red-600 bg-red-100' },
      ].map((item, i) => (<div key={i} className="bg-white rounded-xl p-4 border border-gray-100"><div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${item.color}`}><Icon name={item.icon} size={20} /></div><p className="text-2xl font-black text-gray-900">{item.value}</p><p className="text-xs text-gray-500">{item.label}</p></div>))}</div>

      {/* Performance Charts */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Icon name="analytics" size={20} className="text-primary-600" />نسب الأداء العامة</h3>
        <div className="space-y-4">
          <div><div className="flex justify-between text-sm mb-1"><span className="text-gray-600">نسبة الإجابات الصحيحة</span><span className="font-bold text-accent-600">{successRate}%</span></div><div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-accent-500 rounded-full h-3 transition-all" style={{ width: `${successRate}%` }} /></div></div>
          <div><div className="flex justify-between text-sm mb-1"><span className="text-gray-600">نسبة النجاح في الامتحانات</span><span className="font-bold text-primary-600">{examPassRate}%</span></div><div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-primary-500 rounded-full h-3 transition-all" style={{ width: `${examPassRate}%` }} /></div></div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4"><div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-gray-900">{s.totalAnswers}</p><p className="text-xs text-gray-500">إجمالي الإجابات</p></div><div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-accent-600">{s.correctAnswers}</p><p className="text-xs text-gray-500">صحيحة</p></div><div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-danger-600">{s.totalAnswers - s.correctAnswers}</p><p className="text-xs text-gray-500">خاطئة</p></div></div>
      </div>
      {s.reports > 0 && <div className="bg-red-50 rounded-xl p-4 border border-red-200 flex items-center gap-3"><Icon name="flag" size={24} className="text-red-500" /><div><p className="font-bold text-red-700">{s.reports} بلاغ معلق</p><p className="text-red-600 text-xs">يحتاج مراجعة</p></div></div>}
    </div>
  );
}

function AdminCategories({ showToast }: { showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const [items, setItems] = useState<Category[]>([]); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Category | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [form, setForm] = useState({ nameAr: '', nameIt: '', descriptionAr: '', icon: 'category', color: '#2563eb', imageUrl: '', order: 1 });
  const load = () => db.categories.toArray().then(c => setItems(c.sort((a, b) => a.order - b.order)));
  useEffect(() => { load(); }, []);
  const save = async () => { if (!form.nameAr) return; if (editing) { await db.categories.update(editing.id, { ...form, updatedAt: new Date().toISOString() }); showToast('تم التحديث', 'success'); } else { await db.categories.add({ id: uuid(), ...form, isPublished: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); showToast('تم الإضافة', 'success'); } setModal(false); setEditing(null); setForm({ nameAr: '', nameIt: '', descriptionAr: '', icon: 'category', color: '#2563eb', imageUrl: '', order: 1 }); load(); };
  const del = async (id: string) => { await db.categories.delete(id); showToast('تم الحذف', 'info'); load(); };
  const edit = (c: Category) => { setEditing(c); setForm({ nameAr: c.nameAr, nameIt: c.nameIt, descriptionAr: c.descriptionAr, icon: c.icon, color: c.color, imageUrl: c.imageUrl, order: c.order }); setModal(true); };
  return (<div>
    <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-900">الأقسام ({items.length})</h3><button onClick={() => { setEditing(null); setForm({ nameAr: '', nameIt: '', descriptionAr: '', icon: 'category', color: '#2563eb', imageUrl: '', order: items.length + 1 }); setModal(true); }} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold flex items-center gap-1"><Icon name="add" size={16} />إضافة</button></div>
    <div className="space-y-2">{items.map(c => (<div key={c.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between"><div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">{c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white" style={{ background: c.color }}><Icon name={c.icon} size={20} /></div>}</div>
      <div><p className="font-bold text-gray-900 text-sm">{c.nameAr}</p><p className="text-gray-400 text-sm">{c.nameIt}</p></div></div><div className="flex gap-1"><button onClick={() => edit(c)} className="p-2 text-gray-400 hover:text-primary-500"><Icon name="edit" size={16} /></button><button onClick={() => setConfirm({ open: true, id: c.id })} className="p-2 text-gray-400 hover:text-red-500"><Icon name="delete" size={16} /></button></div></div>))}</div>
    <ConfirmDialog open={confirm.open} title="حذف القسم" message="هل أنت متأكد من حذف هذا القسم؟ لا يمكن التراجع." onConfirm={() => { del(confirm.id); setConfirm({ open: false, id: '' }); }} onCancel={() => setConfirm({ open: false, id: '' })} />
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل القسم' : 'إضافة قسم'}>
      <div className="space-y-3">
        <input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} placeholder="اسم القسم بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <input value={form.nameIt} onChange={e => setForm(p => ({ ...p, nameIt: e.target.value }))} placeholder="Nome in italiano" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <input value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} placeholder="الوصف" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <ImagePicker value={form.imageUrl} onChange={v => setForm(p => ({ ...p, imageUrl: v }))} label="صورة القسم" />
        <div className="flex gap-3"><input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="أيقونة Material" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="w-14 h-12 rounded-xl border border-gray-200 cursor-pointer" /></div>
        <input type="number" value={form.order} onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 1 }))} placeholder="الترتيب" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <button onClick={save} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold">حفظ</button>
      </div>
    </Modal>
  </div>);
}

function AdminLessons({ showToast }: { showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const [items, setItems] = useState<Lesson[]>([]); const [cats, setCats] = useState<Category[]>([]); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Lesson | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [form, setForm] = useState({ categoryId: '', titleAr: '', titleIt: '', descriptionAr: '', descriptionIt: '', contentAr: '', contentIt: '', imageUrl: '', icon: 'menu_book', color: '#2563eb', order: 1, isPublished: true });
  const load = () => { db.lessons.toArray().then(l => setItems(l.sort((a, b) => a.order - b.order))); db.categories.toArray().then(setCats); };
  useEffect(() => { load(); }, []);
  const save = async () => { if (!form.titleAr || !form.categoryId) return; if (editing) { await db.lessons.update(editing.id, { ...form, updatedAt: new Date().toISOString() }); showToast('تم التحديث', 'success'); } else { await db.lessons.add({ id: uuid(), ...form, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); showToast('تم الإضافة', 'success'); } setModal(false); setEditing(null); load(); };
  const del = async (id: string) => { await db.lessons.delete(id); showToast('تم الحذف', 'info'); load(); };
  const getCatName = (id: string) => cats.find(c => c.id === id)?.nameAr || '';
  const handleExport = async () => { const data = await db.lessons.toArray(); downloadJSON(data, 'lessons.json'); };
  const handleImport = async (data: unknown[]) => { const lessons = data as Lesson[]; for (const l of lessons) { await db.lessons.put(l); } showToast(`تم استيراد ${lessons.length} درس`, 'success'); load(); };
  return (<div>
    <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-900">الدروس ({items.length})</h3><button onClick={() => { setEditing(null); setForm({ categoryId: cats[0]?.id || '', titleAr: '', titleIt: '', descriptionAr: '', descriptionIt: '', contentAr: '', contentIt: '', imageUrl: '', icon: 'menu_book', color: '#2563eb', order: items.length + 1, isPublished: true }); setModal(true); }} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold flex items-center gap-1"><Icon name="add" size={16} />إضافة</button></div>
    <ImportExportBar tableName="الدروس" onExport={handleExport} onImport={handleImport} />
    <div className="space-y-2">{items.map(l => (<div key={l.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"><div className="flex items-center gap-3 flex-1 min-w-0"><div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: l.color }}><Icon name={l.icon} size={18} /></div><div className="min-w-0"><p className="font-bold text-gray-900 text-sm truncate">{l.titleAr}</p><p className="text-gray-400 text-xs">{getCatName(l.categoryId)}</p></div></div><div className="flex gap-1 shrink-0"><button onClick={() => { setEditing(l); setForm({ categoryId: l.categoryId, titleAr: l.titleAr, titleIt: l.titleIt, descriptionAr: l.descriptionAr, descriptionIt: l.descriptionIt, contentAr: l.contentAr, contentIt: l.contentIt, imageUrl: l.imageUrl, icon: l.icon, color: l.color, order: l.order, isPublished: l.isPublished }); setModal(true); }} className="p-2 text-gray-400 hover:text-primary-500"><Icon name="edit" size={16} /></button><button onClick={() => setConfirm({ open: true, id: l.id })} className="p-2 text-gray-400 hover:text-red-500"><Icon name="delete" size={16} /></button></div></div>))}</div>
    <ConfirmDialog open={confirm.open} title="حذف الدرس" message="هل أنت متأكد من حذف هذا الدرس؟" onConfirm={() => { del(confirm.id); setConfirm({ open: false, id: '' }); }} onCancel={() => setConfirm({ open: false, id: '' })} />
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل الدرس' : 'إضافة درس'}>
      <div className="space-y-3"><select value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm bg-white">{cats.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select><input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} placeholder="العنوان بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><input value={form.titleIt} onChange={e => setForm(p => ({ ...p, titleIt: e.target.value }))} placeholder="Titolo in italiano" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><input value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} placeholder="الوصف بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
      <ImagePicker value={form.imageUrl} onChange={v => setForm(p => ({ ...p, imageUrl: v }))} label="صورة الدرس" />
      <textarea value={form.contentIt} onChange={e => setForm(p => ({ ...p, contentIt: e.target.value }))} placeholder="المحتوى بالإيطالية" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" rows={3} /><textarea value={form.contentAr} onChange={e => setForm(p => ({ ...p, contentAr: e.target.value }))} placeholder="المحتوى بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" rows={5} /><div className="flex gap-3"><input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="أيقونة" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="w-14 h-12 rounded-xl border border-gray-200" /></div><div className="flex gap-3"><input type="number" value={form.order} onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 1 }))} placeholder="الترتيب" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={e => setForm(p => ({ ...p, isPublished: e.target.checked }))} className="w-5 h-5 rounded" />منشور</label></div><button onClick={save} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold">حفظ</button></div>
    </Modal>
  </div>);
}

function AdminQuestions({ showToast }: { showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const [items, setItems] = useState<Question[]>([]); const [lessons, setLessons] = useState<Lesson[]>([]); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Question | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [form, setForm] = useState({ textIt: '', textAr: '', correctAnswer: true, explanationAr: '', explanationIt: '', category: 'rules', difficulty: 'easy' as 'easy' | 'medium' | 'hard', lessonId: '' });
  const load = () => { db.questions.toArray().then(setItems); db.lessons.toArray().then(setLessons); };
  useEffect(() => { load(); }, []);
  const save = async () => { if (!form.textAr || !form.textIt) return; if (editing) { await db.questions.update(editing.id, { ...form }); showToast('تم التحديث', 'success'); } else { await db.questions.add({ id: uuid(), ...form, createdAt: new Date().toISOString() }); showToast('تم الإضافة', 'success'); } setModal(false); setEditing(null); load(); };
  const del = async (id: string) => { await db.questions.delete(id); showToast('تم الحذف', 'info'); load(); };
  const handleExport = async () => { const data = await db.questions.toArray(); downloadJSON(data, 'questions.json'); };
  const handleImport = async (data: unknown[]) => { const qs = data as Question[]; for (const q of qs) { await db.questions.put(q); } showToast(`تم استيراد ${qs.length} سؤال`, 'success'); load(); };
  return (<div>
    <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-900">الأسئلة ({items.length})</h3><button onClick={() => { setEditing(null); setForm({ textIt: '', textAr: '', correctAnswer: true, explanationAr: '', explanationIt: '', category: 'rules', difficulty: 'easy', lessonId: '' }); setModal(true); }} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold flex items-center gap-1"><Icon name="add" size={16} />إضافة</button></div>
    <ImportExportBar tableName="الأسئلة" onExport={handleExport} onImport={handleImport} />
    <div className="space-y-2">{items.slice(0, 50).map(q => (<div key={q.id} className="bg-white rounded-xl p-3 border border-gray-100"><div className="flex items-start justify-between"><p className="text-gray-900 text-sm font-bold flex-1">{q.textAr}</p><div className="flex gap-1 shrink-0 mr-2"><button onClick={() => { setEditing(q); setForm({ textIt: q.textIt, textAr: q.textAr, correctAnswer: q.correctAnswer, explanationAr: q.explanationAr, explanationIt: q.explanationIt, category: q.category, difficulty: q.difficulty, lessonId: q.lessonId || '' }); setModal(true); }} className="p-1 text-gray-400 hover:text-primary-500"><Icon name="edit" size={14} /></button><button onClick={() => setConfirm({ open: true, id: q.id })} className="p-1 text-gray-400 hover:text-red-500"><Icon name="delete" size={14} /></button></div></div><div className="flex gap-2 mt-1"><span className={`text-xs px-2 py-0.5 rounded ${q.correctAnswer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{q.correctAnswer ? 'صح' : 'خطأ'}</span><span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{q.difficulty}</span></div></div>))}{items.length > 50 && <p className="text-center text-gray-400 text-xs">عرض أول 50 سؤال من {items.length}</p>}</div>
    <ConfirmDialog open={confirm.open} title="حذف السؤال" message="هل أنت متأكد من حذف هذا السؤال؟" onConfirm={() => { del(confirm.id); setConfirm({ open: false, id: '' }); }} onCancel={() => setConfirm({ open: false, id: '' })} />
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل السؤال' : 'إضافة سؤال'}>
      <div className="space-y-3"><textarea value={form.textIt} onChange={e => setForm(p => ({ ...p, textIt: e.target.value }))} placeholder="نص السؤال بالإيطالية" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" rows={2} /><textarea value={form.textAr} onChange={e => setForm(p => ({ ...p, textAr: e.target.value }))} placeholder="نص السؤال بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" rows={2} /><div className="flex gap-3"><label className="flex items-center gap-2 text-sm flex-1"><input type="radio" checked={form.correctAnswer} onChange={() => setForm(p => ({ ...p, correctAnswer: true }))} />صح (Vero)</label><label className="flex items-center gap-2 text-sm flex-1"><input type="radio" checked={!form.correctAnswer} onChange={() => setForm(p => ({ ...p, correctAnswer: false }))} />خطأ (Falso)</label></div><textarea value={form.explanationAr} onChange={e => setForm(p => ({ ...p, explanationAr: e.target.value }))} placeholder="الشرح بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" rows={2} /><select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm bg-white"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select><select value={form.lessonId} onChange={e => setForm(p => ({ ...p, lessonId: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm bg-white"><option value="">بدون درس</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.titleAr}</option>)}</select><button onClick={save} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold">حفظ</button></div>
    </Modal>
  </div>);
}

function AdminSigns({ showToast }: { showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const [items, setItems] = useState<Sign[]>([]); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Sign | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [form, setForm] = useState({ nameAr: '', nameIt: '', descriptionAr: '', descriptionIt: '', category: 'warning' as Sign['category'], imageEmoji: '', imageUrl: '' });
  const load = () => db.signs.toArray().then(setItems);
  useEffect(() => { load(); }, []);
  const save = async () => { if (!form.nameAr) return; if (editing) { await db.signs.update(editing.id, { ...form }); showToast('تم التحديث', 'success'); } else { await db.signs.add({ id: uuid(), ...form, createdAt: new Date().toISOString() }); showToast('تم الإضافة', 'success'); } setModal(false); setEditing(null); load(); };
  const del = async (id: string) => { await db.signs.delete(id); showToast('تم الحذف', 'info'); load(); };
  const handleExport = async () => { const data = await db.signs.toArray(); downloadJSON(data, 'signs.json'); };
  const handleImport = async (data: unknown[]) => { const signs = data as Sign[]; for (const s of signs) { await db.signs.put(s); } showToast(`تم استيراد ${signs.length} إشارة`, 'success'); load(); };
  return (<div>
    <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-900">الإشارات ({items.length})</h3><button onClick={() => { setEditing(null); setForm({ nameAr: '', nameIt: '', descriptionAr: '', descriptionIt: '', category: 'warning', imageEmoji: '', imageUrl: '' }); setModal(true); }} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold flex items-center gap-1"><Icon name="add" size={16} />إضافة</button></div>
    <ImportExportBar tableName="الإشارات" onExport={handleExport} onImport={handleImport} />
    <div className="space-y-2">{items.map(s => (<div key={s.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"><div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">{s.imageUrl ? <img src={s.imageUrl} alt="" className="w-full h-full object-contain" /> : <span className="text-2xl">{s.imageEmoji}</span>}</div>
      <div><p className="font-bold text-gray-900 text-sm">{s.nameAr}</p><p className="text-gray-400 text-xs">{s.category}</p></div></div><div className="flex gap-1"><button onClick={() => { setEditing(s); setForm({ nameAr: s.nameAr, nameIt: s.nameIt, descriptionAr: s.descriptionAr, descriptionIt: s.descriptionIt, category: s.category, imageEmoji: s.imageEmoji, imageUrl: s.imageUrl || '' }); setModal(true); }} className="p-2 text-gray-400 hover:text-primary-500"><Icon name="edit" size={16} /></button><button onClick={() => setConfirm({ open: true, id: s.id })} className="p-2 text-gray-400 hover:text-red-500"><Icon name="delete" size={16} /></button></div></div>))}</div>
    <ConfirmDialog open={confirm.open} title="حذف الإشارة" message="هل أنت متأكد من حذف هذه الإشارة؟" onConfirm={() => { del(confirm.id); setConfirm({ open: false, id: '' }); }} onCancel={() => setConfirm({ open: false, id: '' })} />
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل الإشارة' : 'إضافة إشارة'}>
      <div className="space-y-3">
        <input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} placeholder="الاسم بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <input value={form.nameIt} onChange={e => setForm(p => ({ ...p, nameIt: e.target.value }))} placeholder="Nome in italiano" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <input value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} placeholder="الوصف بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <input value={form.descriptionIt} onChange={e => setForm(p => ({ ...p, descriptionIt: e.target.value }))} placeholder="Descrizione in italiano" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" />
        <ImagePicker value={form.imageUrl} onChange={v => setForm(p => ({ ...p, imageUrl: v }))} label="صورة الإشارة" />
        <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as Sign['category'] }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm bg-white"><option value="warning">خطر</option><option value="prohibition">منع</option><option value="obligation">إلزام</option><option value="priority">أولوية</option><option value="information">إرشاد</option><option value="temporary">مؤقتة</option></select>
        <button onClick={save} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold">حفظ</button>
      </div>
    </Modal>
  </div>);
}

function AdminGlossary({ showToast }: { showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const [items, setItems] = useState<GlossaryTerm[]>([]); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<GlossaryTerm | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [form, setForm] = useState({ termIt: '', termAr: '', definitionIt: '', definitionAr: '', category: 'general' });
  const load = () => db.glossaryTerms.toArray().then(setItems);
  useEffect(() => { load(); }, []);
  const save = async () => { if (!form.termAr || !form.termIt) return; if (editing) { await db.glossaryTerms.update(editing.id, { ...form }); showToast('تم التحديث', 'success'); } else { await db.glossaryTerms.add({ id: uuid(), ...form, createdAt: new Date().toISOString() }); showToast('تم الإضافة', 'success'); } setModal(false); setEditing(null); load(); };
  const del = async (id: string) => { await db.glossaryTerms.delete(id); showToast('تم الحذف', 'info'); load(); };
  const handleExport = async () => { const data = await db.glossaryTerms.toArray(); downloadJSON(data, 'glossary.json'); };
  const handleImport = async (data: unknown[]) => { const terms = data as GlossaryTerm[]; for (const t of terms) { await db.glossaryTerms.put(t); } showToast(`تم استيراد ${terms.length} مصطلح`, 'success'); load(); };
  return (<div>
    <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-900">القاموس ({items.length})</h3><button onClick={() => { setEditing(null); setForm({ termIt: '', termAr: '', definitionIt: '', definitionAr: '', category: 'general' }); setModal(true); }} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold flex items-center gap-1"><Icon name="add" size={16} />إضافة</button></div>
    <ImportExportBar tableName="القاموس" onExport={handleExport} onImport={handleImport} />
    <div className="space-y-2">{items.map(t => (<div key={t.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"><div><p className="font-bold text-gray-900 text-sm">{t.termAr}</p><p className="text-primary-600 text-sm" dir="ltr">{t.termIt}</p></div><div className="flex gap-1"><button onClick={() => { setEditing(t); setForm({ termIt: t.termIt, termAr: t.termAr, definitionIt: t.definitionIt, definitionAr: t.definitionAr, category: t.category }); setModal(true); }} className="p-2 text-gray-400 hover:text-primary-500"><Icon name="edit" size={16} /></button><button onClick={() => setConfirm({ open: true, id: t.id })} className="p-2 text-gray-400 hover:text-red-500"><Icon name="delete" size={16} /></button></div></div>))}</div>
    <ConfirmDialog open={confirm.open} title="حذف المصطلح" message="هل أنت متأكد من حذف هذا المصطلح؟" onConfirm={() => { del(confirm.id); setConfirm({ open: false, id: '' }); }} onCancel={() => setConfirm({ open: false, id: '' })} />
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل المصطلح' : 'إضافة مصطلح'}>
      <div className="space-y-3"><input value={form.termIt} onChange={e => setForm(p => ({ ...p, termIt: e.target.value }))} placeholder="المصطلح بالإيطالية" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><input value={form.termAr} onChange={e => setForm(p => ({ ...p, termAr: e.target.value }))} placeholder="المصطلح بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><input value={form.definitionIt} onChange={e => setForm(p => ({ ...p, definitionIt: e.target.value }))} placeholder="التعريف بالإيطالية" dir="ltr" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><input value={form.definitionAr} onChange={e => setForm(p => ({ ...p, definitionAr: e.target.value }))} placeholder="التعريف بالعربية" className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm" /><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm bg-white"><option value="general">عام</option><option value="roads">طرق</option><option value="rules">قواعد</option><option value="signals">إشارات</option><option value="safety">سلامة</option><option value="vehicle">مركبة</option><option value="maneuvers">مناورات</option></select><button onClick={save} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold">حفظ</button></div>
    </Modal>
  </div>);
}

function AdminUsers({ showToast }: { showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const load = () => db.users.toArray().then(us => setUsers(us.map(({ password: _, ...u }) => u)));
  useEffect(() => { load(); }, []);
  const toggleBan = async (id: string, banned: boolean) => { await db.users.update(id, { banned: !banned }); showToast(banned ? 'تم إلغاء الحظر' : 'تم الحظر', 'info'); load(); };
  return (<div className="space-y-2">{users.map(u => (<div key={u.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between"><div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-full flex items-center justify-center ${u.banned ? 'bg-red-100' : 'bg-primary-100'}`}><Icon name="person" size={18} className={u.banned ? 'text-red-600' : 'text-primary-600'} /></div><div><p className="font-bold text-gray-900 text-sm">{u.name}</p><p className="text-gray-400 text-xs">{u.email}</p></div></div><div className="flex items-center gap-2">{u.role === 'admin' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-lg">مدير</span>}{u.role !== 'admin' && <button onClick={() => toggleBan(u.id, u.banned)} className={`text-xs px-3 py-1 rounded-lg font-bold ${u.banned ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.banned ? 'إلغاء الحظر' : 'حظر'}</button>}</div></div>))}</div>);
}

function AdminPosts({ showToast }: { showToast: (m: string, t: 'success' | 'error' | 'info') => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [confirm, setConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const load = () => db.posts.toArray().then(setPosts);
  useEffect(() => { load(); }, []);
  const del = async (id: string) => { await db.posts.update(id, { isDeleted: true }); showToast('تم الحذف', 'info'); load(); };
  return (<div>
    <div className="space-y-2">{posts.map(p => (<div key={p.id} className={`bg-white rounded-xl p-4 border ${p.isDeleted ? 'border-red-200 opacity-50' : 'border-gray-100'}`}><div className="flex items-center justify-between mb-2"><span className="font-bold text-sm text-gray-900">{p.userName}</span>{!p.isDeleted && <button onClick={() => setConfirm({ open: true, id: p.id })} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg font-bold">حذف</button>}</div><p className="text-gray-700 text-sm">{p.content}</p>{p.isDeleted && <span className="text-xs text-red-500">محذوف</span>}</div>))}</div>
    <ConfirmDialog open={confirm.open} title="حذف المنشور" message="هل أنت متأكد من حذف هذا المنشور؟" onConfirm={() => { del(confirm.id); setConfirm({ open: false, id: '' }); }} onCancel={() => setConfirm({ open: false, id: '' })} />
  </div>);
}

// ==================== MAIN APP ====================
export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { seedDatabase().then(() => setReady(true)).catch(() => setReady(true)); }, []);
  if (!ready) return (<div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white" dir="rtl"><div className="text-center"><div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse"><Icon name="directions_car" size={32} className="text-white" /></div><p className="text-gray-500 font-medium">جارٍ تحميل التطبيق...</p></div></div>);
  return <AuthProvider><AppRouter /></AuthProvider>;
}

function AppRouter() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState(user ? 'dashboard' : 'landing');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => { if (!loading && user && ['landing', 'login', 'register'].includes(page)) setPage('dashboard'); if (!loading && !user && !['landing', 'login', 'register'].includes(page)) setPage('landing'); }, [user, loading, page]);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => { setToast({ message, type }); }, []);
  if (loading) return (<div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white" dir="rtl"><div className="text-center"><div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse"><Icon name="directions_car" size={32} className="text-white" /></div></div></div>);

  const navigate = (p: string) => { setPage(p); window.scrollTo(0, 0); };
  const isAuth = !!user;
  const isPublicPage = ['landing', 'login', 'register'].includes(page);
  const lessonId = page.startsWith('lesson-') ? page.replace('lesson-', '') : null;
  const categoryId = page.startsWith('category-') ? page.replace('category-', '') : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {page === 'landing' && <LandingPage onNavigate={navigate} />}
      {page === 'login' && <LoginPage onNavigate={navigate} showToast={showToast} />}
      {page === 'register' && <RegisterPage onNavigate={navigate} showToast={showToast} />}
      {isAuth && (<>
        {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        {page === 'lessons' && <LessonsPage onNavigate={navigate} />}
        {categoryId && <CategoryLessonsPage categoryId={categoryId} onNavigate={navigate} />}
        {lessonId && <LessonDetailPage lessonId={lessonId} onNavigate={navigate} showToast={showToast} />}
        {page === 'signs' && <SignsPage onNavigate={navigate} />}
        {page === 'practice' && <PracticePage onNavigate={navigate} showToast={showToast} />}
        {page === 'exam-sim' && <ExamSimPage onNavigate={navigate} showToast={showToast} />}
        {page === 'glossary' && <GlossaryPage onNavigate={navigate} />}
        {page === 'mistakes' && <MistakesPage onNavigate={navigate} />}
        {page === 'progress' && <ProgressPage onNavigate={navigate} />}
        {page === 'community' && <CommunityPage onNavigate={navigate} showToast={showToast} />}
        {page === 'profile' && <ProfilePage onNavigate={navigate} showToast={showToast} />}
        {page === 'admin' && <AdminPage onNavigate={navigate} showToast={showToast} />}
        {!isPublicPage && <BottomNav page={page} onNavigate={navigate} />}
      </>)}
    </div>
  );
}
