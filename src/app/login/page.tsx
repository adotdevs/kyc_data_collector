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
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { refreshUser, showToast } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
                Enterprise Compliance Workflow
              </span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 font-semibold">
              eIDAS Ready
            </span>
          </div>
          <p className="text-xs text-blue-100/90 leading-relaxed">
            End-to-end encrypted document custody, KYC verification, and
            real-time PDF signature certification.
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
              Sign in to your account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your registered email and password to access your portal.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-card space-y-5"
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
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
              <span>{submitting ? "Signing in..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Don&apos;t have an account yet?{" "}
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
