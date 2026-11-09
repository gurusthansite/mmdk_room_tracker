'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, RefreshCw, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  createdAt: number;
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  notify: (type: NotificationType, message: string, title?: string, duration?: number) => string;
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
  loading: (message: string, title?: string) => string;
  update: (id: string, updates: Partial<Omit<NotificationItem, 'id'>>) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Standalone global trigger support for use outside of React tree or in utility functions
let globalDispatch: ((type: NotificationType, message: string, title?: string, duration?: number) => string) | null = null;
let globalDismiss: ((id: string) => void) | null = null;
let globalUpdate: ((id: string, updates: Partial<Omit<NotificationItem, 'id'>>) => void) | null = null;

export const notify = {
  success: (message: string, title?: string, duration?: number) => globalDispatch?.('success', message, title, duration) || '',
  error: (message: string, title?: string, duration?: number) => globalDispatch?.('error', message, title, duration) || '',
  warning: (message: string, title?: string, duration?: number) => globalDispatch?.('warning', message, title, duration) || '',
  info: (message: string, title?: string, duration?: number) => globalDispatch?.('info', message, title, duration) || '',
  loading: (message: string, title?: string) => globalDispatch?.('loading', message, title, 0) || '',
  update: (id: string, updates: Partial<Omit<NotificationItem, 'id'>>) => globalUpdate?.(id, updates),
  dismiss: (id: string) => globalDismiss?.(id),
};

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'An unexpected error occurred. Please try again.';
  const lower = msg.toLowerCase();
  // Filter out internal stack traces, DB errors, prisma details
  if (
    lower.includes('prisma') ||
    lower.includes('unique constraint') ||
    lower.includes('foreign key constraint') ||
    lower.includes('syntaxerror') ||
    lower.includes('at ') && lower.includes('.ts:') ||
    lower.includes('select ') && lower.includes('from ')
  ) {
    return 'A database or server operation error occurred. Please verify your data and try again.';
  }
  return msg;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastNotificationRef = useRef<{ message: string; type: NotificationType; time: number } | null>(null);

  const dismiss = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current.clear();
    setNotifications([]);
  }, []);

  const update = useCallback((id: string, updates: Partial<Omit<NotificationItem, 'id'>>) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated = { ...n, ...updates };
        if (updates.message && updates.type === 'error') {
          updated.message = sanitizeErrorMessage(updates.message);
        }
        return updated;
      })
    );

    // If duration was specified or updated to non-loading, set up auto-dismiss
    if (updates.duration !== undefined || (updates.type && updates.type !== 'loading')) {
      const existingTimeout = timeoutsRef.current.get(id);
      if (existingTimeout) clearTimeout(existingTimeout);

      const duration = updates.duration ?? (updates.type === 'error' ? 8000 : updates.type === 'warning' ? 6000 : 4000);
      if (duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);
        timeoutsRef.current.set(id, timeout);
      }
    }
  }, [dismiss]);

  const notifyFunc = useCallback(
    (type: NotificationType, rawMessage: string, title?: string, customDuration?: number): string => {
      const message = type === 'error' ? sanitizeErrorMessage(rawMessage) : rawMessage;

      // Prevent duplicate notifications within 2 seconds
      const now = Date.now();
      if (
        lastNotificationRef.current &&
        lastNotificationRef.current.type === type &&
        lastNotificationRef.current.message === message &&
        now - lastNotificationRef.current.time < 2000
      ) {
        return '';
      }
      lastNotificationRef.current = { message, type, time: now };

      const id = `${now}-${Math.random().toString(36).substring(2, 9)}`;

      // Default durations
      let duration = customDuration;
      if (duration === undefined) {
        if (type === 'loading') duration = 0; // persistent until dismissed or updated
        else if (type === 'error') duration = 8000;
        else if (type === 'warning') duration = 6000;
        else duration = 4000; // success, info
      }

      const item: NotificationItem = {
        id,
        type,
        title,
        message,
        duration,
        createdAt: now,
      };

      setNotifications((prev) => [item, ...prev.slice(0, 5)]); // Keep up to 6 visible at once

      if (duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);
        timeoutsRef.current.set(id, timeout);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback((message: string, title?: string, duration?: number) => {
    return notifyFunc('success', message, title, duration);
  }, [notifyFunc]);

  const error = useCallback((message: string, title?: string, duration?: number) => {
    return notifyFunc('error', message, title, duration);
  }, [notifyFunc]);

  const warning = useCallback((message: string, title?: string, duration?: number) => {
    return notifyFunc('warning', message, title, duration);
  }, [notifyFunc]);

  const info = useCallback((message: string, title?: string, duration?: number) => {
    return notifyFunc('info', message, title, duration);
  }, [notifyFunc]);

  const loading = useCallback((message: string, title?: string) => {
    return notifyFunc('loading', message, title, 0);
  }, [notifyFunc]);

  useEffect(() => {
    globalDispatch = notifyFunc;
    globalDismiss = dismiss;
    globalUpdate = update;
    return () => {
      globalDispatch = null;
      globalDismiss = null;
      globalUpdate = null;
    };
  }, [notifyFunc, dismiss, update]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify: notifyFunc,
        success,
        error,
        warning,
        info,
        loading,
        update,
        dismiss,
        clearAll,
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

// ----------------------------------------------------------------------------
// NOTIFICATION CONTAINER COMPONENT (Rendered with z-[99999] above all modals/drawers)
// ----------------------------------------------------------------------------
function NotificationContainer({
  notifications,
  onDismiss,
}: {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
    >
      {notifications.map((item) => {
        let bgStyle = 'bg-slate-900 text-white border-slate-700';
        let icon = <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />;
        let defaultTitle = 'Notice';

        if (item.type === 'success') {
          bgStyle = 'bg-emerald-50 text-emerald-950 border-emerald-300 shadow-emerald-900/10';
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />;
          defaultTitle = 'Success';
        } else if (item.type === 'error') {
          bgStyle = 'bg-rose-50 text-rose-950 border-rose-300 shadow-rose-900/10';
          icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />;
          defaultTitle = 'Error';
        } else if (item.type === 'warning') {
          bgStyle = 'bg-amber-50 text-amber-950 border-amber-300 shadow-amber-900/10';
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />;
          defaultTitle = 'Warning';
        } else if (item.type === 'info') {
          bgStyle = 'bg-blue-50 text-blue-950 border-blue-300 shadow-blue-900/10';
          icon = <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />;
          defaultTitle = 'Information';
        } else if (item.type === 'loading') {
          bgStyle = 'bg-indigo-50 text-indigo-950 border-indigo-300 shadow-indigo-900/10';
          icon = <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin shrink-0 mt-0.5" />;
          defaultTitle = 'Processing';
        }

        return (
          <div
            key={item.id}
            role="alert"
            className={`pointer-events-auto rounded-xl border p-3.5 shadow-xl flex items-start gap-3 backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 fade-in ${bgStyle}`}
          >
            {icon}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-black tracking-wide uppercase opacity-90">
                {item.title || defaultTitle}
              </h4>
              <p className="text-xs mt-0.5 font-medium leading-relaxed break-words whitespace-pre-wrap">
                {item.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5 transition shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
