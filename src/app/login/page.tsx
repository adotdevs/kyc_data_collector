"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PenTool,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const DEMO_ACCOUNTS = [
  {
    label: "Client (Olivia)",
    role: "Client Portal",
    email: "client@signdocs.com",
    password: "Password@123",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    label: "Superadmin",
    role: "Full Control",
    email: "superadmin@signdocs.com",
    password: "Password@123",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    label: "Admin",
    role: "Staff Manager",
    email: "admin@signdocs.com",
    password: "Password@123",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    label: "Sub-Admin",
    role: "Assigned Clients",
    email: "subadmin@signdocs.com",
    password: "Password@123",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

export default function LoginPage() {
  const { refreshUser, showToast } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("client@signdocs.com");
  const [password, setPassword] = useState("Password@123");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.msg || "Invalid email or password");
        return;
      }

      await refreshUser();
      showToast(`Welcome back, ${data.user.firstName}!`, "success");

      if (
        data.user.role === "superadmin" ||
        data.user.role === "admin" ||
        data.user.role === "subadmin"
      ) {
        router.push("/admin");
      } else {
        router.push("/documents");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const quickFillAndLogin = async (acct: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(acct.email);
    setPassword(acct.password);
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: acct.email, password: acct.password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshUser();
        showToast(`Signed in as ${data.user.firstName} (${data.user.role})`, "success");
        if (
          data.user.role === "superadmin" ||
          data.user.role === "admin" ||
          data.user.role === "subadmin"
        ) {
          router.push("/admin");
        } else {
          router.push("/documents");
        }
      } else {
        setErrorMsg(data.msg || "Sign-in failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Brand Showcase Column */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <PenTool className="w-5 h-5 -rotate-45 text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">
              SignDocs
            </span>
          </Link>

          <div className="mt-16 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-100 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>KYC Onboarding & Digital Document Execution</span>
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight">
              Manage your KYC compliance & sign documents online.
            </h1>
            <p className="text-sm text-blue-100/90 leading-relaxed max-w-md">
              Securely upload identity verification documents, inspect contracts
              assigned by your account administrator, and apply legally binding
              electronic signatures in seconds.
            </p>
          </div>
        </div>

        {/* Visual Mini Card */}
        <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserCheck className="w-5 h-5 text-emerald-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Clean Compliance Workflow
              </span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 font-semibold">
              eIDAS Ready
            </span>
          </div>
          <p className="text-xs text-blue-100/90 leading-relaxed">
            Role-based access for Superadmin, Admin, Sub-Admin, and Clients with
            real-time PDF signature embedding and audit certificates.
          </p>
        </div>
      </div>

      {/* Right Login Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <PenTool className="w-4 h-4 -rotate-45" />
            </div>
            <span className="text-xl font-extrabold text-slate-900">
              Sign<span className="text-blue-600">Docs</span>
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Sign in to your portal
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Access your Document Gallery, KYC status, or Admin Console.
            </p>
          </div>

          {/* 1-Click Demo Role Switcher */}
          <div className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Quick 1-Click Role Sign-In
              </span>
              <span className="text-[11px] text-slate-400">Instant Demo</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => quickFillAndLogin(acct)}
                  className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all hover:shadow-sm ${acct.badge}`}
                >
                  <span className="text-xs font-bold">{acct.label}</span>
                  <span className="text-[10px] opacity-80">{acct.role}</span>
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 transition-all"
            >
              <span>{submitting ? "Signing in..." : "Sign In to Portal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            New client onboarding?{" "}
            <Link
              href="/register"
              className="font-bold text-blue-600 hover:text-blue-700"
            >
              Create your client account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
