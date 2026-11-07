'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  BedDouble, 
  LayoutDashboard, 
  Users, 
  Building, 
  Bed, 
  CheckSquare, 
  CalendarCheck, 
  Search, 
  FileSpreadsheet, 
  Settings, 
  LogOut, 
  Bell, 
  Calendar, 
  ChevronDown, 
  User as UserIcon,
  Loader2,
  ShieldAlert,
  History,
  Menu,
  X,
  Plus,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Lock,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import GlobalSearch from '@/components/GlobalSearch';
import { api, AdminUser, UserRole } from '@/lib/api';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Rooms & Bed Inventory', href: '/dashboard/rooms', icon: Building },
  { name: 'Guest Registrations', href: '/dashboard/registrations', icon: Users },
  { name: 'Book / Allocate Beds', href: '/dashboard/allocate', icon: Bed },
  { name: 'Reception Desk (Check-In)', href: '/dashboard/reception', icon: CheckSquare },
  { name: 'Reports & Analytics', href: '/dashboard/reports', icon: FileSpreadsheet },
  { name: 'Activity Audit Trail', href: '/dashboard/activity', icon: History },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Role-based navigation items
  const filteredNavItems = navItems.filter((item) => {
    if (user?.role === 'RECEPTION_STAFF') {
      // Reception staff cannot access room inventory management or system settings
      return item.href !== '/dashboard/rooms' && item.href !== '/dashboard/activity';
    }
    return true;
  });

  // Enforce Reception Staff route restrictions
  useEffect(() => {
    if (user?.role === 'RECEPTION_STAFF' && pathname.startsWith('/dashboard/rooms')) {
      router.replace('/dashboard/reception');
    }
  }, [user, pathname, router]);

  // Staff Account Management Modal State (SUPER_ADMIN only)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [staffList, setStaffList] = useState<AdminUser[]>([]);
  const [staffLoading, setStaffLoading] = useState<boolean>(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  const [staffActiveTab, setStaffActiveTab] = useState<'LIST' | 'CREATE' | 'EDIT' | 'RESET_PW'>('LIST');

  // Search & Filters for Staff
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('ALL');
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>('ALL');

  // New Staff Form
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffEmail, setNewStaffEmail] = useState<string>('');
  const [newStaffPassword, setNewStaffPassword] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('RECEPTION_STAFF');
  const [newStaffPhone, setNewStaffPhone] = useState<string>('');
  const [staffSubmitting, setStaffSubmitting] = useState<boolean>(false);
  const [createdTempPasswordNotice, setCreatedTempPasswordNotice] = useState<{ email: string; tempPass: string } | null>(null);

  // Edit Staff Form
  const [editingStaff, setEditingStaff] = useState<AdminUser | null>(null);
  const [editStaffName, setEditStaffName] = useState<string>('');
  const [editStaffEmail, setEditStaffEmail] = useState<string>('');
  const [editStaffPhone, setEditStaffPhone] = useState<string>('');
  const [editStaffRole, setEditStaffRole] = useState<UserRole>('RECEPTION_STAFF');
  const [editStaffStatus, setEditStaffStatus] = useState<string>('ACTIVE');

  // Reset Staff Password State
  const [resettingStaff, setResettingStaff] = useState<AdminUser | null>(null);
  const [customTempPassword, setCustomTempPassword] = useState<string>('');
  const [resetResultTempPassword, setResetResultTempPassword] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState<boolean>(false);

  // User Change Own Password State
  const [isChangeOwnPasswordOpen, setIsChangeOwnPasswordOpen] = useState<boolean>(false);
  const [ownCurrentPassword, setOwnCurrentPassword] = useState<string>('');
  const [ownNewPassword, setOwnNewPassword] = useState<string>('');
  const [ownConfirmPassword, setOwnConfirmPassword] = useState<string>('');
  const [ownPasswordSubmitting, setOwnPasswordSubmitting] = useState<boolean>(false);
  const [ownPasswordError, setOwnPasswordError] = useState<string | null>(null);
  const [ownPasswordSuccess, setOwnPasswordSuccess] = useState<string | null>(null);

  const fetchStaffList = async (search?: string, role?: string, status?: string) => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      const res = await api.listStaff({
        q: search !== undefined ? search : staffSearchQuery,
        role: role !== undefined ? role : staffRoleFilter,
        status: status !== undefined ? status : staffStatusFilter,
      });
      if (res.success && res.data) {
        setStaffList(res.data);
      }
    } catch (err: any) {
      setStaffError(err.message || 'Failed to load staff list');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword.trim()) {
      setStaffError('Please provide Name, Email and Temporary Password.');
      return;
    }
    setStaffSubmitting(true);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const res = await api.createStaff({
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword.trim(),
        role: newStaffRole,
        phone: newStaffPhone.trim() || undefined,
        mustChangePassword: true,
      });

      if (res.success) {
        setCreatedTempPasswordNotice({
          email: newStaffEmail.trim(),
          tempPass: newStaffPassword.trim(),
        });
        setStaffSuccess(`Account created for ${newStaffName} (${newStaffRole})! Temporary password assigned.`);
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffPassword('');
        setNewStaffPhone('');
        await fetchStaffList();
      } else {
        setStaffError(res.message || 'Failed to create staff account');
      }
    } catch (err: any) {
      setStaffError(err.message || 'Error creating staff account');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleStartEdit = (staff: AdminUser) => {
    setEditingStaff(staff);
    setEditStaffName(staff.name);
    setEditStaffEmail(staff.email);
    setEditStaffPhone(staff.phone || '');
    setEditStaffRole(staff.role);
    setEditStaffStatus(staff.status);
    setStaffError(null);
    setStaffSuccess(null);
    setStaffActiveTab('EDIT');
  };

  const handleUpdateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setStaffSubmitting(true);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const res = await api.updateStaff(editingStaff.id, {
        name: editStaffName.trim(),
        email: editStaffEmail.trim(),
        phone: editStaffPhone.trim() || undefined,
        role: editStaffRole,
        status: editStaffStatus as any,
      });

      if (res.success) {
        setStaffSuccess(`Account details for ${editStaffName} updated successfully.`);
        setStaffActiveTab('LIST');
        setEditingStaff(null);
        await fetchStaffList();
      } else {
        setStaffError(res.message || 'Failed to update staff account');
      }
    } catch (err: any) {
      setStaffError(err.message || 'Error updating staff account');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleToggleStaffStatus = async (staff: AdminUser) => {
    const newStatus = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${actionLabel} account for ${staff.name}? ${newStatus === 'INACTIVE' ? 'All active sessions will be revoked immediately.' : ''}`)) {
      return;
    }

    setStaffLoading(true);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const res = await api.updateStaff(staff.id, { status: newStatus as any });
      if (res.success) {
        setStaffSuccess(`Account for ${staff.name} is now ${newStatus}. ${newStatus === 'INACTIVE' ? 'Active sessions revoked.' : ''}`);
        await fetchStaffList();
      } else {
        setStaffError(res.message || `Failed to ${actionLabel} account.`);
      }
    } catch (err: any) {
      setStaffError(err.message || `Error updating account status.`);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleStartResetPassword = (staff: AdminUser) => {
    setResettingStaff(staff);
    setCustomTempPassword(`Temp@${Math.random().toString(36).slice(-6)}1`);
    setResetResultTempPassword(null);
    setStaffError(null);
    setStaffSuccess(null);
    setStaffActiveTab('RESET_PW');
  };

  const handleAdminResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingStaff) return;

    setStaffSubmitting(true);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const res = await api.resetStaffPassword(resettingStaff.id, customTempPassword.trim() || undefined);
      if (res.success && res.data) {
        setResetResultTempPassword(res.data.temporaryPassword);
        setStaffSuccess(`Password reset completed for ${resettingStaff.name}. All active sessions were revoked.`);
        await fetchStaffList();
      } else {
        setStaffError(res.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setStaffError(err.message || 'Error resetting password');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staff: AdminUser) => {
    if (!confirm(`Are you sure you want to delete staff account ${staff.name} (${staff.email})? If they have audit or reservation history, their account will be safely deactivated to preserve data integrity.`)) {
      return;
    }

    setStaffLoading(true);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const res = await api.deleteStaff(staff.id);
      if (res.success) {
        setStaffSuccess(res.message || `Staff account ${staff.name} removed successfully.`);
        await fetchStaffList();
      } else {
        setStaffError(res.message || 'Failed to delete staff account');
      }
    } catch (err: any) {
      setStaffError(err.message || 'Error deleting staff account');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleOwnPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnPasswordError(null);
    setOwnPasswordSuccess(null);

    if (!ownCurrentPassword || !ownNewPassword) {
      setOwnPasswordError('Please enter both current and new passwords.');
      return;
    }

    if (ownNewPassword.length < 6) {
      setOwnPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (ownNewPassword !== ownConfirmPassword) {
      setOwnPasswordError('New password and confirmation do not match.');
      return;
    }

    setOwnPasswordSubmitting(true);
    try {
      const res = await api.changeOwnPassword({
        currentPassword: ownCurrentPassword,
        newPassword: ownNewPassword,
      });

      if (res.success) {
        setOwnPasswordSuccess('Password changed successfully! Your session has been updated.');
        setOwnCurrentPassword('');
        setOwnNewPassword('');
        setOwnConfirmPassword('');
        setTimeout(() => {
          setIsChangeOwnPasswordOpen(false);
          setOwnPasswordSuccess(null);
          window.location.reload();
        }, 1500);
      } else {
        setOwnPasswordError(res.message || 'Failed to change password.');
      }
    } catch (err: any) {
      setOwnPasswordError(err.message || 'Network error updating password.');
    } finally {
      setOwnPasswordSubmitting(false);
    }
  };

  // Protected route guard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent background scrolling while mobile navigation is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-slate-300">Authenticating secure session...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT SIDEBAR (Navy Blue Aesthetic from Reference Design)           */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-64 bg-slate-900 text-white shrink-0 hidden md:flex flex-col border-r border-slate-800">
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md">
            <BedDouble className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight leading-tight">
              Accommodation
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Management System
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Role Badge in Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN LAYOUT WRAPPER                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP APP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
          {/* Left: Mobile Hamburger & Search */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-xl mr-2 sm:mr-4 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden transition flex items-center justify-center shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Brand Icon */}
            <div className="flex items-center gap-1.5 shrink-0 md:hidden">
              <div className="p-1.5 bg-blue-600 rounded-lg text-white shadow-xs">
                <BedDouble className="w-4 h-4" />
              </div>
            </div>

            {/* Desktop Brand Header */}
            <h2 className="text-base font-bold text-slate-800 hidden lg:block shrink-0">
              MMDK Accommodation
            </h2>

            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Live Date Indicator (Matching Reference Image) */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>01 Nov 2026</span>
            </div>

            {/* Admin Staff Management Quick Button */}
            {user.role === 'SUPER_ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  setIsStaffModalOpen(true);
                  fetchStaffList();
                }}
                className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-xs"
                title="Staff Accounts"
              >
                <KeyRound className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Staff Accounts</span>
              </button>
            )}

            {/* Notification Bell */}
            <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600"></span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <p className="font-semibold text-slate-800 leading-tight">{user.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{user.role}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 text-xs animate-in fade-in"
                  onMouseLeave={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-semibold text-slate-800">{user.name}</p>
                    <p className="text-slate-500 truncate">{user.email}</p>
                    <div className="mt-1.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setIsChangeOwnPasswordOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 text-left font-medium transition"
                    >
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      <span>Change My Password</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 hover:bg-red-50 text-left font-medium transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* MOBILE SLIDE-OVER NAVIGATION DRAWER                                */}
        {/* ------------------------------------------------------------------ */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-150">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-in Drawer */}
            <div className="relative w-72 max-w-[85vw] bg-slate-900 text-white h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200 border-r border-slate-800">
              {/* Drawer Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md">
                    <BedDouble className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="font-bold text-sm tracking-tight leading-tight">
                      Accommodation
                    </h1>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Management System
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  aria-label="Close navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
                {filteredNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-500'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* User Profile & Sign Out Footer */}
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                      <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-blue-900/60 text-blue-300 border border-blue-700/50">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8">
          {children}
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* ADMIN STAFF ACCOUNTS & PERMISSIONS MODAL (CRUD)                    */}
        {/* ------------------------------------------------------------------ */}
        {isStaffModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-4 sm:my-8 max-h-[94vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg text-white">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Staff Accounts &amp; Access Control</h3>
                    <p className="text-xs text-slate-400">Manage administrator, manager, and reception desk login credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsStaffModalOpen(false);
                    setStaffActiveTab('LIST');
                    setEditingStaff(null);
                    setResettingStaff(null);
                    setCreatedTempPasswordNotice(null);
                    setResetResultTempPassword(null);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-Tabs Bar */}
              <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setStaffActiveTab('LIST');
                    setStaffError(null);
                    setStaffSuccess(null);
                  }}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition ${
                    staffActiveTab === 'LIST'
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Staff Directory ({staffList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStaffActiveTab('CREATE');
                    setStaffError(null);
                    setStaffSuccess(null);
                  }}
                  className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition ${
                    staffActiveTab === 'CREATE'
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Staff Account</span>
                </button>

                {staffActiveTab === 'EDIT' && editingStaff && (
                  <button
                    type="button"
                    className="pb-3 px-3 border-b-2 border-amber-600 text-amber-700 font-bold flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Staff: {editingStaff.name}</span>
                  </button>
                )}

                {staffActiveTab === 'RESET_PW' && resettingStaff && (
                  <button
                    type="button"
                    className="pb-3 px-3 border-b-2 border-rose-600 text-rose-700 font-bold flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Reset Password: {resettingStaff.name}</span>
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Alerts */}
                {staffError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span className="font-medium">{staffError}</span>
                  </div>
                )}
                {staffSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="font-medium">{staffSuccess}</span>
                  </div>
                )}

                {/* 1. STAFF DIRECTORY TAB */}
                {staffActiveTab === 'LIST' && (
                  <div className="space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search name, email, login ID..."
                          value={staffSearchQuery}
                          onChange={(e) => {
                            setStaffSearchQuery(e.target.value);
                            fetchStaffList(e.target.value, staffRoleFilter, staffStatusFilter);
                          }}
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                          value={staffRoleFilter}
                          onChange={(e) => {
                            setStaffRoleFilter(e.target.value);
                            fetchStaffList(staffSearchQuery, e.target.value, staffStatusFilter);
                          }}
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ALL">All Roles</option>
                          <option value="RECEPTION_STAFF">RECEPTION_STAFF</option>
                          <option value="ALLOCATION_MANAGER">ALLOCATION_MANAGER</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>

                        <select
                          value={staffStatusFilter}
                          onChange={(e) => {
                            setStaffStatusFilter(e.target.value);
                            fetchStaffList(staffSearchQuery, staffRoleFilter, e.target.value);
                          }}
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => fetchStaffList()}
                          title="Refresh list"
                          className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${staffLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Staff Accounts Table */}
                    {staffLoading ? (
                      <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading staff directory...</span>
                      </div>
                    ) : staffList.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
                        No staff accounts found matching your filters.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs shadow-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                              <th className="py-2.5 px-3.5">Staff Member</th>
                              <th className="py-2.5 px-3.5">Role</th>
                              <th className="py-2.5 px-3.5">Status</th>
                              <th className="py-2.5 px-3.5">Security</th>
                              <th className="py-2.5 px-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {staffList.map((s) => {
                              const isCurrentUser = user.id === s.id;
                              return (
                                <tr key={s.id} className="hover:bg-slate-50/80 transition">
                                  <td className="py-3 px-3.5">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[11px] uppercase shrink-0">
                                        {s.name.charAt(0)}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                                          <span>{s.name}</span>
                                          {isCurrentUser && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                                              You
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-[11px] text-slate-500 font-mono">{s.email}</p>
                                        {s.phone && <p className="text-[10px] text-slate-400">Ph: {s.phone}</p>}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3 px-3.5">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                      s.role === 'SUPER_ADMIN'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : s.role === 'RECEPTION_STAFF'
                                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                        : s.role === 'ALLOCATION_MANAGER'
                                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                                    }`}>
                                      {s.role}
                                    </span>
                                  </td>

                                  <td className="py-3 px-3.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                      s.status === 'ACTIVE'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                                      {s.status}
                                    </span>
                                  </td>

                                  <td className="py-3 px-3.5">
                                    {s.mustChangePassword ? (
                                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        Must Change PW
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Active</span>
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit(s)}
                                        title="Edit staff details"
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleStartResetPassword(s)}
                                        title="Reset password & revoke active sessions"
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:text-amber-700 text-slate-600 transition"
                                      >
                                        <KeyRound className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleStaffStatus(s)}
                                        disabled={isCurrentUser}
                                        title={s.status === 'ACTIVE' ? 'Deactivate account & revoke sessions' : 'Activate account'}
                                        className={`p-1.5 rounded-lg border transition ${
                                          s.status === 'ACTIVE'
                                            ? 'border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600'
                                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                                      >
                                        <Lock className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteStaff(s)}
                                        disabled={isCurrentUser}
                                        title="Delete staff account"
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. CREATE STAFF TAB */}
                {staffActiveTab === 'CREATE' && (
                  <form onSubmit={handleCreateStaffSubmit} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Plus className="w-4 h-4 text-blue-600" />
                          <span>Create New Staff Account</span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Create individual credentials for Receptionists, Allocation Managers, or System Admins.
                        </p>
                      </div>
                    </div>

                    {createdTempPasswordNotice && (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Account Created with Temporary Password
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`Username: ${createdTempPasswordNotice.email}\nTemporary Password: ${createdTempPasswordNotice.tempPass}`);
                              setCopiedPass(true);
                              setTimeout(() => setCopiedPass(false), 2000);
                            }}
                            className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1 transition"
                          >
                            {copiedPass ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-emerald-600" />}
                            <span>{copiedPass ? 'Copied!' : 'Copy Credentials'}</span>
                          </button>
                        </div>
                        <p className="text-xs font-mono bg-white p-2.5 rounded-lg border border-emerald-200 select-all">
                          Login ID: <strong className="text-slate-900">{createdTempPasswordNotice.email}</strong><br />
                          Temporary Password: <strong className="text-blue-700">{createdTempPasswordNotice.tempPass}</strong>
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          The user must change this temporary password upon their first login before they can access the system.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ramesh Reception Desk"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email (Login ID) *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. reception1@ashram.org"
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Temporary Password (min 6 chars) *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            minLength={6}
                            placeholder="e.g. Staff@12345"
                            value={newStaffPassword}
                            onChange={(e) => setNewStaffPassword(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setNewStaffPassword(`Temp@${Math.random().toString(36).slice(-5)}`)}
                            className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold shrink-0"
                          >
                            Generate
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Role &amp; Permissions *
                        </label>
                        <select
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="RECEPTION_STAFF">🔑 RECEPTION_STAFF (Walk-ins, Check-in/out, Room Changes)</option>
                          <option value="ALLOCATION_MANAGER">📋 ALLOCATION_MANAGER (Manage allocations &amp; Rooms)</option>
                          <option value="SUPER_ADMIN">👑 SUPER_ADMIN (Full system access)</option>
                          <option value="VIEWER">👁️ VIEWER (Read-only)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Contact Phone Number (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. 9876543210"
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setStaffActiveTab('LIST')}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={staffSubmitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        {staffSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Creating Account...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Create Account</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* 3. EDIT STAFF TAB */}
                {staffActiveTab === 'EDIT' && editingStaff && (
                  <form onSubmit={handleUpdateStaffSubmit} className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-amber-600" />
                          <span>Edit Staff Account: {editingStaff.name}</span>
                        </h4>
                        <p className="text-xs text-slate-500">Update account profile, login ID, role, or active status.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={editStaffName}
                          onChange={(e) => setEditStaffName(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email (Login ID) *
                        </label>
                        <input
                          type="email"
                          required
                          value={editStaffEmail}
                          onChange={(e) => setEditStaffEmail(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Role &amp; Permissions *
                        </label>
                        <select
                          value={editStaffRole}
                          onChange={(e) => setEditStaffRole(e.target.value as UserRole)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="RECEPTION_STAFF">🔑 RECEPTION_STAFF</option>
                          <option value="ALLOCATION_MANAGER">📋 ALLOCATION_MANAGER</option>
                          <option value="SUPER_ADMIN">👑 SUPER_ADMIN</option>
                          <option value="VIEWER">👁️ VIEWER</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Account Status *
                        </label>
                        <select
                          value={editStaffStatus}
                          onChange={(e) => setEditStaffStatus(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="ACTIVE">ACTIVE (Authorized to login)</option>
                          <option value="INACTIVE">INACTIVE (Access blocked, sessions revoked)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={editStaffPhone}
                          onChange={(e) => setEditStaffPhone(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStaffActiveTab('LIST');
                          setEditingStaff(null);
                        }}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={staffSubmitting}
                        className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        {staffSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating Staff...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* 4. RESET PASSWORD TAB */}
                {staffActiveTab === 'RESET_PW' && resettingStaff && (
                  <form onSubmit={handleAdminResetPasswordSubmit} className="p-5 rounded-2xl bg-rose-50/40 border border-rose-200 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-rose-600" />
                          <span>Reset Password for {resettingStaff.name}</span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Set a temporary password. Active sessions for this account will be invalidated immediately.
                        </p>
                      </div>
                    </div>

                    {resetResultTempPassword ? (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Password Reset Completed
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(resetResultTempPassword);
                              setCopiedPass(true);
                              setTimeout(() => setCopiedPass(false), 2000);
                            }}
                            className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1 transition"
                          >
                            {copiedPass ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-emerald-600" />}
                            <span>{copiedPass ? 'Copied!' : 'Copy Password'}</span>
                          </button>
                        </div>
                        <p className="text-xs font-mono bg-white p-2.5 rounded-lg border border-emerald-200 select-all">
                          Temporary Password: <strong className="text-rose-700">{resetResultTempPassword}</strong>
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Provide this temporary password to the staff member. They will be required to change it on their next login.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStaffActiveTab('LIST');
                              setResettingStaff(null);
                              setResetResultTempPassword(null);
                            }}
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                          >
                            Back to Staff Directory
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>Security Protocol:</strong> Resetting this password will revoke all active login sessions for <strong>{resettingStaff.email}</strong>. The user must provide a new personal password when they sign in.
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            New Temporary Password (min 6 chars) *
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              required
                              minLength={6}
                              value={customTempPassword}
                              onChange={(e) => setCustomTempPassword(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <button
                              type="button"
                              onClick={() => setCustomTempPassword(`Temp@${Math.random().toString(36).slice(-5)}`)}
                              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold shrink-0"
                            >
                              Randomize
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStaffActiveTab('LIST');
                              setResettingStaff(null);
                            }}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={staffSubmitting}
                            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                          >
                            {staffSubmitting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Resetting Password...</span>
                              </>
                            ) : (
                              <>
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Confirm Reset &amp; Revoke Sessions</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* USER CHANGE OWN PASSWORD MODAL                                     */}
        {/* ------------------------------------------------------------------ */}
        {isChangeOwnPasswordOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold">Change My Password</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangeOwnPasswordOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleOwnPasswordSubmit} className="p-6 space-y-4 text-xs">
                {ownPasswordError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{ownPasswordError}</span>
                  </div>
                )}
                {ownPasswordSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{ownPasswordSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={ownCurrentPassword}
                    onChange={(e) => setOwnCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    New Password (min 6 chars) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={ownNewPassword}
                    onChange={(e) => setOwnNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={ownConfirmPassword}
                    onChange={(e) => setOwnConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChangeOwnPasswordOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={ownPasswordSubmitting}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    {ownPasswordSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MANDATORY FIRST LOGIN PASSWORD CHANGE OVERLAY                      */}
        {/* ------------------------------------------------------------------ */}
        {user?.mustChangePassword && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-5 bg-blue-600 text-white text-center">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-2 text-white shadow-inner">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Set Your New Password</h3>
                <p className="text-xs text-blue-100 mt-1">
                  You signed in with a temporary password. For security compliance, please set your permanent password before proceeding.
                </p>
              </div>

              <form onSubmit={handleOwnPasswordSubmit} className="p-6 space-y-4 text-xs">
                {ownPasswordError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{ownPasswordError}</span>
                  </div>
                )}
                {ownPasswordSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{ownPasswordSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Temporary / Current Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter the password you logged in with"
                    value={ownCurrentPassword}
                    onChange={(e) => setOwnCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    New Permanent Password (min 6 chars) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Choose a strong password"
                    value={ownNewPassword}
                    onChange={(e) => setOwnNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Confirm New Permanent Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Re-enter your new password"
                    value={ownConfirmPassword}
                    onChange={(e) => setOwnConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={ownPasswordSubmitting}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm text-xs"
                  >
                    {ownPasswordSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Password &amp; Continue</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
