'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar, 
  User, 
  ShieldCheck, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Eye, 
  X,
  Loader2,
  Users,
  Bed,
  CheckCircle2,
  LogOut,
  ArrowRightLeft,
  CalendarCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';

interface ActivityLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: any;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface ActivityInsights {
  todayRegistrations: number;
  todayAllocations: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  currentInHouse: number;
  recentTransfers: number;
  recentAllocationChanges: number;
  recentStaffActivity: any[];
}

export default function ActivityLogPage() {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useNotification();
  
  // Data states
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [insights, setInsights] = useState<ActivityInsights | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  // Load staff list on mount
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await api.getActivityStaff();
        if (res.success && Array.isArray(res.data)) {
          setStaffList(res.data);
        }
      } catch (err) {
        console.error('Failed to load staff list:', err);
      }
    };
    fetchStaff();
  }, []);

  // Fetch activity logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit,
      };

      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (selectedEntity !== 'ALL') params.entityType = selectedEntity;
      if (selectedAction !== 'ALL') params.action = selectedAction;
      if (selectedStaff !== 'ALL') params.userId = selectedStaff;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.getActivityLogs(params);
      if (res.success && Array.isArray(res.data)) {
        setLogs(res.data);
        if (res.pagination) {
          setTotal(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        }
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, searchQuery, selectedEntity, selectedAction, selectedStaff, startDate, endDate]);

  // Fetch operational insights
  const fetchInsights = useCallback(async () => {
    try {
      const res = await api.getActivityInsights();
      if (res.success && res.data) {
        setInsights(res.data);
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
    fetchInsights();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedEntity('ALL');
    setSelectedAction('ALL');
    setSelectedStaff('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Export filtered logs to Excel
  const handleExport = async () => {
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ALLOCATION_MANAGER') {
      notifyWarning('Audit log export is restricted to Super Admin and Allocation Managers.');
      return;
    }

    setExporting(true);
    notifyInfo('Generating audit log export...');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedEntity !== 'ALL') params.append('entityType', selectedEntity);
      if (selectedAction !== 'ALL') params.append('action', selectedAction);
      if (selectedStaff !== 'ALL') params.append('userId', selectedStaff);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/activity/export?${params.toString()}`;
      
      const res = await fetch(downloadUrl, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Export request failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notifySuccess('Audit log exported successfully.');
    } catch (err: any) {
      console.error('Export error:', err);
      notifyError('Failed to export activity logs.');
    } finally {
      setExporting(false);
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ALLOCATE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'CONFIRM':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'CHECK_IN':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CHECK_OUT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'TRANSFER':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'UPDATE':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'CANCEL':
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'STATUS_CHANGE':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const formatSummary = (log: ActivityLogItem) => {
    const d = log.details;
    if (!d || typeof d !== 'object') return `${log.action} ${log.entityType}`;

    if (d.action === 'LOGIN_SUCCESS') return `Staff logged in successfully (${d.email || ''})`;
    if (d.action === 'LOGOUT_SUCCESS') return `Staff logged out (${d.email || ''})`;
    if (d.primaryName) return `Registration for ${d.primaryName} (${d.totalMembers || 1} members)`;
    if (d.allocationNumber) return `Allocation ${d.allocationNumber} modified or updated`;
    if (d.roomNumber) return `Room ${d.roomNumber} updated/managed`;
    if (d.transferReason) return `Room transferred: ${d.transferReason}`;
    if (d.conflictType) return `Extension conflict checked`;
    if (d.reason) return `Note/Reason: ${d.reason}`;
    if (d.lastFourDigits) return `Aadhaar verification recorded (Ending: ${d.lastFourDigits})`;

    return `${log.action} on ${log.entityType} (${log.entityId.slice(0, 8)}...)`;
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* TOP HEADER & ACTIONS                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Operational Audit Trail & Activity Logs
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Immutable chronological record of all administrative, registration, room allocation, and reception actions
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER') && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export Audit Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* OPERATIONAL SUMMARY INSIGHT CARDS                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Today's Regs</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {insights?.todayRegistrations ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Created today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Allocations</span>
            <Bed className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {insights?.todayAllocations ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Assigned today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Check-ins</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {insights?.todayCheckIns ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Arrived today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Checkouts</span>
            <LogOut className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {insights?.todayCheckOuts ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Departed today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">In-House</span>
            <CalendarCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {insights?.currentInHouse ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Current guests</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Transfers</span>
            <ArrowRightLeft className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {insights?.recentTransfers ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Last 7 days</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FILTER & SEARCH CONTROL BAR                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search ID, action, staff..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Action Type Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="ALLOCATE">ALLOCATE</option>
              <option value="CONFIRM">CONFIRM</option>
              <option value="CHECK_IN">CHECK_IN</option>
              <option value="CHECK_OUT">CHECK_OUT</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="UPDATE">UPDATE</option>
              <option value="CANCEL">CANCEL</option>
              <option value="DELETE">DELETE</option>
              <option value="STATUS_CHANGE">STATUS_CHANGE</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            >
              <option value="ALL">All Entities</option>
              <option value="REGISTRATION">REGISTRATION</option>
              <option value="ALLOCATION">ALLOCATION</option>
              <option value="ROOM">ROOM</option>
              <option value="UNIT">UNIT (Bed/Mat)</option>
              <option value="PARTICIPANT">PARTICIPANT</option>
              <option value="RECEPTION">RECEPTION</option>
              <option value="AADHAAR">AADHAAR</option>
              <option value="MESSAGE">WHATSAPP MESSAGE</option>
              <option value="ADMIN_USER">STAFF / AUTH</option>
            </select>
          </div>

          {/* Staff Member Filter */}
          <div>
            <select
              value={selectedStaff}
              onChange={(e) => {
                setSelectedStaff(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            >
              <option value="ALL">All Staff Members</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.role})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AUDIT LOG TABLE & TIMELINE                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Audit Entries ({total.toLocaleString()} total)</span>
          </div>

          <div className="text-xs text-slate-500">
            Showing Page {page} of {totalPages || 1}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Operational Summary</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span>Loading immutable audit records...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No activity records found matching the active filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const logDate = new Date(log.createdAt);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>

                      {/* Staff Member */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                            {log.user?.name ? log.user.name.charAt(0) : 'S'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 truncate max-w-[130px]">
                              {log.user?.name || 'System / Auto'}
                            </p>
                            <span className="inline-block text-[9px] font-mono text-slate-500">
                              {log.user?.role || 'SYSTEM'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 text-[11px]">
                            {log.entityType}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]" title={log.entityId}>
                            {log.entityId}
                          </span>
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                        {formatSummary(log)}
                      </td>

                      {/* Action View */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Clean Touch-Friendly Audit Cards */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <span>Loading audit logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No activity records found matching criteria.
            </div>
          ) : (
            logs.map((log) => {
              const logDate = new Date(log.createdAt);
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 cursor-pointer hover:bg-blue-50/40 transition active:scale-98"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[11px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                        {log.action}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {log.entityType}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium line-clamp-2">
                    {typeof log.details === 'string'
                      ? log.details
                      : log.details?.summary || log.details?.message || JSON.stringify(log.details)}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="font-medium text-slate-700">
                      👤 {log.user?.name || 'System / Auto'}
                    </span>
                    <span className="text-blue-600 font-bold flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Details
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {logs.length} of {total.toLocaleString()} records
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium text-slate-700 px-2">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((prev) => (prev < totalPages ? prev + 1 : prev))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AUDIT LOG DETAIL MODAL                                             */}
      {/* ------------------------------------------------------------------ */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-4">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Activity Audit Record #{selectedLog.id.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {new Date(selectedLog.createdAt).toISOString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Privacy Notice Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Audit Integrity & Privacy:</strong> Passwords, session tokens, and Aadhaar numbers are never logged or stored in audit payloads.
                </span>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Staff Member</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{selectedLog.user?.name || 'System Auto'}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedLog.user?.email || 'N/A'}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Staff Role</span>
                  <p className="font-semibold text-blue-700 mt-0.5 font-mono">{selectedLog.user?.role || 'SYSTEM'}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Client IP</span>
                  <p className="font-mono text-slate-800 mt-0.5">{selectedLog.ipAddress || 'Internal'}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Action Performed</span>
                  <div className="mt-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getActionBadgeClass(selectedLog.action)}`}>
                      {selectedLog.action}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Entity Type</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{selectedLog.entityType}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Entity ID</span>
                  <p className="font-mono text-slate-800 mt-0.5 truncate" title={selectedLog.entityId}>
                    {selectedLog.entityId}
                  </p>
                </div>
              </div>

              {/* JSON Payload Viewer */}
              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                  Change Snapshot & Audit Details (JSON)
                </span>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Log UUID: {selectedLog.id}
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition shadow-xs"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
