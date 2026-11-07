'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Users, 
  UserCheck, 
  Building, 
  Bed, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  FileText, 
  ShieldCheck, 
  MessageSquare, 
  Edit2, 
  Archive, 
  RotateCcw, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  Layers,
  Shield,
  HelpCircle
} from 'lucide-react';
import { 
  api, 
  RegistrationDetail, 
  RegistrationStatus, 
  UpdateRegistrationInput 
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function RegistrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ALLOCATION_MANAGER';

  const [registration, setRegistration] = useState<RegistrationDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<UpdateRegistrationInput>({
    primaryName: '',
    mobile: '',
    email: '',
    city: '',
    state: '',
    totalMembers: 1,
    status: 'REGISTERED',
    notes: '',
  });

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getRegistration(id);
      if (res.success && res.data) {
        setRegistration(res.data);
      } else {
        setErrorMessage(res.message || 'Registration not found');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading registration details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleOpenEdit = () => {
    if (!registration) return;
    setEditForm({
      primaryName: registration.primaryName,
      mobile: registration.mobile,
      email: registration.email || '',
      city: registration.city || '',
      state: registration.state || '',
      totalMembers: registration.totalMembers,
      status: registration.status,
      notes: registration.notes || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registration) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.updateRegistration(registration.id, {
        ...editForm,
        totalMembers: Number(editForm.totalMembers) || 1,
      });

      if (res.success) {
        setSuccessMessage('Registration updated successfully');
        setIsEditOpen(false);
        await fetchDetail();
      } else {
        setErrorMessage(res.message || 'Failed to update registration');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!registration) return;
    if (!confirm(`Are you sure you want to archive ${registration.registrationId}?`)) return;

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.archiveRegistration(registration.id);
      if (res.success) {
        setSuccessMessage('Registration has been archived.');
        await fetchDetail();
      } else {
        setErrorMessage(res.message || 'Failed to archive registration');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error archiving registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!registration) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.restoreRegistration(registration.id);
      if (res.success) {
        setSuccessMessage('Registration restored successfully.');
        await fetchDetail();
      } else {
        setErrorMessage(res.message || 'Failed to restore registration');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error restoring registration');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case 'REGISTERED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Registered</span>;
      case 'ALLOCATED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Allocated</span>;
      case 'CONFIRMED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Confirmed</span>;
      case 'CHECKED_IN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Checked In</span>;
      case 'CHECKED_OUT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">Checked Out</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
        <p className="text-sm font-medium">Loading registration dossier...</p>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Registration Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested registration ID does not exist or may have been permanently removed.
        </p>
        <Link
          href="/dashboard/registrations"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Registrations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER BAR                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/registrations"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition"
            title="Back to Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight font-mono text-slate-900">
                {registration.registrationId}
              </h1>
              {getStatusBadge(registration.status)}
              {registration.isArchived && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-bold uppercase">
                  Archived
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Primary: <strong className="text-slate-800">{registration.primaryName}</strong> &bull; Registered on {new Date(registration.registrationDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <button
                onClick={handleOpenEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Details
              </button>

              {registration.isArchived ? (
                <button
                  onClick={handleRestore}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 shadow-sm transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              ) : (
                <button
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-300 rounded-lg hover:bg-rose-100 shadow-sm transition"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ALERTS                                                             */}
      {/* ------------------------------------------------------------------ */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between shadow-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* PRIMARY REGISTRANT & GROUP METRICS GRID                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Primary Registrant Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Primary Registrant
            </h3>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-semibold rounded">
              Lead Contact
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Full Name</p>
              <p className="font-bold text-slate-900 text-sm">{registration.primaryName}</p>
            </div>

            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              <div>
                <p className="text-[10px] text-slate-400">Mobile Number</p>
                <p className="font-mono font-semibold text-slate-800">{registration.mobile}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-400">Email Address</p>
                <p className="text-slate-800">{registration.email || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-400">City / State</p>
                <p className="text-slate-800">
                  {registration.city ? `${registration.city}${registration.state ? `, ${registration.state}` : ''}` : 'Not provided'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Group & Member Capacity Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Group Capacity Breakdown
            </h3>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-semibold rounded">
              Group Size
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Total Registered Members</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{registration.totalMembers}</p>
              </div>
              <Users className="w-8 h-8 text-indigo-500 opacity-80" />
            </div>

            <div className="flex items-center justify-between text-slate-600 pt-1">
              <span>Pre-arrival details recorded:</span>
              <strong className="text-slate-900">{registration.participants.length}</strong>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Arrived / Accommodated:</span>
              <strong className="text-purple-700">{registration.staySummary.length}</strong>
            </div>

            <p className="text-[11px] text-slate-400 italic pt-1">
              Supports partial group arrivals. Only arrived members are assigned physical beds at reception.
            </p>
          </div>
        </div>

        {/* Card 3: Operational Notes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Special Notes &amp; Preferences
            </h3>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>

          <div className="text-xs text-slate-700 space-y-2">
            {registration.notes ? (
              <p className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg text-amber-900 italic leading-relaxed">
                &quot;{registration.notes}&quot;
              </p>
            ) : (
              <p className="text-slate-400 italic py-4 text-center">
                No special requests or arrival notes entered for this registration.
              </p>
            )}

            <div className="pt-2 text-[11px] text-slate-400 space-y-1">
              <p>Created: {new Date(registration.createdAt).toLocaleString()}</p>
              <p>Last modified: {new Date(registration.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* REGISTERED GROUP MEMBERS LIST                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Group Participants ({registration.participants.length} pre-registered of {registration.totalMembers} members)
            </h2>
            <p className="text-[11px] text-slate-500">
              Personal details and Aadhaar numbers are collected and verified at reception upon arrival.
            </p>
          </div>
          <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-700 font-mono">
            {registration.participants.length} / {registration.totalMembers} Members
          </span>
        </div>

        {/* Desktop Participants Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Member Name</th>
                <th className="py-2.5 px-4">Phone Number</th>
                <th className="py-2.5 px-4">Role / Relation</th>
                <th className="py-2.5 px-4">Gender</th>
                <th className="py-2.5 px-4">Age</th>
                <th className="py-2.5 px-4">Aadhaar Status</th>
                <th className="py-2.5 px-4">Check-in Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {registration.participants.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    {p.fullName}
                    {p.isPrimary && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 text-blue-700 font-bold uppercase">
                        Primary
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {p.phone || (p.isPrimary ? registration.mobile : <span className="text-slate-400 italic font-sans">Not provided</span>)}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{p.relationToPrimary || 'Self'}</td>
                  <td className="py-3 px-4 text-slate-600">{p.gender || 'Unknown'}</td>
                  <td className="py-3 px-4 text-slate-600">{p.age ?? '-'}</td>
                  <td className="py-3 px-4">
                    {p.aadhaarRecord ? (
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        XXXX-XXXX-{p.aadhaarRecord.lastFourDigits}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        Pending arrival
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {p.checkInStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Participants Cards */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-2.5">
          {registration.participants.map((p) => (
            <div key={p.id} className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-sm">{p.fullName}</span>
                    {p.isPrimary && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 text-blue-700 font-bold uppercase">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {p.relationToPrimary || 'Self'} &bull; {p.gender || 'Unknown'} {p.age ? `• ${p.age} yrs` : ''}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                  {p.checkInStatus}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200 gap-1.5">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-blue-500" />
                  <span className="font-mono text-slate-800">
                    {p.phone || (p.isPrimary ? registration.mobile : <span className="text-slate-400 italic">No phone</span>)}
                  </span>
                </div>
                <div>
                  {p.aadhaarRecord ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      XXXX-XXXX-{p.aadhaarRecord.lastFourDigits}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No Aadhaar</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ALLOCATION SUMMARY (Module 4 Preview / Integration Point)          */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bed className="w-4 h-4 text-blue-600" />
              Room &amp; Unit Allocation Summary
            </h2>
            <p className="text-[11px] text-slate-500">
              Reserved rooms, beds and floor mats assigned to this registration.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {registration.allocationSummary.length} Active Allocation(s)
          </span>
        </div>

        <div className="p-5">
          {registration.allocationSummary.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <Bed className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-600">No Accommodation Units Allocated Yet</p>
              <p className="text-[11px] text-slate-400">
                Units can be manually assigned via the Allocation Engine (Phase 6).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {registration.allocationSummary.map((alc) => (
                <div key={alc.id} className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-900">{alc.allocationNumber}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                        {alc.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Stay Window: <strong className="text-slate-900">{new Date(alc.entryDate).toLocaleDateString()}</strong> to{' '}
                      <strong className="text-slate-900">{new Date(alc.exitDate).toLocaleDateString()}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {alc.units.map((u, i) => (
                      <div key={i} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{u.unitNumber}</span>
                          <span className="text-[10px] uppercase font-semibold text-slate-500">{u.unitType}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Room: <strong className="text-slate-800">{u.roomNumber}</strong> ({u.building || 'Main'})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ACTUAL STAY & OCCUPANCY HISTORY (Module 6/8 Integration Point)      */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600" />
              Actual Reception Check-in &amp; Stay Records
            </h2>
            <p className="text-[11px] text-slate-500">
              Verified physical check-ins and unit assignments recorded at reception.
            </p>
          </div>
        </div>

        <div className="p-5">
          {registration.staySummary.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-600">No Arrived Participants Checked In</p>
              <p className="text-[11px] text-slate-400">
                Reception staff will confirm arrivals and check in participants upon arrival (Phase 8).
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {registration.staySummary.map((stay) => (
                <div key={stay.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{stay.participantName}</p>
                    <p className="text-[11px] text-slate-500">
                      Assigned to Room {stay.roomNumber} &bull; Unit {stay.unitNumber} ({stay.unitType})
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-purple-700 font-semibold">
                      Checked in: {new Date(stay.actualCheckIn).toLocaleString()}
                    </p>
                    {stay.actualCheckOut && (
                      <p className="text-slate-500 text-[11px]">
                        Checked out: {new Date(stay.actualCheckOut).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* EDIT MODAL                                                         */}
      {/* ------------------------------------------------------------------ */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Edit Registration {registration.registrationId}</h3>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Name
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
    </div>
  );
}
