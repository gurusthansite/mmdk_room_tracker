'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Building, 
  Bed, 
  Users, 
  CalendarCheck, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Plus,
  CheckSquare,
  FileSpreadsheet,
  MessageSquare,
  Sparkles,
  Search,
  ExternalLink,
  ShieldCheck,
  BedDouble
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState({
    totalRooms: 0,
    totalBeds: 0,
    totalMats: 0,
    totalUnits: 0,
    totalRegistrations: 0,
    totalMembers: 0,
    activeStays: 0,
    occupancyRate: 0,
  });

  // Six Summary Cards matching handwritten sketch & room-wise overview
  const [sixCards, setSixCards] = useState<{
    totalBookedUnits: number;
    totalRooms: number;
    femaleRoomAvailability: any;
    maleRoomAvailability: any;
    familyRoomAvailability: any;
    guestRoomAvailability: any;
  }>({
    totalBookedUnits: 0,
    totalRooms: 0,
    femaleRoomAvailability: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
    maleRoomAvailability: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
    familyRoomAvailability: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
    guestRoomAvailability: { totalRooms: 0, availableRooms: 0, totalBeds: 0, availableBeds: 0, totalMats: 0, availableMats: 0, availableUnits: 0 },
  });

  const [roomWiseSummary, setRoomWiseSummary] = useState<any[]>([]);
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const res = await api.getReportOverview();
        if (res.success && res.data) {
          const cap = res.data.capacity;
          const reg = res.data.registrations;
          const occ = res.data.occupancy;
          setMetrics({
            totalRooms: cap?.totalRooms || 0,
            totalBeds: cap?.totalBeds || 0,
            totalMats: cap?.totalMats || 0,
            totalUnits: cap?.totalUnits || 0,
            totalRegistrations: reg?.totalRegistrations || 0,
            totalMembers: reg?.totalMembers || 0,
            activeStays: occ?.currentOccupiedUnits || 0,
            occupancyRate: occ?.occupancyRate || 0,
          });

          if (res.data.sixSummaryCards) {
            setSixCards(res.data.sixSummaryCards);
          }
          if (res.data.roomWiseSummary) {
            setRoomWiseSummary(res.data.roomWiseSummary);
          }
        }
      } catch (e) {
        // Fallback default
      } finally {
        setLoading(false);
      }
    };
    loadOverview();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* ------------------------------------------------------------------ */}
      {/* 1. WELCOME & QUICK ACTION BANNER                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-900/40">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Logged In as {user?.role?.replace('_', ' ')}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hello, {user?.name || 'Staff Member'}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mt-1 leading-relaxed">
              Manage your guest accommodation, allocate rooms and beds to single guests or families, and process check-ins all in one place.
            </p>
          </div>

          {/* Quick Launch Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/allocate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/40 transition ring-2 ring-blue-400/30"
            >
              <Bed className="w-4 h-4" />
              Book / Allocate Beds for Guests
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/dashboard/reception"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 transition ring-2 ring-emerald-400/30"
            >
              <CheckSquare className="w-4 h-4" />
              Reception Desk (Check-In / Out)
            </Link>

            <Link
              href="/dashboard/rooms"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
            >
              <Building className="w-4 h-4 text-slate-400" />
              View Rooms Grid
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. ROOM AVAILABILITY DASHBOARD (SIX SUMMARY CARDS FROM SKETCH)     */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Room Availability Dashboard</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">Live Inventory &amp; Room Availability</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {/* Card 1: Total Booked Units */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-slate-200 bg-white text-slate-800 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 leading-tight">Total Booked</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
              {loading ? '...' : sixCards.totalBookedUnits ?? metrics.activeStays}
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5 truncate">Units Booked / Stays</p>
          </div>

          {/* Card 2: Total Rooms */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-slate-200 bg-white text-slate-800 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 leading-tight">Total Rooms</span>
              <Building className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {loading ? '...' : sixCards.totalRooms ?? metrics.totalRooms}
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5 truncate">Active Rooms in System</p>
          </div>

          {/* Card 3: Ladies Room Availability (Female Rooms Availability) */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-pink-200 bg-pink-50/50 text-slate-800 shadow-xs hover:border-pink-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-pink-800 leading-tight">👩 Ladies Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-pink-100 text-pink-900 rounded">Female</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-pink-700 mt-1">
              {loading ? '...' : `${sixCards.femaleRoomAvailability?.availableRooms ?? 0} Free`}
            </p>
            <p className="text-[9px] sm:text-[10px] text-pink-950 font-semibold mt-0.5 leading-tight">
              {sixCards.femaleRoomAvailability?.availableBeds ?? 0} Beds &bull; {sixCards.femaleRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>

          {/* Card 4: Gents Room Availability (Male Rooms Availability) */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 text-slate-800 shadow-xs hover:border-blue-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-blue-800 leading-tight">👦 Gents Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-900 rounded">Male</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-blue-700 mt-1">
              {loading ? '...' : `${sixCards.maleRoomAvailability?.availableRooms ?? 0} Free`}
            </p>
            <p className="text-[9px] sm:text-[10px] text-blue-950 font-semibold mt-0.5 leading-tight">
              {sixCards.maleRoomAvailability?.availableBeds ?? 0} Beds &bull; {sixCards.maleRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>

          {/* Card 5: Family Room Availability */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 text-slate-800 shadow-xs hover:border-purple-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-purple-800 leading-tight">👨‍👩‍👧 Family Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-900 rounded">Family</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-purple-700 mt-1">
              {loading ? '...' : `${sixCards.familyRoomAvailability?.availableRooms ?? 0} Free`}
            </p>
            <p className="text-[9px] sm:text-[10px] text-purple-950 font-semibold mt-0.5 leading-tight">
              {sixCards.familyRoomAvailability?.availableBeds ?? 0} Beds &bull; {sixCards.familyRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>

          {/* Card 6: Guest Room Availability */}
          <div className="p-2.5 sm:p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 text-slate-800 shadow-xs hover:border-amber-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-amber-800 leading-tight">🌟 Guest Rooms</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-900 rounded">Guest</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
              {loading ? '...' : `${sixCards.guestRoomAvailability?.availableRooms ?? 0} Free`}
            </p>
            <p className="text-[9px] sm:text-[10px] text-amber-950 font-semibold mt-0.5 leading-tight">
              {sixCards.guestRoomAvailability?.availableBeds ?? 0} Beds &bull; {sixCards.guestRoomAvailability?.availableMats ?? 0} Mats
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. DETAILED ROOM-WISE AVAILABILITY & OCCUPANCY OVERVIEW            */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              <span>Room-Wise Availability Overview &amp; Occupancy</span>
            </h3>
            <p className="text-xs text-slate-500">
              Live status across all 4 room categories (Ladies, Gents, Family, Guest)
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setRoomCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                roomCategoryFilter === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Rooms ({roomWiseSummary.length})
            </button>
            <button
              type="button"
              onClick={() => setRoomCategoryFilter('FEMALE')}
              className={`px-3 py-1.5 rounded-lg transition ${
                roomCategoryFilter === 'FEMALE' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👩 Ladies ({roomWiseSummary.filter((r) => r.category === 'FEMALE').length})
            </button>
            <button
              type="button"
              onClick={() => setRoomCategoryFilter('MALE')}
              className={`px-3 py-1.5 rounded-lg transition ${
                roomCategoryFilter === 'MALE' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👦 Gents ({roomWiseSummary.filter((r) => r.category === 'MALE').length})
            </button>
            <button
              type="button"
              onClick={() => setRoomCategoryFilter('FAMILY')}
              className={`px-3 py-1.5 rounded-lg transition ${
                roomCategoryFilter === 'FAMILY' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👨‍👩‍👧 Family ({roomWiseSummary.filter((r) => r.category === 'FAMILY').length})
            </button>
            <button
              type="button"
              onClick={() => setRoomCategoryFilter('GUEST')}
              className={`px-3 py-1.5 rounded-lg transition ${
                roomCategoryFilter === 'GUEST' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌟 Guest ({roomWiseSummary.filter((r) => r.category === 'GUEST').length})
            </button>
          </div>
        </div>

        {/* Desktop Room Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Room</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Total Capacity</th>
                <th className="py-2.5 px-3">Booked / Occupied</th>
                <th className="py-2.5 px-3">Available Beds</th>
                <th className="py-2.5 px-3">Available Mats</th>
                <th className="py-2.5 px-3">Total Available</th>
                <th className="py-2.5 px-3">Occupancy Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roomWiseSummary
                .filter((r) => roomCategoryFilter === 'ALL' || r.category === roomCategoryFilter)
                .map((room) => {
                  const isFull = room.availableUnits === 0;

                  return (
                    <tr key={room.roomId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-slate-900 text-sm">Room {room.roomNumber}</span>
                        <p className="text-[10px] text-slate-400">
                          {room.building ? `${room.building} • ` : ''}Floor {room.floor ?? '-'}
                        </p>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          room.category === 'FEMALE'
                            ? 'bg-pink-100 text-pink-800'
                            : room.category === 'MALE'
                            ? 'bg-blue-100 text-blue-800'
                            : room.category === 'FAMILY'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {room.category === 'FEMALE' ? '👩 Ladies' : room.category === 'MALE' ? '👦 Gents' : room.category === 'FAMILY' ? '👨‍👩‍👧 Family' : '🌟 Guest'}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {room.totalUnits} Units
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-rose-700">{room.bookedUnitsCount} Booked</span>
                      </td>

                      <td className="py-3 px-3 font-semibold text-blue-700">
                        🛏️ {room.availableBeds} Beds
                      </td>

                      <td className="py-3 px-3 font-semibold text-emerald-700">
                        🧘 {room.availableMats} Mats
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono font-black text-sm text-slate-900">
                          {room.availableUnits} Free
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isFull
                            ? 'bg-rose-100 text-rose-800'
                            : room.bookedUnitsCount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isFull ? 'Fully Occupied' : room.bookedUnitsCount > 0 ? 'Partially Booked' : 'Fully Available'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Mobile Room Cards List */}
        <div className="block md:hidden divide-y divide-slate-100 space-y-2.5">
          {roomWiseSummary
            .filter((r) => roomCategoryFilter === 'ALL' || r.category === roomCategoryFilter)
            .map((room) => {
              const isFull = room.availableUnits === 0;

              return (
                <div key={room.roomId} className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-sm">Room {room.roomNumber}</span>
                      <p className="text-[10px] text-slate-400">
                        {room.building ? `${room.building} • ` : ''}Floor {room.floor ?? '-'}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      room.category === 'FEMALE'
                        ? 'bg-pink-100 text-pink-800'
                        : room.category === 'MALE'
                        ? 'bg-blue-100 text-blue-800'
                        : room.category === 'FAMILY'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}>
                      {room.category === 'FEMALE' ? '👩 Ladies' : room.category === 'MALE' ? '👦 Gents' : room.category === 'FAMILY' ? '👨‍👩‍👧 Family' : '🌟 Guest'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200/80">
                    <div>
                      <span className="text-slate-500 text-[11px]">Free Capacity:</span>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">
                        <span className="text-blue-700">🛏️ {room.availableBeds} Beds</span>
                        <span className="text-slate-300 mx-1.5">•</span>
                        <span className="text-emerald-700">🧘 {room.availableMats} Mats</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isFull
                          ? 'bg-rose-100 text-rose-800'
                          : room.bookedUnitsCount > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isFull ? 'Full' : `${room.availableUnits} Free`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. SIMPLE 4-STEP HOW-TO WORKFLOW GUIDE                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            How the System Works in 4 Easy Steps
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Follow this simple flow from advance room setup all the way to guest checkout.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <Link
            href="/dashboard/rooms"
            className="group p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-300 transition space-y-2 block"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</span>
              <Building className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </div>
            <h3 className="font-bold text-xs text-slate-900 group-hover:text-blue-900">
              Check Room Inventory
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              View rooms, male/female beds, and mats. See which rooms are available or under maintenance.
            </p>
            <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1 pt-1">
              Open Rooms &rarr;
            </span>
          </Link>

          {/* Step 2 */}
          <Link
            href="/dashboard/allocate"
            className="group p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-300 transition space-y-2 block"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">2</span>
              <Bed className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </div>
            <h3 className="font-bold text-xs text-slate-900 group-hover:text-blue-900">
              Book / Allocate Beds
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Click available beds in any room, enter the person or family name &amp; phone, and save.
            </p>
            <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1 pt-1">
              Book Beds &rarr;
            </span>
          </Link>

          {/* Step 3 */}
          <Link
            href="/dashboard/allocate"
            className="group p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-300 transition space-y-2 block"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">3</span>
              <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </div>
            <h3 className="font-bold text-xs text-slate-900 group-hover:text-blue-900">
              Send WhatsApp Details
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Click &quot;Send WhatsApp&quot; to send the guest their tentative room and bed numbers instantly.
            </p>
            <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1 pt-1">
              WhatsApp Details &rarr;
            </span>
          </Link>

          {/* Step 4 */}
          <Link
            href="/dashboard/reception"
            className="group p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50/60 hover:border-emerald-300 transition space-y-2 block"
          >
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">4</span>
              <CheckSquare className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <h3 className="font-bold text-xs text-slate-900 group-hover:text-emerald-900">
              Reception Check-In
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              When guests arrive, collect ID/Aadhaar consent, verify arriving family members, and check them in!
            </p>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 pt-1">
              Reception Desk &rarr;
            </span>
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. FREQUENTLY PERFORMED ACTIONS (SHORTCUT CARDS)                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/registrations"
          className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-2 group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg group-hover:bg-amber-100 transition">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-700">Guest Registrations</h4>
              <p className="text-[11px] text-slate-500">Manage names, group sizes, and Excel import</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/reports"
          className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-2 group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg group-hover:bg-indigo-100 transition">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700">Reports &amp; Analytics</h4>
              <p className="text-[11px] text-slate-500">Download Excel and PDF occupancy reports</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/activity"
          className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-2 group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-lg group-hover:bg-purple-100 transition">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 group-hover:text-purple-700">Activity Audit Trail</h4>
              <p className="text-[11px] text-slate-500">View exact history of who booked or changed rooms</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
