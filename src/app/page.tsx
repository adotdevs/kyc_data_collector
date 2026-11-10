"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PenTool,
  ShieldCheck,
  FileSignature,
  UserCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (
        user.role === "superadmin" ||
        user.role === "admin" ||
        user.role === "subadmin"
      ) {
        router.replace("/admin");
      } else {
        router.replace("/documents");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="h-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 lg:px-12">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <PenTool className="w-5 h-5 -rotate-45" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Sign<span className="text-blue-600">Docs</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-600/25 transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enterprise KYC Onboarding & Online Document Signing</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Verify Identity &{" "}
              <span className="text-blue-600">Sign Documents</span> Online in
              Minutes.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              A unified compliance and digital execution workspace. Complete your
              KYC verification, review contracts in your personal Document
              Gallery, and sign legally binding agreements with a single click.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-all"
              >
                Open Client & Admin Portal
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-sm font-semibold shadow-sm transition-all"
              >
                Create Client Account
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200/80">
              <div className="flex items-start gap-2.5">
                <UserCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Fast KYC Onboarding
                  </p>
                  <p className="text-xs text-slate-500">
                    ID & Proof of Address verification
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <FileSignature className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Interactive E-Signatures
                  </p>
                  <p className="text-xs text-slate-500">
                    Draw or type signature on PDFs
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Multi-Tier Governance
                  </p>
                  <p className="text-xs text-slate-500">
                    Superadmin, Admin & Sub-Admin
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Preview Mock Card matching SignDocs aesthetic */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-[10px] font-extrabold text-white">
                    <span className="px-1.5 py-0.5 rounded bg-red-500">PDF</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Service Agreement.pdf
                    </h3>
                    <p className="text-xs text-slate-400">2.1 MB • Ready to Sign</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  KYC Verified
                </span>
              </div>

              {/* Document Paper Preview */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-6 space-y-3">
                <p className="text-center text-sm font-bold text-slate-800">
                  Service Agreement
                </p>
                <div className="space-y-2 py-2">
                  <div className="h-2.5 bg-slate-200 rounded-full w-full" />
                  <div className="h-2.5 bg-slate-200 rounded-full w-11/12" />
                  <div className="h-2.5 bg-slate-200 rounded-full w-4/5" />
                  <div className="h-2.5 bg-slate-200 rounded-full w-full mt-4" />
                  <div className="h-2.5 bg-slate-200 rounded-full w-3/4" />
                </div>
                <div className="pt-4 flex flex-col items-end">
                  <span className="font-sig-dancing text-3xl text-blue-700 pr-4">
                    Authorized Signer
                  </span>
                  <div className="w-40 border-b-2 border-blue-600 mt-0.5" />
                  <span className="text-[10px] text-slate-400 mt-1">
                    Digitally Signed & Certified
                  </span>
                </div>
              </div>

              <Link
                href="/login"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <PenTool className="w-3.5 h-3.5" />
                Sign Document Online
              </Link>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Protected by 256-bit SSL & Cryptographic Audit Trail</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

