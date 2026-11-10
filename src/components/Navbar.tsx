"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PenTool,
  Bell,
  ChevronDown,
  ShieldCheck,
  FileText,
  UserCheck,
  User,
  LogOut,
  LayoutDashboard,
  CheckCheck,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, stats, logout, refreshUser } = useAuth();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isStaff =
    user?.role === "superadmin" ||
    user?.role === "admin" ||
    user?.role === "subadmin";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleNotif = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      loadNotifications();
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    refreshUser();
  };

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "SD";

  const navItems: {
    label: string;
    href: string;
    active: boolean;
    badge?: string;
    badgeColor?: string;
  }[] = isStaff
    ? [
        {
          label: "Admin Console",
          href: "/admin",
          active: pathname.startsWith("/admin"),
        },
        {
          label: "Documents",
          href: "/documents",
          active: pathname === "/documents",
        },
        {
          label: "Profile",
          href: "/profile",
          active: pathname === "/profile",
        },
      ]
    : [
        {
          label: "Documents",
          href: "/documents",
          active: pathname === "/documents",
        },
        {
          label: "KYC Onboarding",
          href: "/kyc",
          active: pathname === "/kyc",
          badge: user?.kyc ? "Verified" : "Action Needed",
          badgeColor: user?.kyc
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700",
        },
        {
          label: "Profile & Signature",
          href: "/profile",
          active: pathname === "/profile",
        },
      ];

  return (
    <header className="sticky top-0 z-40 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8">
      <div className="max-w-[1600px] mx-auto h-full flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-8">
          <Link
            href={isStaff ? "/admin" : "/documents"}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/25 group-hover:bg-blue-700 transition-colors">
              <PenTool className="w-4 h-4 -rotate-45" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Sign<span className="text-blue-600">Docs</span>
            </span>
          </Link>

          {/* Center-Left Navigation Tabs (matching SignDocs screenshot) */}
          <nav className="hidden md:flex items-center gap-1 h-16">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative h-full inline-flex items-center gap-2 px-4 text-sm font-semibold transition-colors ${
                  item.active
                    ? "text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{item.label}</span>
                {item.badge && !isStaff && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.active && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Role Pill + Notifications + User Avatar Dropdown */}
        <div className="flex items-center gap-3">
          {isStaff && (
            <Link
              href={pathname.startsWith("/admin") ? "/documents" : "/admin"}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-slate-700 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
              {pathname.startsWith("/admin")
                ? "Switch to Document Gallery"
                : "Open Admin Console"}
            </Link>
          )}

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleToggleNotif}
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {stats.unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200/80">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Notifications
                  </span>
                  <button
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n._id}
                        href={n.link || (isStaff ? "/admin" : "/documents")}
                        onClick={() => setNotifOpen(false)}
                        className={`block px-4 py-3 hover:bg-slate-50 transition-colors ${
                          !n.isRead ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                          {n.content}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] font-medium text-slate-500 capitalize">
                  {user?.role === "user" ? "Verified Client" : user?.role}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {user?.email}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" />
                    {user?.role === "user" ? "Client Portal" : user?.role}
                  </span>
                </div>

                <div className="py-1">
                  {isStaff && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <LayoutDashboard className="w-4 h-4 text-blue-600" />
                      Admin Management Console
                    </Link>
                  )}
                  <Link
                    href="/documents"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    Document Gallery
                  </Link>
                  {!isStaff && (
                    <Link
                      href="/kyc"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <UserCheck className="w-4 h-4 text-slate-500" />
                      KYC Verification
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    {isStaff ? "Account Profile" : "Profile & Saved Signature"}
                  </Link>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Nav */}
      {mobileNavOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold ${
                item.active
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

