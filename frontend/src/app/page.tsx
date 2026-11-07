'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Database, 
  Server, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  Layers,
  BedDouble,
  LogIn,
  LayoutDashboard
} from 'lucide-react';
import { api, HealthCheckData } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getHealth();
      if (response.success && response.data) {
        setHealth(response.data);
      } else {
        setError(response.message || 'Failed to connect to backend API');
      }
    } catch (err: any) {
      setError(err.message || 'Network error reaching backend');
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <BedDouble className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Accommodation Management System</h1>
            <p className="text-xs text-slate-400">Enterprise Registration, Room Inventory & Allocation</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!authLoading && user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Go to Dashboard</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Admin Login</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-700/60 text-blue-200 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" /> Phase 3 Authentication Live
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Accommodation Management Portal
            </h2>
            <p className="text-blue-100 text-sm leading-relaxed">
              Secure enterprise management system for event accommodations, room inventory, manual unit allocations, reception confirmation, and check-in/out tracking.
            </p>

            <div className="pt-2 flex items-center gap-3">
              {!authLoading && user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 text-sm font-bold shadow-md transition"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Open Admin Dashboard ({user.name})</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold shadow-md transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Connectivity Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Backend Status Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Server className="w-5 h-5" />
                </span>
                {health?.status === 'UP' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                    <XCircle className="w-3.5 h-3.5" /> Disconnected
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-slate-800 text-base">Backend REST API</h3>
              <p className="text-xs text-slate-500 mt-1">Node.js Express + TypeScript Server</p>
              
              <div className="mt-4 space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Endpoint:</span>
                  <span className="font-mono font-medium">http://localhost:5000/api</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Auth Engine:</span>
                  <span className="font-medium text-emerald-600">JWT + HttpOnly Cookies</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rate Limiter:</span>
                  <span className="font-medium text-blue-600">Active (5 Attempts/15m)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
              <span>Auth Route: <code className="text-slate-600 font-mono">/api/auth/login</code></span>
            </div>
          </div>

          {/* Database Status Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Database className="w-5 h-5" />
                </span>
                {health?.database.status === 'CONNECTED' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <XCircle className="w-3.5 h-3.5" /> Pending
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-slate-800 text-base">PostgreSQL 18 Database</h3>
              <p className="text-xs text-slate-500 mt-1">Prisma Client + btree_gist Constraints</p>

              <div className="mt-4 space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Database:</span>
                  <span className="font-mono font-medium">accommodation_db</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Exclusion Guards:</span>
                  <span className="font-medium text-emerald-600">Active (Unit & Stay)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Query Latency:</span>
                  <span className="font-medium text-emerald-600 font-mono">
                    {health?.database.latencyMs !== undefined ? `${health.database.latencyMs} ms` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
              <span>Capacity Sync: <span className="text-slate-600 font-medium">Auto-Trigger Active</span></span>
            </div>
          </div>

          {/* Frontend Application Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Layers className="w-5 h-5" />
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              </div>
              <h3 className="font-semibold text-slate-800 text-base">Frontend Client</h3>
              <p className="text-xs text-slate-500 mt-1">Next.js 14 App Router + Tailwind CSS</p>

              <div className="mt-4 space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Auth Guard:</span>
                  <span className="font-medium text-blue-600">Active (Dashboard)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Token Storage:</span>
                  <span className="font-medium text-emerald-600">Zero localStorage</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Visual Theme:</span>
                  <span className="font-medium">Navy & Slate Dashboard</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
              <span>Session: <span className="text-slate-600 font-medium">{user ? user.email : 'Not Logged In'}</span></span>
            </div>
          </div>
        </div>

        {/* Live Test & Response Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                System Diagnostics & Pipeline Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify backend REST health and database connectivity
              </p>
            </div>
            
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-mono">
              Error: {error}
            </div>
          )}

          {health && (
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
              <pre>{JSON.stringify(health, null, 2)}</pre>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 bg-white">
        Accommodation Management System &bull; Phase 3 Admin Authentication Active &bull; Node.js v22 &bull; PostgreSQL 18
      </footer>
    </div>
  );
}
