"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";

export default function VerifyEmailPage({
  params,
}: {
  params: { id: string; token: string };
}) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify/${params.id}/${params.token}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus("success");
          setMessage(data.msg || "Email verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.msg || "Verification link is invalid or expired.");
        }
      } catch {
        setStatus("error");
        setMessage("Unable to verify email right now.");
      }
    };
    verify();
  }, [params.id, params.token]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-card p-8 text-center space-y-4">
        {status === "loading" && (
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
        )}
        {status === "success" && (
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
        )}
        {status === "error" && (
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
        )}

        <h1 className="text-xl font-extrabold text-slate-900">
          {status === "loading"
            ? "Verifying Email..."
            : status === "success"
            ? "Email Verified!"
            : "Verification Failed"}
        </h1>
        <p className="text-sm text-slate-600">{message}</p>

        <div className="pt-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
          >
            Continue to Sign In
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
