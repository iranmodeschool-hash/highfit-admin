import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  KeyRound,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';

const API_URL = 'https://highfit-api.liara.run';
const PAGE_SIZE = 8;

type User = {
  id: string | number;
  username: string;
  email: string;
  role: string;
  createdAt?: string;
  created_at?: string;
  joinedAt?: string;
};

type ApiResponse = {
  token?: string;
  accessToken?: string;
  role?: string;
  user?: { role?: string };
  data?: { token?: string; accessToken?: string; role?: string; user?: { role?: string }; users?: User[] };
  users?: User[];
  message?: string;
  error?: string;
};

type LoginErrorPayload = {
  message?: string;
  error?: string;
  detail?: string;
};

type Role = 'workshop_manager' | 'supervisor' | 'admin';
type Toast = { message: string; type: 'success' | 'error' };

function getRole(payload: ApiResponse) {
  return payload.role ?? payload.user?.role ?? payload.data?.role ?? payload.data?.user?.role;
}

function getToken(payload: ApiResponse) {
  return payload.token ?? payload.accessToken ?? payload.data?.token ?? payload.data?.accessToken;
}

function getUsers(payload: ApiResponse): User[] {
  return payload.users ?? payload.data?.users ?? (Array.isArray(payload) ? payload as unknown as User[] : []);
}

function getRoleLabel(role: string) {
  if (role === 'workshop_manager') return 'مسئول کارگاه';
  if (role === 'supervisor') return 'ناظر';
  if (role === 'admin') return 'مدیر کل';
  return role || '—';
}

function formatDate(date?: string) {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('highfit_admin_token'));
  const [isLogin, setIsLogin] = useState(!token);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [deletingUserId, setDeletingUserId] = useState<string | number | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    fetch(`${API_URL}/api/admin/users`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'دریافت فهرست کاربران انجام نشد');
        return payload as ApiResponse;
      })
      .then((payload) => setUsers(getUsers(payload)))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'خطایی در دریافت اطلاعات رخ داد'))
      .finally(() => setLoading(false));
  }, [token]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !query || [user.username, user.email].some((value) => String(value).toLowerCase().includes(query));
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search, users]);

  const adminCount = users.filter((user) => user.role === 'admin').length;
  const workshopManagerCount = users.filter((user) => user.role === 'workshop_manager').length;

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const visibleUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('https://highfit-api.liara.run/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      const payload = responseBody as ApiResponse;
      if (!response.ok) {
        const errorPayload = responseBody as LoginErrorPayload | string | null;
        const serverError = typeof errorPayload === 'string'
          ? errorPayload
          : errorPayload?.message ?? errorPayload?.error ?? errorPayload?.detail;
        throw new Error(serverError || response.statusText || 'ورود انجام نشد');
      }
      if (getRole(payload) !== 'admin') throw new Error('شما دسترسی مدیریتی ندارید');
      const nextToken = getToken(payload);
      if (!nextToken) throw new Error('اطلاعات ورود از سرور کامل دریافت نشد');
      localStorage.setItem('highfit_admin_token', nextToken);
      setToken(nextToken);
      setIsLogin(false);
    } catch (reason: unknown) {
      setLoginError(reason instanceof Error ? reason.message : 'ورود انجام نشد');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setCreateLoading(true);
    setCreateError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: form.get('username'),
          email: form.get('email'),
          password: form.get('password'),
          role: form.get('role'),
          workshop_id: form.get('workshop_id') || null,
        }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorPayload = responseBody as LoginErrorPayload | string | null;
        const serverError = typeof errorPayload === 'string'
          ? errorPayload
          : errorPayload?.message ?? errorPayload?.error ?? errorPayload?.detail;
        throw new Error(serverError || response.statusText || 'ساخت کاربر انجام نشد');
      }
      const usersResponse = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const usersBody: unknown = await usersResponse.json().catch(() => null);
      if (!usersResponse.ok) throw new Error('کاربر ساخته شد، اما بروزرسانی فهرست انجام نشد');
      setUsers(getUsers(usersBody as ApiResponse));
      setPage(1);
      setCreateModalOpen(false);
      setToast({ message: 'کاربر جدید با موفقیت ساخته شد', type: 'success' });
    } catch (reason: unknown) {
      setCreateError(reason instanceof Error ? reason.message : 'ساخت کاربر انجام نشد');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDeleteUser(user: User) {
    if (!token || !window.confirm(`آیا از حذف کاربر «${user.username}» مطمئن هستید؟`)) return;
    setDeletingUserId(user.id);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorPayload = responseBody as LoginErrorPayload | string | null;
        const serverError = typeof errorPayload === 'string'
          ? errorPayload
          : errorPayload?.message ?? errorPayload?.error ?? errorPayload?.detail;
        throw new Error(serverError || response.statusText || 'حذف کاربر انجام نشد');
      }
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
      setToast({ message: 'کاربر با موفقیت حذف شد', type: 'success' });
    } catch (reason: unknown) {
      setToast({ message: reason instanceof Error ? reason.message : 'حذف کاربر انجام نشد', type: 'error' });
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !passwordModalUser) return;
    setPasswordLoading(true);
    setPasswordError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${passwordModalUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: form.get('newPassword') }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorPayload = responseBody as LoginErrorPayload | string | null;
        const serverError = typeof errorPayload === 'string'
          ? errorPayload
          : errorPayload?.message ?? errorPayload?.error ?? errorPayload?.detail;
        throw new Error(serverError || response.statusText || 'تغییر رمز عبور انجام نشد');
      }
      setPasswordModalUser(null);
      setToast({ message: 'رمز عبور با موفقیت تغییر کرد', type: 'success' });
    } catch (reason: unknown) {
      setPasswordError(reason instanceof Error ? reason.message : 'تغییر رمز عبور انجام نشد');
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleRoleChange(user: User, nextRole: Role) {
    if (!token || nextRole === user.role) return;
    setUpdatingUserId(user.id);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorPayload = responseBody as LoginErrorPayload | string | null;
        const serverError = typeof errorPayload === 'string'
          ? errorPayload
          : errorPayload?.message ?? errorPayload?.error ?? errorPayload?.detail;
        throw new Error(serverError || response.statusText || 'تغییر نقش انجام نشد');
      }
      setUsers((currentUsers) => currentUsers.map((currentUser) => currentUser.id === user.id ? { ...currentUser, role: nextRole } : currentUser));
      setToast({ message: 'نقش کاربر با موفقیت تغییر کرد', type: 'success' });
    } catch (reason: unknown) {
      setToast({ message: reason instanceof Error ? reason.message : 'تغییر نقش انجام نشد', type: 'error' });
    } finally {
      setUpdatingUserId(null);
    }
  }

  function logout() {
    localStorage.removeItem('highfit_admin_token');
    setToken(null);
    setIsLogin(true);
    setUsers([]);
    setSidebarOpen(false);
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (isLogin) return <LoginPage loading={loginLoading} error={loginError} onSubmit={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800" dir="rtl">
      {toast && <div className={`fixed left-5 top-24 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-5 py-4 text-sm font-bold shadow-xl ${toast.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`} role="status"><span className={`h-2.5 w-2.5 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />{toast.message}</div>}
      {sidebarOpen && <button aria-label="بستن منو" className="fixed inset-0 z-20 bg-slate-950/45 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 right-0 z-30 w-72 bg-[#0d1d36] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-24 items-center justify-between border-b border-white/10 px-7">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 font-black text-xl shadow-lg shadow-blue-500/20">H</div><div><p className="text-xl font-black tracking-tight">های‌فیت</p><p className="text-[11px] text-slate-400">پنل مدیریت</p></div></div>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="بستن"><X size={20} /></button>
        </div>
        <nav className="space-y-2 px-4 py-8">
          <p className="mb-4 px-4 text-[11px] font-bold tracking-widest text-slate-500">منوی اصلی</p>
          <button className="flex w-full items-center gap-3 rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-bold shadow-lg shadow-blue-900/20"><Grid2X2 size={19} /> داشبورد</button>
          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"><Users size={19} /> کاربران <span className="mr-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{users.length}</span></button>
        </nav>
        <div className="absolute bottom-7 right-5 left-5 rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700"><ShieldCheck size={19} /></div><div><p className="text-xs font-bold">حساب مدیر</p><p className="mt-1 text-[10px] text-slate-400">دسترسی کامل سیستم</p></div></div></div>
      </aside>

      <main className="min-h-screen lg:mr-72">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 shadow-sm sm:px-8">
          <div className="flex items-center gap-3"><button aria-label="باز کردن منو" className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><div className="relative hidden sm:block"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="جستجو در کاربران..." className="h-11 w-64 rounded-lg border border-slate-200 bg-slate-50 pr-10 pl-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10" /></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="اعلان‌ها"><Bell size={20} /></button></div>
          <div className="flex items-center gap-3"><div className="hidden text-left sm:block"><p className="text-sm font-bold text-slate-700">مدیر سیستم</p><p className="mt-0.5 text-[11px] text-slate-400">Administrator</p></div><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700"><UserRound size={20} /></div><button onClick={logout} className="flex items-center gap-2 rounded-lg bg-[#10233f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"><LogOut size={17} /> <span className="hidden sm:inline">خروج</span></button></div>
        </header>

        <section className="p-5 sm:p-8"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm font-medium text-blue-600">خوش آمدید، مدیر</p><h1 className="text-2xl font-black text-slate-900 sm:text-3xl">داشبورد کاربران</h1><p className="mt-2 text-sm text-slate-500">مدیریت و مشاهده کاربران سامانه های‌فیت</p></div><div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-500 shadow-sm"><Users size={18} className="text-blue-600" /> مجموع کاربران: <strong className="text-slate-800">{users.length}</strong></div></div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="کل کاربران" value={users.length} icon={<Users size={20} />} tone="blue" /><StatCard label="مدیران کل" value={adminCount} icon={<ShieldCheck size={20} />} tone="navy" /><StatCard label="مسئولین کارگاه" value={workshopManagerCount} icon={<LockKeyhole size={20} />} tone="emerald" /></div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-800">فهرست کاربران</h2><p className="mt-1 text-xs text-slate-400">جستجو، فیلتر و مدیریت دسترسی کاربران</p></div><button onClick={() => { setCreateError(''); setCreateModalOpen(true); }} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-md shadow-blue-600/15 transition hover:bg-blue-700"><span className="text-lg leading-none">+</span> افزودن کاربر جدید</button></div></div>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4"><div className="relative min-w-[220px] flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="جستجو بر اساس نام کاربری یا ایمیل" className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" /></div><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as 'all' | Role); setPage(1); }} className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:border-blue-400"><option value="all">همه نقش‌ها</option><option value="workshop_manager">مسئول کارگاه</option><option value="supervisor">ناظر</option><option value="admin">مدیر کل</option></select></div>{error && <div className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">{loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><span className="ml-3 h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" /> در حال دریافت کاربران...</div> : <table className="w-full min-w-[720px] text-right text-sm"><thead className="bg-slate-50 text-xs font-bold text-slate-500"><tr><th className="px-5 py-4">شناسه</th><th className="px-5 py-4">نام کاربری</th><th className="px-5 py-4">ایمیل</th><th className="px-5 py-4">نقش</th><th className="px-5 py-4">تاریخ عضویت</th><th className="px-5 py-4">عملیات</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleUsers.map((user) => <tr key={user.id} className="transition hover:bg-blue-50/40"><td className="px-5 py-4 font-mono text-xs text-slate-500">{user.id}</td><td className="px-5 py-4 font-bold text-slate-700">{user.username || '—'}</td><td className="px-5 py-4 text-slate-500">{user.email || '—'}</td><td className="px-5 py-4"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${user.role === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{getRoleLabel(user.role)}</span></td><td className="px-5 py-4 text-slate-500">{formatDate(user.createdAt ?? user.created_at ?? user.joinedAt)}</td><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><select value={user.role} disabled={updatingUserId === user.id || deletingUserId === user.id} onChange={(event) => void handleRoleChange(user, event.target.value as Role)} className="h-9 min-w-28 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-wait disabled:opacity-60"><option value="workshop_manager">مسئول کارگاه</option><option value="supervisor">ناظر</option><option value="admin">مدیر کل</option></select><button onClick={() => { setPasswordError(''); setPasswordModalUser(user); }} disabled={deletingUserId === user.id} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50" title="تغییر رمز"><KeyRound size={14} /> رمز</button><button onClick={() => void handleDeleteUser(user)} disabled={deletingUserId === user.id} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-50" title="حذف کاربر"><Trash2 size={14} /> حذف</button></div></td></tr>)}{!visibleUsers.length && <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">کاربری برای نمایش پیدا نشد.</td></tr>}</tbody></table>}</div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-xs text-slate-500"><span>نمایش {visibleUsers.length ? (page - 1) * PAGE_SIZE + 1 : 0} تا {Math.min(page * PAGE_SIZE, filteredUsers.length)} از {filteredUsers.length} کاربر</span><div className="flex items-center gap-1"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50" aria-label="صفحه قبل"><ChevronRight size={16} /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((item) => <button key={item} onClick={() => setPage(item)} className={`h-8 min-w-8 rounded-md border px-2 text-xs font-bold ${page === item ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{item}</button>)}<button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50" aria-label="صفحه بعد"><ChevronLeft size={16} /></button></div></div>
          </div>
        </section>
      </main>
      {createModalOpen && <CreateUserModal loading={createLoading} error={createError} onClose={() => !createLoading && setCreateModalOpen(false)} onSubmit={handleCreateUser} />}
      {passwordModalUser && <PasswordModal user={passwordModalUser} loading={passwordLoading} error={passwordError} onClose={() => !passwordLoading && setPasswordModalUser(null)} onSubmit={handlePasswordChange} />}
    </div>
  );
}

function CreateUserModal({ loading, error, onClose, onSubmit }: { loading: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-5" role="dialog" aria-modal="true" aria-labelledby="create-user-title"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><h2 id="create-user-title" className="text-lg font-black text-slate-900">افزودن کاربر جدید</h2><p className="mt-1 text-xs text-slate-400">اطلاعات کاربر جدید را وارد کنید.</p></div><button onClick={onClose} disabled={loading} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40" aria-label="بستن"><X size={20} /></button></div><form onSubmit={onSubmit} className="space-y-5 p-6"><div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">نام کاربری</span><input required name="username" className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="نام کاربری" /></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">ایمیل</span><input required type="email" name="email" className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="email@example.com" /></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">رمز عبور</span><input required type="password" name="password" minLength={6} className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="رمز عبور" /></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">نقش</span><select name="role" defaultValue="workshop_manager" className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"><option value="workshop_manager">مسئول کارگاه</option><option value="supervisor">ناظر</option><option value="admin">مدیر کل</option></select></label></div><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">شناسه کارگاه <span className="font-normal text-slate-400">(اختیاری)</span></span><input name="workshop_id" className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="شناسه کارگاه" /></label>{error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}<div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={loading} className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">انصراف</button><button disabled={loading} className="flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">{loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'ثبت کاربر'}</button></div></form></div></div>;
}

function PasswordModal({ user, loading, error, onClose, onSubmit }: { user: User; loading: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-5" role="dialog" aria-modal="true" aria-labelledby="password-title"><div className="w-full max-w-md rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><h2 id="password-title" className="text-lg font-black text-slate-900">تغییر رمز عبور</h2><p className="mt-1 text-xs text-slate-400">رمز جدید برای {user.username} ثبت می‌شود.</p></div><button onClick={onClose} disabled={loading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40" aria-label="بستن"><X size={20} /></button></div><form onSubmit={onSubmit} className="space-y-5 p-6"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">رمز عبور جدید</span><input required minLength={6} type="password" name="newPassword" autoComplete="new-password" className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="حداقل ۶ کاراکتر" /></label>{error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}<div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={loading} className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">انصراف</button><button disabled={loading} className="flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">{loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'ثبت رمز جدید'}</button></div></form></div></div>;
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: 'blue' | 'navy' | 'emerald' }) {
  const toneClasses = { blue: 'bg-blue-50 text-blue-600', navy: 'bg-slate-100 text-slate-700', emerald: 'bg-emerald-50 text-emerald-600' };
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-slate-900">{value}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClasses[tone]}`}>{icon}</div></div></div>;
}

function LoginPage({ loading, error, onSubmit }: { loading: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#eef2f7] px-5 py-10"><div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-300/40 lg:grid-cols-[1fr_1.05fr]"><div className="hidden flex-col justify-between bg-[#0d1d36] p-12 text-white lg:flex"><div><div className="mb-16 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 text-xl font-black">H</div><div><p className="text-2xl font-black">های‌فیت</p><p className="text-xs text-slate-400">پنل مدیریت</p></div></div><h1 className="max-w-sm text-4xl font-black leading-[1.35]">مدیریت هوشمند،<br /><span className="text-blue-400">رشد ماندگار.</span></h1><p className="mt-6 max-w-sm text-sm leading-8 text-slate-400">به پنل مدیریت های‌فیت وارد شوید و اطلاعات کاربران را در یک نگاه مدیریت کنید.</p></div><p className="text-xs text-slate-500">HighFit Admin Panel · ۱۴۰۳</p></div><div className="p-7 sm:p-12"><div className="mb-10 lg:hidden"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0d1d36] text-xl font-black text-white">H</div><p className="text-xl font-black text-slate-900">های‌فیت</p></div><div className="mb-8"><h2 className="text-2xl font-black text-slate-900">ورود به حساب مدیریت</h2><p className="mt-2 text-sm text-slate-500">برای ادامه، اطلاعات حساب خود را وارد کنید.</p></div><form onSubmit={onSubmit} className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">ایمیل</span><div className="relative"><UserRound className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="email" name="email" autoComplete="email" className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pr-10 pl-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="ایمیل خود را وارد کنید" /></div></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">رمز عبور</span><div className="relative"><LockKeyhole className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required type="password" name="password" autoComplete="current-password" className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pr-10 pl-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="رمز عبور خود را وارد کنید" /></div></label>{error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}<button disabled={loading} className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">{loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'ورود به پنل'}</button></form><p className="mt-8 text-center text-xs text-slate-400">این بخش فقط برای مدیران مجاز قابل دسترسی است.</p></div></div></main>;
}

export default App;
