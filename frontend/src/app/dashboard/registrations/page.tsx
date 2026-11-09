'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Eye, 
  Edit2, 
  Archive, 
  RotateCcw, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Plus, 
  Minus,
  Calendar, 
  Phone, 
  MapPin, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  api, 
  RegistrationListItem, 
  RegistrationStatus, 
  CreateRegistrationInput, 
  UpdateRegistrationInput,
  ExcelPreviewRow 
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';

export default function RegistrationsPage() {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useNotification();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER';

  // State
  const [registrations, setRegistrations] = useState<RegistrationListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, _setErrorMessage] = useState<string | null>(null);
  const [successMessage, _setSuccessMessage] = useState<string | null>(null);

  const setSuccessMessage = React.useCallback((msg: string | null) => {
    _setSuccessMessage(msg);
    if (msg) notifySuccess(msg);
  }, [notifySuccess]);

  const setErrorMessage = React.useCallback((msg: string | null) => {
    _setErrorMessage(msg);
    if (msg) notifyError(msg);
  }, [notifyError]);

  // Pagination & Filtering
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [metrics, setMetrics] = useState<any>({
    totalRegistrations: 0,
    totalMembers: 0,
    REGISTERED: 0,
    ALLOCATED: 0,
    CONFIRMED: 0,
    CHECKED_IN: 0,
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [editingRegistration, setEditingRegistration] = useState<RegistrationListItem | null>(null);

  // Create Registration Form State
  const [newReg, setNewReg] = useState<CreateRegistrationInput>({
    primaryName: '',
    gender: 'MALE',
    primaryGender: 'MALE',
    mobile: '',
    email: '',
    city: '',
    state: '',
    totalMembers: 1,
    registrationDate: new Date().toISOString().slice(0, 10),
    status: 'REGISTERED',
    notes: '',
    accompanyingMembers: [],
  });

  // Edit Registration Form State
  const [editForm, setEditForm] = useState<UpdateRegistrationInput>({
    primaryName: '',
    gender: 'MALE',
    primaryGender: 'MALE',
    mobile: '',
    email: '',
    city: '',
    state: '',
    totalMembers: 1,
    status: 'REGISTERED',
    notes: '',
  });

  // Excel Import States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<ExcelPreviewRow[]>([]);
  const [importStats, setImportStats] = useState<{ total: number; valid: number; invalid: number; duplicate: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Auto-dismiss messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Load Registrations
  const fetchRegistrations = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getRegistrations({
        page,
        limit,
        q: searchQuery,
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        isArchived: showArchived,
      });

      if (res.success && res.data) {
        setRegistrations(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.totalCount);
          setTotalPages(res.pagination.totalPages);
        }
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      } else {
        setErrorMessage(res.message || 'Failed to load registrations');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [page, limit, statusFilter, showArchived]);

  // Debounced Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchRegistrations();
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery, startDate, endDate]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleOpenCreate = () => {
    setNewReg({
      primaryName: '',
      mobile: '',
      email: '',
      city: '',
      state: '',
      totalMembers: 1,
      registrationDate: new Date().toISOString().slice(0, 10),
      status: 'REGISTERED',
      notes: '',
      accompanyingMembers: [],
    });
    setIsCreateOpen(true);
  };

  const handleAddAccompanyingRow = () => {
    setNewReg((prev) => ({
      ...prev,
      accompanyingMembers: [
        ...(prev.accompanyingMembers || []),
        { fullName: '', phone: '', gender: null, age: null, relationToPrimary: '' },
      ],
      // If adding members, automatically adjust totalMembers if count exceeds
      totalMembers: Math.max(prev.totalMembers || 1, (prev.accompanyingMembers?.length || 0) + 2),
    }));
  };

  const handleRemoveAccompanyingRow = (index: number) => {
    setNewReg((prev) => ({
      ...prev,
      accompanyingMembers: (prev.accompanyingMembers || []).filter((_, i) => i !== index),
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReg.primaryName.trim() || !newReg.mobile.trim()) {
      setErrorMessage('Primary registrant name and mobile number are required');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.createRegistration({
        ...newReg,
        totalMembers: Number(newReg.totalMembers) || 1,
        accompanyingMembers: (newReg.accompanyingMembers || []).filter((m) => m.fullName.trim()),
      });

      if (res.success && res.data) {
        setSuccessMessage(`Registration ${res.data.registrationId} created successfully for ${res.data.primaryName}.`);
        setIsCreateOpen(false);
        await fetchRegistrations();
      } else {
        setErrorMessage(res.message || 'Failed to create registration');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (reg: RegistrationListItem) => {
    setEditingRegistration(reg);
    setEditForm({
      primaryName: reg.primaryName,
      mobile: reg.mobile,
      email: reg.email || '',
      city: reg.city || '',
      state: reg.state || '',
      totalMembers: reg.totalMembers,
      status: reg.status,
      notes: reg.notes || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistration) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.updateRegistration(editingRegistration.id, {
        ...editForm,
        totalMembers: Number(editForm.totalMembers) || 1,
      });

      if (res.success && res.data) {
        setSuccessMessage(`Registration ${res.data.registrationId} updated successfully.`);
        setIsEditOpen(false);
        await fetchRegistrations();
      } else {
        setErrorMessage(res.message || 'Failed to update registration');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async (reg: RegistrationListItem) => {
    if (!confirm(`Are you sure you want to archive Registration ${reg.registrationId}? Historical allocation data will be preserved.`)) {
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.archiveRegistration(reg.id);
      if (res.success) {
        setSuccessMessage(`Registration ${reg.registrationId} has been archived.`);
        await fetchRegistrations();
      } else {
        setErrorMessage(res.message || 'Failed to archive registration');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error archiving registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (reg: RegistrationListItem) => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.restoreRegistration(reg.id);
      if (res.success) {
        setSuccessMessage(`Registration ${reg.registrationId} restored successfully.`);
        await fetchRegistrations();
      } else {
        setErrorMessage(res.message || 'Failed to restore registration');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error restoring registration');
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Excel File Import Logic
  // --------------------------------------------------------------------------

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setPreviewLoading(true);
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet);

      if (jsonRows.length === 0) {
        setErrorMessage('The uploaded Excel file contains no data rows.');
        setPreviewLoading(false);
        return;
      }

      // Send to backend preview endpoint for validation & duplicate detection
      const previewRes = await api.previewRegistrationImport({ rows: jsonRows });
      if (previewRes.success && previewRes.data) {
        setImportPreviewRows(previewRes.data.rows);
        setImportStats({
          total: previewRes.data.totalRows,
          valid: previewRes.data.validRows,
          invalid: previewRes.data.invalidRows,
          duplicate: previewRes.data.duplicateRows,
        });
      } else {
        setErrorMessage(previewRes.message || 'Failed to validate Excel import');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read Excel file');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    const validRows = importPreviewRows.filter((r) => r.isValid).map((r) => r.data);
    if (validRows.length === 0) {
      setErrorMessage('No valid rows found to import.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.executeRegistrationImport(validRows);
      if (res.success && res.data) {
        setSuccessMessage(`Successfully imported ${res.data.importedCount} registrations.`);
        setIsImportOpen(false);
        setImportFile(null);
        setImportPreviewRows([]);
        setImportStats(null);
        await fetchRegistrations();
      } else {
        setErrorMessage(res.message || 'Failed to complete batch import');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing batch import');
    } finally {
      setActionLoading(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case 'REGISTERED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Registered</span>;
      case 'ALLOCATED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Allocated</span>;
      case 'CONFIRMED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Confirmed</span>;
      case 'CHECKED_IN':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">Checked In</span>;
      case 'CHECKED_OUT':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">Checked Out</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER SECTION                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Guest Registrations
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              Guest Directory
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            View registered guests, add new groups or individuals, and import/export guest lists via Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh */}
          <button
            onClick={() => fetchRegistrations()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>

          {/* Download Template */}
          <a
            href={api.getTemplateDownloadUrl()}
            download="registration_template.xlsx"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
            title="Download Excel Template for Bulk Import"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Template
          </a>

          {/* Export Excel */}
          <a
            href={api.getExportRegistrationsUrl({ q: searchQuery, status: statusFilter, startDate, endDate })}
            download="registrations_export.xlsx"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export (.xlsx)
          </a>

          {canManage && (
            <>
              {/* Import Excel */}
              <button
                onClick={() => {
                  setImportFile(null);
                  setImportPreviewRows([]);
                  setImportStats(null);
                  setIsImportOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-sm transition"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                Import Excel
              </button>

              {/* Add Registration */}
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
              >
                <UserPlus className="w-4 h-4" />
                New Registration
              </button>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ALERTS / NOTIFICATIONS                                             */}
      {/* ------------------------------------------------------------------ */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Operation Notice</p>
              <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Success</p>
              <p className="text-xs text-emerald-700 mt-0.5">{successMessage}</p>
            </div>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* METRIC KPI CARDS                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registrations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Registrations</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalRegistrations}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {metrics.REGISTERED} Registered &bull; {metrics.ALLOCATED} Allocated
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Total Registered Members */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Members</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalMembers}</h3>
            <p className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> Multi-member capacity registered
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <UserPlus className="w-6 h-6" />
          </div>
        </div>

        {/* Confirmed / Checked-in */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed &bull; Staying</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {metrics.CONFIRMED + metrics.CHECKED_IN}
            </h3>
            <p className="text-[11px] text-purple-600 mt-0.5 font-medium">
              {metrics.CONFIRMED} Confirmed &bull; {metrics.CHECKED_IN} Checked In
            </p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Cancelled / Archived */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cancelled / Archived</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {metrics.CANCELLED}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Historical records safeguarded
            </p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <Archive className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FILTER & SEARCH TOOLBAR                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Registration ID, Primary Name, Mobile, City..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="REGISTERED">Registered</option>
              <option value="ALLOCATED">Allocated</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="py-1 px-2 text-xs bg-slate-50 border border-slate-300 rounded text-slate-800"
              title="Filter from registration date"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="py-1 px-2 text-xs bg-slate-50 border border-slate-300 rounded text-slate-800"
              title="Filter to registration date"
            />
          </div>

          {/* Show Archived Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Archived</span>
          </label>

          {(searchQuery || statusFilter !== 'ALL' || startDate || endDate || showArchived) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setStartDate('');
                setEndDate('');
                setShowArchived(false);
              }}
              className="px-2 py-1 text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* REGISTRATIONS TABLE                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Registrations Directory ({totalCount} total)
            </h2>
            <p className="text-[11px] text-slate-500">
              Click Registration ID or view button to inspect members, allocation status, and stay history.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Page {page} of {totalPages}
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Registration ID</th>
                <th className="py-3 px-4">Primary Registrant</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4 text-center">Members</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Registration Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading registrations from database...
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No registrations found matching the specified criteria.
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                    {/* Reg ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 hover:text-blue-800">
                      <Link href={`/dashboard/registrations/${reg.registrationId}`} className="hover:underline flex items-center gap-1.5">
                        <span>{reg.registrationId}</span>
                        {reg.isArchived && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 text-slate-700 font-sans font-normal uppercase">
                            Archived
                          </span>
                        )}
                      </Link>
                    </td>

                    {/* Primary Registrant */}
                    <td className="py-3.5 px-4 text-slate-900 font-medium">
                      <div>
                        <p className="font-bold">{reg.primaryName}</p>
                        {reg.notes && reg.notes.includes('Family') ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            👨‍👩‍👧‍👦 Family
                          </span>
                        ) : reg.notes && (reg.notes.includes('VIP') || reg.notes.includes('Guest')) ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            🌟 Guest
                          </span>
                        ) : reg.notes && (reg.notes.includes('Mixed') || reg.notes.includes('Friends')) ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            🚻 Friends / Mixed
                          </span>
                        ) : reg.notes && reg.notes.includes('Male Group') ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            👦 Male Group
                          </span>
                        ) : reg.notes && reg.notes.includes('Female Group') ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-200">
                            👩 Female Group
                          </span>
                        ) : null}
                        {reg.email && <p className="text-[10px] text-slate-400 mt-0.5">{reg.email}</p>}
                      </div>
                    </td>

                    {/* Mobile */}
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{reg.mobile}</span>
                      </div>
                    </td>

                    {/* Members Count Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {reg.totalMembers} {reg.totalMembers === 1 ? 'member' : 'members'}
                      </span>
                    </td>

                    {/* City & State */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>
                          {reg.city ? `${reg.city}${reg.state ? `, ${reg.state}` : ''}` : '-'}
                        </span>
                      </div>
                    </td>

                    {/* Registration Date */}
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(reg.registrationDate).toLocaleDateString()}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(reg.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/registrations/${reg.registrationId}`}
                          title="View Full Details"
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(reg)}
                              title="Edit Registration"
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {reg.isArchived ? (
                              <button
                                onClick={() => handleRestore(reg)}
                                title="Restore Registration"
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleArchive(reg)}
                                title="Archive Registration"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Clean Touch-Friendly Registration Cards */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {loading && registrations.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              Loading registrations...
            </div>
          ) : registrations.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No registrations found matching the specified criteria.
            </div>
          ) : (
            registrations.map((reg) => (
              <div key={reg.id} className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/dashboard/registrations/${reg.registrationId}`}
                      className="font-bold text-slate-900 text-sm hover:text-blue-600 flex items-center gap-1.5"
                    >
                      <span>{reg.primaryName}</span>
                      <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                        {reg.registrationId}
                      </span>
                    </Link>
                    {reg.notes && reg.notes.includes('Family') && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        👨‍👩‍👧‍👦 Family
                      </span>
                    )}
                  </div>
                  <div>{getStatusBadge(reg.status)}</div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="space-y-0.5">
                    <a href={`tel:${reg.mobile}`} className="font-mono text-blue-600 font-bold flex items-center gap-1 hover:underline">
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                      <span>{reg.mobile}</span>
                    </a>
                    {reg.city && (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {reg.city}{reg.state ? `, ${reg.state}` : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[11px] bg-slate-100 text-slate-800">
                      👥 {reg.totalMembers} {reg.totalMembers === 1 ? 'Person' : 'Members'}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(reg.registrationDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Touch actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/dashboard/registrations/${reg.registrationId}`}
                    className="flex-1 min-h-[44px] py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </Link>

                  {canManage && (
                    <button
                      onClick={() => handleOpenEdit(reg)}
                      className="min-h-[44px] min-w-[44px] p-2 text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center"
                      title="Edit Registration"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 text-xs text-slate-600">
          <div>
            Showing <strong className="text-slate-900">{registrations.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong className="text-slate-900">{Math.min(page * limit, totalCount)}</strong> of{' '}
            <strong className="text-slate-900">{totalCount}</strong> registrations
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-800 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: NEW REGISTRATION MODAL                                    */}
      {/* ------------------------------------------------------------------ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">New Registration Entry</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Primary Name */}
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Registrant Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra / Sai"
                    value={newReg.primaryName}
                    onChange={(e) => setNewReg({ ...newReg, primaryName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Primary Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Gender <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newReg.gender || 'MALE'}
                    onChange={(e) => setNewReg({ ...newReg, gender: e.target.value as any, primaryGender: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="MALE">👦 Male</option>
                    <option value="FEMALE">👩 Female</option>
                  </select>
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={newReg.mobile}
                    onChange={(e) => setNewReg({ ...newReg, mobile: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. user@example.com"
                    value={newReg.email || ''}
                    onChange={(e) => setNewReg({ ...newReg, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Varanasi"
                    value={newReg.city || ''}
                    onChange={(e) => setNewReg({ ...newReg, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Uttar Pradesh"
                    value={newReg.state || ''}
                    onChange={(e) => setNewReg({ ...newReg, state: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Members */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Registered Members <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newReg.totalMembers ?? 1}
                    onChange={(e) => setNewReg({ ...newReg, totalMembers: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                {/* Registration Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registration Date
                  </label>
                  <input
                    type="date"
                    value={newReg.registrationDate ? newReg.registrationDate.slice(0, 10) : ''}
                    onChange={(e) => setNewReg({ ...newReg, registrationDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={newReg.status}
                    onChange={(e) => setNewReg({ ...newReg, status: e.target.value as RegistrationStatus })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="REGISTERED">Registered</option>
                    <option value="ALLOCATED">Allocated</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Registration Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Guest / Allocation Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const members = (newReg.accompanyingMembers || []).map(m => ({ ...m, gender: 'MALE' as any }));
                      const currentNotes = (newReg.notes || '').replace(/\[Category:.*?\]|\[Guest:.*?\]/g, '').trim();
                      setNewReg({ ...newReg, gender: 'MALE', accompanyingMembers: members, notes: `[Category: Male Group] ${currentNotes}`.trim() });
                    }}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                      (newReg.notes || '').includes('Male Group')
                        ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    👦 Male Group
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const members = (newReg.accompanyingMembers || []).map(m => ({ ...m, gender: 'FEMALE' as any }));
                      const currentNotes = (newReg.notes || '').replace(/\[Category:.*?\]|\[Guest:.*?\]/g, '').trim();
                      setNewReg({ ...newReg, gender: 'FEMALE', accompanyingMembers: members, notes: `[Category: Female Group] ${currentNotes}`.trim() });
                    }}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                      (newReg.notes || '').includes('Female Group')
                        ? 'bg-pink-50 border-pink-600 text-pink-700 ring-1 ring-pink-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    👩 Female Group
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentNotes = (newReg.notes || '').replace(/\[Category:.*?\]|\[Guest:.*?\]/g, '').trim();
                      setNewReg({ ...newReg, notes: `[Category: Friends / Mixed Group] ${currentNotes}`.trim() });
                    }}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                      (newReg.notes || '').includes('Friends / Mixed') || (newReg.notes || '').includes('Mixed Group')
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-1 ring-indigo-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🚻 Friends / Mixed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentNotes = (newReg.notes || '').replace(/\[Category:.*?\]|\[Guest:.*?\]/g, '').trim();
                      setNewReg({ ...newReg, notes: `[Guest: Family] ${currentNotes}`.trim() });
                    }}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                      (newReg.notes || '').includes('Family')
                        ? 'bg-purple-50 border-purple-600 text-purple-700 ring-1 ring-purple-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    👨‍👩‍👧‍👦 Family
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentNotes = (newReg.notes || '').replace(/\[Category:.*?\]|\[Guest:.*?\]/g, '').trim();
                      setNewReg({ ...newReg, notes: `[Guest: VIP] ${currentNotes}`.trim() });
                    }}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition ${
                      (newReg.notes || '').includes('VIP')
                        ? 'bg-amber-50 border-amber-600 text-amber-900 ring-1 ring-amber-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🌟 Guest / VIP
                  </button>
                </div>
              </div>

              {/* Accompanying Members Section (Optional) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Accompanying Group Members (Optional at Registration)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Individual details can be finalized or revised at reception upon arrival.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAccompanyingRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                  >
                    <Plus className="w-3 h-3" /> Add Member
                  </button>
                </div>

                {(newReg.accompanyingMembers || []).map((m, idx) => (
                  <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      placeholder="Member Full Name"
                      value={m.fullName}
                      onChange={(e) => {
                        const updated = [...(newReg.accompanyingMembers || [])];
                        updated[idx].fullName = e.target.value;
                        setNewReg({ ...newReg, accompanyingMembers: updated });
                      }}
                      className="flex-1 min-w-[140px] px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />

                    <input
                      type="tel"
                      placeholder="Individual Phone"
                      value={m.phone || ''}
                      onChange={(e) => {
                        const updated = [...(newReg.accompanyingMembers || [])];
                        updated[idx].phone = e.target.value;
                        setNewReg({ ...newReg, accompanyingMembers: updated });
                      }}
                      className="w-32 px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono"
                    />

                    <select
                      value={m.gender || ''}
                      onChange={(e) => {
                        const updated = [...(newReg.accompanyingMembers || [])];
                        updated[idx].gender = (e.target.value || null) as any;
                        setNewReg({ ...newReg, accompanyingMembers: updated });
                      }}
                      className="w-24 px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
                    >
                      <option value="">Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Age"
                      min={0}
                      max={120}
                      value={m.age ?? ''}
                      onChange={(e) => {
                        const updated = [...(newReg.accompanyingMembers || [])];
                        updated[idx].age = parseInt(e.target.value) || null;
                        setNewReg({ ...newReg, accompanyingMembers: updated });
                      }}
                      className="w-16 px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />

                    <input
                      type="text"
                      placeholder="Relation (e.g. Spouse)"
                      value={m.relationToPrimary || ''}
                      onChange={(e) => {
                        const updated = [...(newReg.accompanyingMembers || [])];
                        updated[idx].relationToPrimary = e.target.value;
                        setNewReg({ ...newReg, accompanyingMembers: updated });
                      }}
                      className="w-28 px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveAccompanyingRow(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Remove Row"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Special Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Special Notes / Accommodation Requests
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Senior citizen ground floor preference, late evening train arrival..."
                  value={newReg.notes || ''}
                  onChange={(e) => setNewReg({ ...newReg, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Register Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: EDIT REGISTRATION MODAL                                   */}
      {/* ------------------------------------------------------------------ */}
      {isEditOpen && editingRegistration && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Edit Registration {editingRegistration.registrationId}</h3>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Registrant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.primaryName || ''}
                    onChange={(e) => setEditForm({ ...editForm, primaryName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editForm.mobile || ''}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Members
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.totalMembers ?? 1}
                    onChange={(e) => setEditForm({ ...editForm, totalMembers: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as RegistrationStatus })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="REGISTERED">Registered</option>
                    <option value="ALLOCATED">Allocated</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CHECKED_IN">Checked In</option>
                    <option value="CHECKED_OUT">Checked Out</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: EXCEL IMPORT & PREVIEW MODAL                              */}
      {/* ------------------------------------------------------------------ */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Import Registrations via Excel (.xlsx)</h3>
              </div>
              <button onClick={() => setIsImportOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* File Upload Box */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-50/50 transition">
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  {importFile ? importFile.name : 'Select or drag and drop your completed registration spreadsheet (.xlsx)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ensure headers match the downloadable template. Phone numbers must be valid 10 digits.
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                  >
                    Choose Excel File
                  </button>
                  <a
                    href={api.getTemplateDownloadUrl()}
                    download="registration_import_template.xlsx"
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Get Template
                  </a>
                </div>
              </div>

              {previewLoading && (
                <div className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-xs font-medium">Validating rows and detecting duplicate mobile numbers...</p>
                </div>
              )}

              {/* Validation Summary Cards */}
              {importStats && (
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <div className="p-3 bg-slate-100 rounded-lg text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Rows</p>
                    <p className="text-lg font-bold text-slate-800">{importStats.total}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                    <p className="text-[10px] text-emerald-700 uppercase font-semibold">Valid Rows</p>
                    <p className="text-lg font-bold text-emerald-800">{importStats.valid}</p>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-center">
                    <p className="text-[10px] text-rose-700 uppercase font-semibold">Invalid Rows</p>
                    <p className="text-lg font-bold text-rose-800">{importStats.invalid}</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <p className="text-[10px] text-amber-700 uppercase font-semibold">Duplicates</p>
                    <p className="text-lg font-bold text-amber-800">{importStats.duplicate}</p>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {importPreviewRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Mobile</th>
                        <th className="py-2 px-3 text-center">Members</th>
                        <th className="py-2 px-3">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {importPreviewRows.map((r) => (
                        <tr key={r.rowIndex} className={r.isValid ? 'bg-white' : 'bg-rose-50/40'}>
                          <td className="py-2 px-3 font-mono text-slate-500">{r.rowIndex}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{r.data.primaryName || '-'}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{r.data.mobile || '-'}</td>
                          <td className="py-2 px-3 text-center">{r.data.totalMembers}</td>
                          <td className="py-2 px-3">
                            {r.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ready to Import
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {r.errors.map((err, i) => (
                                  <p key={i} className="text-[10px] text-rose-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0" /> {err}
                                  </p>
                                ))}
                              </div>
                            )}
                            {r.warnings.map((warn, i) => (
                              <p key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> {warn}
                              </p>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  {importStats && importStats.valid > 0
                    ? `Only the ${importStats.valid} valid records will be imported.`
                    : 'Upload a spreadsheet to preview.'}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={actionLoading || !importStats || importStats.valid === 0}
                    className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Confirm Import ({importStats?.valid || 0} Records)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
