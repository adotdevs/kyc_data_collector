"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  UploadCloud,
  FileCheck2,
  CreditCard,
  Home,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  FileText,
  Sparkles,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";

export default function KycOnboardingPage() {
  const { user, loading: authLoading, refreshUser, showToast } = useAuth();
  const router = useRouter();

  const cnicInputRef = useRef<HTMLInputElement | null>(null);
  const billInputRef = useRef<HTMLInputElement | null>(null);

  const [idType, setIdType] = useState<
    "passport" | "national_id" | "driving_license"
  >("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [cnicFile, setCnicFile] = useState<File | null>(null);
  const [cnicPreview, setCnicPreview] = useState<string | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login");
      } else if (
        user.role === "superadmin" ||
        user.role === "admin" ||
        user.role === "subadmin"
      ) {
        router.replace("/admin");
      }
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      setIdType(user.submitDoc?.idType || "national_id");
      setIdNumber(user.submitDoc?.idNumber || "");
      setDateOfBirth(user.submitDoc?.dateOfBirth || "");
      setNationality(user.submitDoc?.nationality || user.country || "");
      setAddress(user.address || "");
      setCity(user.city || "");
      setCountry(user.country || "");
      setPostalCode(user.postalCode || "");
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleSelectFile = (
    type: "cnic" | "bill",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("File size cannot exceed 10 MB", "error");
      return;
    }

    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : null;

    if (type === "cnic") {
      setCnicFile(file);
      setCnicPreview(previewUrl);
    } else {
      setBillFile(file);
      setBillPreview(previewUrl);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !cnicFile &&
      !billFile &&
      !user.submitDoc?.cnic &&
      !user.submitDoc?.bill
    ) {
      showToast(
        "Please select your Government ID and Proof of Address files to upload",
        "error"
      );
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("idType", idType);
      formData.append("idNumber", idNumber);
      formData.append("dateOfBirth", dateOfBirth);
      formData.append("nationality", nationality);
      formData.append("address", address);
      formData.append("city", city);
      formData.append("country", country);
      formData.append("postalCode", postalCode);

      if (cnicFile) formData.append("cnic", cnicFile);
      if (billFile) formData.append("bill", billFile);

      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.msg || "KYC upload failed");
      }

      showToast(data.msg || "KYC documents submitted!", "success");
      setCnicFile(null);
      setBillFile(null);
      await refreshUser();
    } catch (err: any) {
      showToast(err?.message || "Failed to submit KYC", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const hasExistingCnic = Boolean(user.submitDoc?.cnic);
  const hasExistingBill = Boolean(user.submitDoc?.bill);
  const isVerified = user.kyc === true;
  const isSubmittedPending =
    !isVerified && user.submitDoc?.status === "completed";
  const isRejected =
    !isVerified && user.submitDoc?.status === "rejected";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Progress Stepper */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Identity & Address Verification (KYC)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Client KYC Onboarding
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Verify your identity and residential address to complete account compliance.
            </p>
          </div>

          <Link
            href="/documents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm"
          >
            <span>Go to Document Gallery</span>
            <ArrowRight className="w-4 h-4 text-blue-600" />
          </Link>
        </div>

        {/* Status Banner */}
        {isVerified ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-emerald-950">
                  KYC Verification Approved & Complete
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Your Government ID and Proof of Residential Address have been verified by our compliance team.
                </p>
              </div>
            </div>
            <Link
              href="/documents"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shrink-0"
            >
              Sign Pending Documents
            </Link>
          </div>
        ) : isSubmittedPending ? (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5 flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-blue-950">
                KYC Documents Under Compliance Review
              </h3>
              <p className="text-xs text-blue-800 mt-0.5">
                Both of your verification documents have been received and are being reviewed by an administrator. You may still replace a document below if needed.
              </p>
            </div>
          </div>
        ) : isRejected ? (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-rose-950">
                Action Required on Your KYC Submission
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">
                {user.submitDoc?.rejectionReason ||
                  "Please upload clear, valid copies of your Government ID and Proof of Address."}
              </p>
            </div>
          </div>
        ) : null}

        {/* Main Onboarding Form */}
        <form onSubmit={handleSubmitKyc} className="space-y-6">
          {/* Step 1: Personal & Document Metadata */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">
                1
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Identity & Residential Information
                </h2>
                <p className="text-xs text-slate-500">
                  Ensure these details match the documents you upload below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ID Document Type
                </label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="national_id">National ID Card</option>
                  <option value="passport">International Passport</option>
                  <option value="driving_license">Driver&apos;s License</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document / ID Number
                </label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g., FR-99381023"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nationality
                </label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g., France"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Residential Street Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="24 Rue du Faubourg Saint-Honoré"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Paris"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="75008"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Two-Column Document Upload Cards (Government ID & Proof of Address) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card A: Government ID (cnic) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Government-Issued Photo ID
                      </h3>
                      <p className="text-xs text-slate-500">
                        Passport, National ID, or Driver&apos;s License
                      </p>
                    </div>
                  </div>
                  {(hasExistingCnic || cnicFile) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {cnicFile ? "Ready" : "Uploaded"}
                    </span>
                  )}
                </div>

                <input
                  ref={cnicInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleSelectFile("cnic", e)}
                  className="hidden"
                />

                <div
                  onClick={() => cnicInputRef.current?.click()}
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 p-6 text-center transition-all min-h-[190px] flex flex-col items-center justify-center"
                >
                  {cnicPreview ? (
                    <img
                      src={cnicPreview}
                      alt="ID Preview"
                      className="max-h-36 rounded-lg object-contain shadow-sm mb-2"
                    />
                  ) : cnicFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-10 h-10 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">
                        {cnicFile.name}
                      </span>
                    </div>
                  ) : hasExistingCnic ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck2 className="w-10 h-10 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">
                        {user.submitDoc?.cnicName || "Government ID Uploaded"}
                      </span>
                      <span className="text-[11px] text-blue-600 font-semibold">
                        Click to replace file
                      </span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-9 h-9 text-blue-600 mb-2" />
                      <p className="text-xs font-bold text-slate-700">
                        Click to upload Government ID
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Supports JPG, PNG, WEBP, or PDF (Max 10 MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {hasExistingCnic && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 truncate">
                    Current: {user.submitDoc?.cnicName || "Government_ID"}
                  </span>
                  <a
                    href={`/api/kyc/${user._id}/cnic`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview Uploaded
                  </a>
                </div>
              )}
            </div>

            {/* Card B: Proof of Address / Utility Bill (bill) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Proof of Residential Address
                      </h3>
                      <p className="text-xs text-slate-500">
                        Utility Bill, Bank Statement, or Tax Notice (&lt; 3 months)
                      </p>
                    </div>
                  </div>
                  {(hasExistingBill || billFile) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {billFile ? "Ready" : "Uploaded"}
                    </span>
                  )}
                </div>

                <input
                  ref={billInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleSelectFile("bill", e)}
                  className="hidden"
                />

                <div
                  onClick={() => billInputRef.current?.click()}
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 p-6 text-center transition-all min-h-[190px] flex flex-col items-center justify-center"
                >
                  {billPreview ? (
                    <img
                      src={billPreview}
                      alt="Bill Preview"
                      className="max-h-36 rounded-lg object-contain shadow-sm mb-2"
                    />
                  ) : billFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-10 h-10 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">
                        {billFile.name}
                      </span>
                    </div>
                  ) : hasExistingBill ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck2 className="w-10 h-10 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">
                        {user.submitDoc?.billName || "Proof of Address Uploaded"}
                      </span>
                      <span className="text-[11px] text-blue-600 font-semibold">
                        Click to replace file
                      </span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-9 h-9 text-indigo-600 mb-2" />
                      <p className="text-xs font-bold text-slate-700">
                        Click to upload Proof of Address
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Supports JPG, PNG, WEBP, or PDF (Max 10 MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {hasExistingBill && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 truncate">
                    Current: {user.submitDoc?.billName || "Proof_of_Address"}
                  </span>
                  <a
                    href={`/api/kyc/${user._id}/bill`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview Uploaded
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Submit Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <span>
                All KYC documents are encrypted and accessible only to authorized compliance officers.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm shadow-blue-600/25 flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? "Uploading KYC Documents..."
                  : "Submit KYC Verification"}
              </span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

