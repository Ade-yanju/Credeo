"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Info, CheckCircle2, AlertTriangle, XCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    // Poll only while the tab is actually being looked at.
    //
    // The old version polled every 30s unconditionally, so a dashboard left
    // open in a background tab kept hitting the API ~2,880 times a day — each
    // request paying middleware HMAC verification plus a database query. That
    // is the single largest consumer of serverless CPU in this app, and none
    // of it is useful: nobody is reading a hidden tab. Notifications are not
    // real-time critical, so a slower cadence plus an immediate refresh when
    // the tab regains focus is both cheaper and no worse to use.
    const POLL_MS = 120_000;
    let interval: ReturnType<typeof setInterval> | undefined;

    function start() {
      if (interval !== undefined) return;
      interval = setInterval(fetchNotifications, POLL_MS);
    }
    function stop() {
      if (interval === undefined) return;
      clearInterval(interval);
      interval = undefined;
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchNotifications(); // catch up immediately on return
        start();
      } else {
        stop();
      }
    }

    fetchNotifications();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }

  async function markAsRead(id: string) {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  }

  async function deleteNotification(id: string) {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  }

  async function clearNotifications() {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (!res.ok) return;
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  }

  const getTypeStyles = (type: Notification["type"]) => {
    switch (type) {
      case "SUCCESS":
        return { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" };
      case "WARNING":
        return { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10" };
      case "DANGER":
        return { icon: XCircle, color: "text-rose-400", bg: "bg-rose-400/10" };
      default:
        return { icon: Info, color: "text-sky-400", bg: "bg-sky-400/10" };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        className={`relative w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
          open
            ? "border-vodium-gold bg-vodium-gold/5 text-vodium-gold"
            : "border-white/[0.07] text-vodium-cream/35 hover:text-vodium-cream hover:border-vodium-gold/30"
        }`}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#121212] border border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <h3 className="font-semibold text-sm text-vodium-cream">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-vodium-gold/10 text-vodium-gold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {unreadCount} New
              </span>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.04]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-vodium-cream/20">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const styles = getTypeStyles(n.type);
                const Icon = styles.icon;
                return (
                  <div
                    key={n.id}
                    className={`px-5 py-4 flex gap-4 hover:bg-white/[0.02] transition-colors relative group ${
                      !n.read ? "bg-vodium-gold/[0.02]" : ""
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${styles.bg} ${styles.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium leading-tight truncate ${!n.read ? "text-vodium-cream" : "text-vodium-cream/60"}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-vodium-cream/20 flex-shrink-0">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-vodium-cream/40 mt-1.5 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      
                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-[10px] text-vodium-gold hover:underline mt-2 font-medium"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="opacity-0 group-hover:opacity-100 absolute top-4 right-4 text-vodium-cream/20 hover:text-rose-400 transition-all p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.01]">
              <button
                className="text-[11px] text-vodium-cream/30 hover:text-vodium-cream transition-colors w-full text-center"
                onClick={clearNotifications}
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
