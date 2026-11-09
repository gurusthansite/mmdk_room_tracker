'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building,
  Bed,
  Users,
  CheckCircle2,
  LogOut,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  MapPin,
  ChevronRight,
  ChevronDown,
  ArrowRightLeft,
  PieChart as PieChartIcon,
  BarChart3,
  CalendarDays,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export default function ReportsPage() {
  const { user } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'occupancy' | 'registrations' | 'participants' | 'operations'>('occupancy');

  // Date filters
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Hotel Property filter
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelFilter, setHotelFilter] = useState<string>('ALL');

  // Loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [occupancyData, setOccupancyData] = useState<any>(null);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [participantData, setParticipantData] = useState<any>(null);
  const [dailyTimeline, setDailyTimeline] = useState<any[]>([]);

  // UI state for room table
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [roomFilterQuery, setRoomFilterQuery] = useState<string>('');

  // Load hotels on mount
  useEffect(() => {
    async function loadHotels() {
      try {
        const res = await api.getHotels();
        if (res.success && res.data) {
          setHotels(res.data);
        }
      } catch (e) {
        console.error('Failed to load hotels for report filtering', e);
      }
    }
    loadHotels();
  }, []);

  // Apply quick date preset
  const handlePresetChange = (preset: 'all' | 'today' | '7days' | '30days' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(past7);
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(past30);
      setEndDate(todayStr);
    }
  };

  // Fetch report data
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const hId = hotelFilter !== 'ALL' ? hotelFilter : undefined;
      const [ovRes, occRes, regRes, partRes, dailyRes] = await Promise.all([
        api.getReportOverview(startDate, endDate, hId),
        api.getOccupancyReport(startDate, endDate, hId),
        api.getRegistrationReport(startDate, endDate, hId),
        api.getParticipantReport(startDate, endDate, hId),
        api.getDailyOperationalReport(startDate, endDate, hId),
      ]);

      if (ovRes.success) setOverview(ovRes.data);
      if (occRes.success) setOccupancyData(occRes.data);
      if (regRes.success) setRegistrationData(regRes.data);
      if (partRes.success) setParticipantData(partRes.data);
      if (dailyRes.success && Array.isArray(dailyRes.data)) setDailyTimeline(dailyRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, hotelFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  // Export handlers
  const handleExportExcel = async () => {
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ALLOCATION_MANAGER') {
      alert('Report export is restricted to Super Admin and Allocation Managers.');
      return;
    }

    setExportingExcel(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (hotelFilter !== 'ALL') params.append('hotelId', hotelFilter);

      const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/reports/export/excel?${params.toString()}`;
      const res = await fetch(downloadUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Excel download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accommodation-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('Failed to export Excel report.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ALLOCATION_MANAGER') {
      alert('Report export is restricted to Super Admin and Allocation Managers.');
      return;
    }

    setExportingPdf(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (hotelFilter !== 'ALL') params.append('hotelId', hotelFilter);

      const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/reports/export/pdf?${params.toString()}`;
      const res = await fetch(downloadUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('PDF download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accommodation-briefing-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export PDF error:', err);
      alert('Failed to export PDF briefing report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered rooms in occupancy tab
  const filteredRooms = (occupancyData?.rooms || []).filter((r: any) => {
    if (!roomFilterQuery.trim()) return true;
    const q = roomFilterQuery.toLowerCase();
    return (
      r.roomNumber.toLowerCase().includes(q) ||
      (r.hotelName && r.hotelName.toLowerCase().includes(q)) ||
      (r.building && r.building.toLowerCase().includes(q))
    );
  });
  filteredRooms.sort((a: any, b: any) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER & ACTION CONTROLS                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Operational Reports & Analytics
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Real-time capacity analytics, occupancy metrics, registration demographics, and turnover timelines
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print View</span>
          </button>

          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER') && (
            <>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition shadow-xs disabled:opacity-50"
              >
                {exportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Export PDF</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
              >
                {exportingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>Export Excel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FILTER TOOLBAR: HOTEL PROPERTY SELECTOR & DATE RANGE               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Hotel Filter Dropdown & Period Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-blue-600" />
              Property:
            </span>
            <select
              value={hotelFilter}
              onChange={(e) => setHotelFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 font-bold"
            >
              <option value="ALL">All Properties ({hotels.length || 'All'})</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

          {/* Preset Pills */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Period:
            </span>
            {[
              { id: 'all', label: 'All Operations' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Past 7 Days' },
              { id: '30days', label: 'Past 30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  datePreset === preset.id
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDatePreset('custom');
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setDatePreset('custom');
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* EXECUTIVE HIGHLIGHT KPI CARDS                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Total Capacity</span>
            <Building className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {overview?.capacity.totalCapacity ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {overview?.capacity.totalBeds ?? 0} Beds, {overview?.capacity.totalMats ?? 0} Mats
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Occupancy Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {overview?.capacity.overallOccupancyRate ?? 0}%
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
            {(overview?.capacity.occupiedUnits || 0) + (overview?.capacity.reservedUnits || 0)} Units Booked/Active
          </p>
          <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, overview?.capacity.overallOccupancyRate || 0)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Checked-In Guests</span>
            <Bed className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">
            {overview?.capacity.occupiedUnits ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {overview?.capacity.occupiedBeds ?? 0} Beds, {overview?.capacity.occupiedMats ?? 0} Mats
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Reserved Units</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">
            {overview?.capacity.reservedUnits ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-amber-700 font-semibold truncate">
            Allocations Awaiting Check-In
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Available Units</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-teal-700">
            {overview?.capacity.availableUnits ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {overview?.capacity.maintenanceUnits ?? 0} Maintenance
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Today's Check-ins</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {overview?.todayOperations.actualCheckIns ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Expected: {overview?.todayOperations.expectedArrivals ?? 0}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Today's Checkouts</span>
            <LogOut className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {overview?.todayOperations.actualCheckOuts ?? '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Expected: {overview?.todayOperations.expectedDepartures ?? 0}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* REPORT SECTION TABS                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/60 px-6 flex items-center gap-6 overflow-x-auto">
          {[
            { id: 'occupancy', label: 'Occupancy & Room Utilization', icon: Building },
            { id: 'registrations', label: 'Registrations & Geography', icon: Users },
            { id: 'participants', label: 'Participant Demographics', icon: PieChartIcon },
            { id: 'operations', label: 'Operational Turnover Timeline', icon: CalendarDays },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TAB 1: OCCUPANCY & ROOM UTILIZATION                              */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'occupancy' && (
          <div className="p-6 space-y-6">
            {/* Building & Hotel Breakdown Cards */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Property &amp; Floor Utilization Summary</span>
                <span className="text-[11px] font-normal text-slate-500 lowercase">
                  {(occupancyData?.summary || []).length} properties/blocks found
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(occupancyData?.summary || []).map((bldg: any, idx: number) => (
                  <div key={bldg.groupTitle || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">
                          {bldg.groupTitle || `${bldg.hotelName || bldg.building} — Floor ${bldg.floor}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {bldg.hotelName || 'Property Block'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                        {bldg.utilizationRate}%
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Occupied: <strong className="text-purple-700">{bldg.occupiedUnits}</strong> &bull; Reserved: <strong className="text-amber-700">{bldg.reservedUnits || 0}</strong>
                      </span>
                      <span>Available: <strong className="text-teal-700">{bldg.availableUnits}</strong></span>
                    </div>

                    <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, bldg.utilizationRate)}%` }}
                      ></div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{bldg.totalBeds} Beds &bull; {bldg.totalMats} Mats</span>
                      <span>{bldg.totalRooms} Rooms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Room Utilization Table */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Room-by-Room Inventory Breakdown ({filteredRooms.length} rooms)
                </h3>
                <input
                  type="text"
                  placeholder="Filter room, property, or building..."
                  value={roomFilterQuery}
                  onChange={(e) => setRoomFilterQuery(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 max-w-xs"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Room</th>
                      <th className="py-2.5 px-3">Hotel Property</th>
                      <th className="py-2.5 px-3">Building &amp; Floor</th>
                      <th className="py-2.5 px-3">Capacity</th>
                      <th className="py-2.5 px-3">Active (Occ / Res)</th>
                      <th className="py-2.5 px-3">Available</th>
                      <th className="py-2.5 px-3">Utilization</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRooms.map((room: any) => {
                      const isExpanded = expandedRoomId === room.id;
                      return (
                        <React.Fragment key={room.id}>
                          <tr
                            className="hover:bg-slate-50 transition cursor-pointer"
                            onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                          >
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {room.roomNumber}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                {room.hotelName || 'Main Property'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {room.building || 'Main'} &bull; Floor {room.floor ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {room.totalCapacity} ({room.totalBeds}B, {room.totalMats}M)
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              <span className="text-purple-700">{room.occupiedUnits} Occ</span>
                              <span className="text-slate-300 mx-1">&bull;</span>
                              <span className="text-amber-700">{room.reservedUnits || 0} Res</span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-teal-700">
                              {room.availableUnits}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {room.utilizationRate}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400 inline" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                              )}
                            </td>
                          </tr>

                          {/* Expanded Occupants Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70">
                              <td colSpan={8} className="p-4">
                                <div className="text-xs font-semibold text-slate-700 mb-2">
                                  Current Active Occupants &amp; Bookings in Room {room.roomNumber} ({room.occupants?.length || 0} assigned):
                                </div>
                                {(!room.occupants || room.occupants.length === 0) ? (
                                  <p className="text-[11px] text-slate-400 italic">No occupants or reservations currently allocated to this room.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {room.occupants.map((occ: any, i: number) => (
                                      <div key={i} className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs">
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                          <p className="font-semibold text-slate-900 truncate">{occ.fullName}</p>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            occ.status === 'RESERVED'
                                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          }`}>
                                            {occ.status === 'RESERVED' ? 'Reserved' : 'Checked In'}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                          {occ.type} {occ.unitNumber} &bull; {occ.gender || 'Any'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                          {occ.actualCheckIn
                                            ? `In: ${new Date(occ.actualCheckIn).toLocaleDateString()} ${new Date(occ.actualCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                            : 'Pre-arrival reservation'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 2: REGISTRATIONS & GEOGRAPHY                                 */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'registrations' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Breakdown Bar Chart */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Registration Status Distribution
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(registrationData?.statusBreakdown || {}).map(([status, count]) => ({
                        status,
                        count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Group Size Distribution */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Group Size Distribution
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <span className="text-[10px] uppercase font-bold text-blue-700">Individuals (1)</span>
                    <p className="text-xl font-bold text-blue-900 mt-0.5">
                      {registrationData?.groupSizeDistribution?.individual ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-teal-50 border border-teal-100">
                    <span className="text-[10px] uppercase font-bold text-teal-700">Small (2-3)</span>
                    <p className="text-xl font-bold text-teal-900 mt-0.5">
                      {registrationData?.groupSizeDistribution?.small ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                    <span className="text-[10px] uppercase font-bold text-purple-700">Medium (4-5)</span>
                    <p className="text-xl font-bold text-purple-900 mt-0.5">
                      {registrationData?.groupSizeDistribution?.medium ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <span className="text-[10px] uppercase font-bold text-amber-700">Large (6+)</span>
                    <p className="text-xl font-bold text-amber-900 mt-0.5">
                      {registrationData?.groupSizeDistribution?.large ?? 0}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Total Registrations Analyzed: <strong>{registrationData?.totalRegistrations ?? 0}</strong> ({registrationData?.totalRegisteredMembers ?? 0} total members)
                </div>
              </div>
            </div>

            {/* Geographic Top Origin Cities */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Top Origin Cities & States
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-xs font-semibold text-slate-700 block mb-2">Top Guest Cities</span>
                  <div className="space-y-2">
                    {(registrationData?.topCities || []).map((c: any, i: number) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                          {c.name}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-xs font-semibold text-slate-700 block mb-2">Top Guest States</span>
                  <div className="space-y-2">
                    {(registrationData?.topStates || []).map((s: any, i: number) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{s.name}</span>
                        <span className="font-mono font-bold text-slate-900">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 3: PARTICIPANT DEMOGRAPHICS & COMPLIANCE                     */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'participants' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gender Distribution Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Gender Demographics
                </h3>
                <div className="space-y-3">
                  {Object.entries(participantData?.genderDistribution || {}).map(([gender, count]: any) => (
                    <div key={gender} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{gender}</span>
                      <span className="font-mono font-bold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Primary Guests: {participantData?.primaryCount ?? 0}</span>
                  <span>Accompanying: {participantData?.accompanyingCount ?? 0}</span>
                </div>
              </div>

              {/* Age Group Distribution Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Age Category Breakdown
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Minors (&lt; 18)</span>
                    <span className="font-mono font-bold">{participantData?.ageGroups?.minor ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Youth (18 - 35)</span>
                    <span className="font-mono font-bold">{participantData?.ageGroups?.youth ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Adults (36 - 60)</span>
                    <span className="font-mono font-bold">{participantData?.ageGroups?.adult ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Seniors (60+)</span>
                    <span className="font-mono font-bold">{participantData?.ageGroups?.senior ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Unspecified Age</span>
                    <span className="font-mono">{participantData?.ageGroups?.unknown ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Aadhaar Statutory Compliance Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-emerald-800 mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Statutory Aadhaar Compliance
                  </h3>
                </div>

                <div className="mt-3">
                  <div className="text-3xl font-bold text-slate-900">
                    {participantData?.aadhaarCompliance?.compliancePercentage ?? 0}%
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Identity verified with explicit statutory consent
                  </p>
                </div>

                <div className="mt-4 space-y-2 text-xs border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Arrived Participants</span>
                    <span className="font-mono font-bold">{participantData?.aadhaarCompliance?.totalParticipants ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Aadhaar Records Verified</span>
                    <span className="font-mono font-bold text-emerald-700">{participantData?.aadhaarCompliance?.aadhaarCollected ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Retention Consent Confirmed</span>
                    <span className="font-mono font-bold text-blue-700">{participantData?.aadhaarCompliance?.retentionConsentGiven ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 4: OPERATIONAL DAILY TIMELINE                                */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'operations' && (
          <div className="p-6 space-y-6">
            {/* Turnover Recharts Bar Chart */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Daily Operational Activity (Arrivals vs Departures)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTimeline}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="expectedArrivals" name="Expected Arrivals" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actualCheckIns" name="Actual Check-ins" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expectedDepartures" name="Expected Departures" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actualCheckOuts" name="Actual Check-outs" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Operational Timeline Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Date-Wise Operational Audit Table
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4 text-blue-700">Expected Arrivals</th>
                      <th className="py-2.5 px-4 text-emerald-700">Actual Check-ins</th>
                      <th className="py-2.5 px-4 text-amber-700">Expected Departures</th>
                      <th className="py-2.5 px-4 text-rose-700">Actual Check-outs</th>
                      <th className="py-2.5 px-4 text-cyan-700">Transfers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyTimeline.map((day: any) => (
                      <tr key={day.date} className="hover:bg-slate-50 font-mono">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{day.date}</td>
                        <td className="py-2.5 px-4 text-blue-700">{day.expectedArrivals}</td>
                        <td className="py-2.5 px-4 text-emerald-700 font-bold">{day.actualCheckIns}</td>
                        <td className="py-2.5 px-4 text-amber-700">{day.expectedDepartures}</td>
                        <td className="py-2.5 px-4 text-rose-700 font-bold">{day.actualCheckOuts}</td>
                        <td className="py-2.5 px-4 text-cyan-700">{day.transfers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
