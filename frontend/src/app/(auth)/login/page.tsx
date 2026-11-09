'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  BedDouble, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle, 
  Loader2,
  KeyRound
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';

const loginSchema = z.object({
  email: z.string().trim().min(3, 'Please enter a valid email or login identifier'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { user, login, loading: authLoading } = useAuth();
  const { success: notifySuccess, error: notifyError } = useNotification();
  const [loginRole, setLoginRole] = useState<'ADMIN' | 'RECEPTION'>('ADMIN');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // If already authenticated, redirect directly based on role
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'RECEPTION_STAFF') {
        router.push('/dashboard/reception');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await login(values);
      if (res.success) {
        notifySuccess(`Welcome back, ${res.user?.name || 'Administrator'}!`);
        if (res.user?.role === 'RECEPTION_STAFF') {
          router.push('/dashboard/reception');
        } else {
          router.push('/dashboard');
        }
      } else {
        const msg = res.message || 'Invalid email or password.';
        setErrorMessage(msg);
        notifyError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred during login.';
      setErrorMessage(msg);
      notifyError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-900/30 to-transparent pointer-events-none blur-3xl" />

      {/* Header / Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 space-y-2 sm:space-y-3">
        <div className="inline-flex items-center justify-center p-3 sm:p-3.5 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 text-white mb-1 sm:mb-2">
          <BedDouble className="w-8 h-8 sm:w-9 sm:h-9" />
        </div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white">
          Accommodation Management
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          {loginRole === 'RECEPTION' ? 'Reception Desk & Operations Sign In' : 'Sign in to the administrative portal'}
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md px-1 sm:px-0 relative z-10">
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-2xl rounded-2xl border border-slate-100">
          {/* Portal Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginRole('ADMIN');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                loginRole === 'ADMIN'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Admin / Manager
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginRole('RECEPTION');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                loginRole === 'RECEPTION'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Reception Staff
            </button>
          </div>

          {loginRole === 'RECEPTION' && (
            <div className="mb-5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Reception Staff Portal:</span> Use individual staff credentials assigned by the administrator. Directs to live desk, allocations, and check-ins.
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {/* Error Alert */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {loginRole === 'RECEPTION' ? 'Staff Email / Login ID' : 'Admin Email'}
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder={loginRole === 'RECEPTION' ? 'reception@accommodation.local' : 'gurusthan.mmdk@arunachalam'}
                  suppressHydrationWarning
                  {...register('email')}
                  className={`block w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition ${
                    errors.email ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  suppressHydrationWarning
                  {...register('password')}
                  className={`block w-full pl-10 pr-10 py-2.5 text-sm text-slate-900 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition ${
                    errors.password ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || authLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 min-h-[44px] border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{loginRole === 'RECEPTION' ? 'Sign In to Reception Desk' : 'Sign In as Administrator'}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-2.5 text-xs text-slate-500 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Encrypted Session &bull; HttpOnly Cookie Protected</span>
          </div>
        </div>

        {/* Development Credential Pill */}
        <div className="mt-4 text-center space-y-2">
          <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="text-left">
              <p className="text-[11px] font-semibold text-slate-400">Default Super Admin</p>
              <p className="font-mono text-slate-200 text-xs break-all sm:break-normal">admin@accommodation.local &bull; Admin@123</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoginRole('ADMIN');
                setValue('email', 'admin@accommodation.local');
                setValue('password', 'Admin@123');
              }}
              className="w-full sm:w-auto px-3 py-1.5 text-xs font-bold text-blue-300 bg-blue-900/50 hover:bg-blue-800/60 rounded-lg border border-blue-500/30 transition text-center"
            >
              Fill Admin
            </button>
          </div>
          <p className="text-slate-400 text-[11px]">
            Reception staff accounts can be created and managed by administrators in <span className="text-blue-400 font-medium">Dashboard &rarr; Staff Accounts</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
