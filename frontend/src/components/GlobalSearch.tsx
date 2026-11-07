'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  Loader2, 
  Users, 
  Bed, 
  Building, 
  UserCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';

interface SearchResultItem {
  id: string;
  type: 'REGISTRATION' | 'ALLOCATION' | 'ROOM' | 'UNIT' | 'PARTICIPANT';
  title: string;
  subtitle: string;
  badge: string;
  link: string;
  metadata: Record<string, any>;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.globalSearch(query.trim(), 'ALL', 12);
        if (res.success && Array.isArray(res.data)) {
          setResults(res.data);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Global search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
        setSelectedIndex(-1);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    setQuery('');
    router.push(item.link);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'REGISTRATION':
        return <Users className="w-3.5 h-3.5 text-blue-600" />;
      case 'ALLOCATION':
        return <Bed className="w-3.5 h-3.5 text-purple-600" />;
      case 'ROOM':
        return <Building className="w-3.5 h-3.5 text-amber-600" />;
      case 'UNIT':
        return <Bed className="w-3.5 h-3.5 text-emerald-600" />;
      case 'PARTICIPANT':
        return <UserCheck className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <Search className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'REGISTRATION':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ALLOCATION':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ROOM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'UNIT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PARTICIPANT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Global Search (REG-, ALC-, Room, Guest, Mobile)..."
          className="w-full pl-9 pr-20 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400 transition"
        />

        <div className="absolute right-2.5 flex items-center gap-1.5 pointer-events-none">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          ) : query ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                setResults([]);
              }}
              className="pointer-events-auto p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-200/60 border border-slate-300/80 rounded shadow-xs">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              Search Results
            </span>
            <span>{results.length} found</span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1">
            {loading && results.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>Searching across accommodation database...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">No matches found</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Try searching by Registration ID, Allocation #, Room, or Guest Name
                </p>
              </div>
            ) : (
              results.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition gap-3 ${
                      isSelected
                        ? 'bg-blue-50/80 text-blue-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-md bg-white border border-slate-200/80 shadow-xs shrink-0 mt-0.5">
                        {getTypeIcon(item.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold truncate text-slate-900">
                            {item.title}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${getTypeBadgeClass(
                              item.type
                            )}`}
                          >
                            {item.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {item.badge}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-between px-3">
            <span>Press <kbd className="font-mono bg-white px-1 py-0.5 rounded border">↑</kbd> <kbd className="font-mono bg-white px-1 py-0.5 rounded border">↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-white px-1 py-0.5 rounded border">Enter</kbd> to select</span>
          </div>
        </div>
      )}
    </div>
  );
}
