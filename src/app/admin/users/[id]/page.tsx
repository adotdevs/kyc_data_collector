"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  UploadCloud,
  Download,
  Trash2,
  CreditCard,
  Home,
  ExternalLink,
  User,
  FileSignature,
  Save,
  Clock,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import FileTypeIcon from "@/components/FileTypeIcon";
import UploadDocumentModal from "@/components/UploadDocumentModal";
import { triggerTopProgress } from "@/components/TopProgressBar";
import { useAuth } from "@/context/AuthContext";

export default function SingleClientHubPage({
  params,
}: {
  params: { id: string };
}) {
  const { user: viewer, loading: authLoading, showToast } = useAuth();
  const router = useRouter();

  const [client, setClient] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<
    "kyc" | "documents" | "profile"
  >("kyc");
  const [rejectionNote, setRejectionNote] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [confirmKycModal, setConfirmKycModal] = useState<{
    isOpen: boolean;
    action: "approve" | "reject";
    reason?: string;
  } | null>(null);
  const [submittingKycDecision, setSubmittingKycDecision] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);

  // Editable Profile State
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    note: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [bulkDeletingDocs, setBulkDeletingDocs] = useState(false);

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const loadClientHub = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${params.id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.msg || "Could not load client", "error");
        router.push("/admin");
        return;
      }
      setClient(data.user);
      setDocuments(data.documents || []);
      if (data.user.role && data.user.role !== "user") {
        setActiveSection("profile");
      }
      setProfileForm({
        firstName: data.user.firstName || "",
        lastName: data.user.lastName || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
        address: data.user.address || "",
        city: data.user.city || "",
        country: data.user.country || "",
        postalCode: data.user.postalCode || "",
        note: data.user.note || "",
        password: data.user.password || "",
      });
    } catch {
      showToast("Error loading client hub", "error");
    } finally {
      setLoading(false);
    }
  }, [params.id, router, showToast]);

  useEffect(() => {
    if (!authLoading && viewer) {
      loadClientHub();
    }
  }, [authLoading, viewer, loadClientHub]);

  if (authLoading || loading || !client) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleExecuteKycDecision = async (
    action: "approve" | "reject",
    customReason?: string
  ) => {
    try {
      setSubmittingKycDecision(true);
      const res = await fetch(`/api/kyc/${client._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason:
            action === "reject"
              ? customReason ||
                rejectionNote.trim() ||
                "Your KYC documents were reviewed and rejected by compliance. Please upload valid, legible, and unexpired documents."
              : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.msg || "KYC status updated", "success");
        setRejectionNote("");
        setConfirmKycModal(null);
        loadClientHub();
      } else {
        showToast(data.msg || "Failed to update KYC", "error");
      }
    } catch {
      showToast("Network error updating KYC", "error");
    } finally {
      setSubmittingKycDecision(false);
    }
  };

  const handleDeleteHistoryEntry = async (
    index: number,
    historyId?: string
  ) => {
    if (
      !confirm(
        "Are you sure you want to delete this historical KYC record? This will permanently remove it from the audit log."
      )
    )
      return;
    try {
      setDeletingHistory(true);
      const query = historyId
        ? `historyId=${historyId}`
        : `historyIndex=${index}`;
      const res = await fetch(`/api/kyc/${client._id}?${query}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.msg || "History record deleted", "success");
        loadClientHub();
      } else {
        showToast(data.msg || "Failed to delete history record", "error");
      }
    } catch {
      showToast("Failed to delete history record", "error");
    } finally {
      setDeletingHistory(false);
    }
  };

  const handleClearAllHistory = async () => {
    if (
      !confirm(
        "Are you sure you want to clear ALL document upload and decision history records for this client? This cannot be undone."
      )
    )
      return;
    try {
      setDeletingHistory(true);
      const res = await fetch(`/api/kyc/${client._id}?clearHistory=true`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.msg || "All history records cleared", "success");
        loadClientHub();
      } else {
        showToast(data.msg || "Failed to clear history", "error");
      }
    } catch {
      showToast("Failed to clear history", "error");
    } finally {
      setDeletingHistory(false);
    }
  };

  const handleDeleteKycDoc = async (docType: "cnic" | "bill") => {
    if (!confirm("Remove this KYC document from the client record?")) return;
    const res = await fetch(`/api/kyc/${client._id}?docType=${docType}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.msg || "Document deleted", "info");
      loadClientHub();
    } else {
      showToast(data.msg || "Failed to delete document", "error");
    }
  };

  const handleDeleteSignDocument = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast("Document removed", "info");
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      loadClientHub();
    }
  };

  const handleBulkDeleteSignDocuments = async () => {
    if (selectedDocIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${selectedDocIds.length} selected document(s)?`
      )
    ) {
      return;
    }
    try {
      setBulkDeletingDocs(true);
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedDocIds }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.msg || `Deleted ${selectedDocIds.length} document(s)`,
          "info"
        );
        setSelectedDocIds([]);
        loadClientHub();
      } else {
        showToast(data.msg || "Bulk delete failed", "error");
      }
    } finally {
      setBulkDeletingDocs(false);
    }
  };

  const handleSaveClientProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload: any = { ...profileForm };
      if (!payload.password) delete payload.password;

      const res = await fetch(`/api/users/${client._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Client profile updated", "success");
        loadClientHub();
      } else {
        showToast(data.msg || "Failed to save profile", "error");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleComplianceLock = async () => {
    const res = await fetch(`/api/users/${client._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isComplianceRestricted: !client.isComplianceRestricted,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(
        client.isComplianceRestricted
          ? "Compliance restriction lifted"
          : "Client account restricted for compliance review",
        "info"
      );
      loadClientHub();
    }
  };

  const hasCnic = Boolean(client.submitDoc?.cnic);
  const hasBill = Boolean(client.submitDoc?.bill);
  const isSuperAdmin = viewer?.role === "superadmin";
  const isAdmin = viewer?.role === "admin";
  const isSubAdmin = viewer?.role === "subadmin";
  const canManageDocs =
    isSuperAdmin ||
    (isAdmin && viewer?.adminPermissions?.canManageDocuments !== false) ||
    (isSubAdmin && viewer?.permissions?.canManageDocuments !== false);
  const canDeleteDocs =
    isSuperAdmin ||
    (isAdmin &&
      viewer?.adminPermissions?.canManageDocuments !== false &&
      viewer?.adminPermissions?.canDeleteDocuments !== false) ||
    (isSubAdmin &&
      viewer?.permissions?.canManageDocuments !== false &&
      viewer?.permissions?.canDeleteDocuments === true);
  const canManageKyc =
    isSuperAdmin ||
    (isAdmin && viewer?.adminPermissions?.canManageKyc !== false) ||
    (isSubAdmin && viewer?.permissions?.canReviewKyc !== false);
  const canDeleteKyc =
    isSuperAdmin ||
    (isAdmin && viewer?.adminPermissions?.canManageKyc !== false) ||
    (isSubAdmin &&
      viewer?.permissions?.canReviewKyc !== false &&
      viewer?.permissions?.canDeleteKyc === true);
  const canManageComplianceLock =
    isSuperAdmin ||
    (isAdmin && viewer?.adminPermissions?.canManageComplianceLock !== false) ||
    (isSubAdmin && viewer?.permissions?.canManageComplianceLock !== false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Breadcrumb & Client Summary Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900">
                  {client.firstName} {client.lastName}
                </h1>
                {client.kyc ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    KYC Approved
                  </span>
                ) : client.submitDoc?.status === "rejected" ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    KYC Rejected
                  </span>
                ) : client.submitDoc?.status === "completed" ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    KYC Submitted
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    KYC Unverified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>
                  {client.email} • {client.phone}
                  {client.city || client.country
                    ? ` • ${[client.city, client.country]
                        .filter(Boolean)
                        .join(", ")}`
                    : ""}
                </span>
                {client.password && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                    <span>Password:</span>
                    <code className="font-mono text-slate-900">
                      {showPassword ? client.password : "••••••••"}
                    </code>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-slate-500 hover:text-blue-600"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {canManageComplianceLock && (
              <button
                onClick={toggleComplianceLock}
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  client.isComplianceRestricted
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {client.isComplianceRestricted ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    Restricted (Unlock)
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    Compliance Active
                  </>
                )}
              </button>
            )}

            {canManageDocs && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Document for Client
              </button>
            )}
          </div>
        </div>

        {/* Hub Navigation Tabs */}
        <div className="inline-flex rounded-2xl bg-white border border-slate-200/90 p-1.5 shadow-sm">
          {[
            {
              id: "kyc",
              label: "KYC Identity & Address Review",
              icon: ShieldCheck,
            },
            {
              id: "documents",
              label: `Client Documents & E-Sign (${documents.length})`,
              icon: FileSignature,
            },
            {
              id: "profile",
              label: "Client Profile & Notes",
              icon: User,
            },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeSection === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  triggerTopProgress();
                  setActiveSection(t.id as any);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* SECTION 1: KYC REVIEW */}
        {activeSection === "kyc" && (
          <div className="space-y-6">
            {/* Rejection Notice Banner if currently rejected */}
            {client.submitDoc?.status === "rejected" && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-rose-950 text-sm">
                    Client KYC Currently Marked as Rejected
                  </div>
                  <div className="text-rose-800 mt-1">
                    <strong>Recorded Reason:</strong>{" "}
                    {client.submitDoc?.rejectionReason || "No specific note provided."}
                  </div>
                  <div className="text-rose-700 mt-1 text-[11px]">
                    The client has been notified to re-submit valid documents. Once they re-submit, status will change to KYC Submitted.
                  </div>
                </div>
              </div>
            )}

            {/* Approve / Reject Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  KYC Verification Decision
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID Type:{" "}
                  <strong className="uppercase">
                    {client.submitDoc?.idType || "National ID"}
                  </strong>{" "}
                  • ID Number:{" "}
                  <strong>{client.submitDoc?.idNumber || "Not specified"}</strong>{" "}
                  • Nationality:{" "}
                  <strong>
                    {client.submitDoc?.nationality || client.country || "N/A"}
                  </strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Optional rejection/resubmission note..."
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs w-64"
                />
                <button
                  type="button"
                  onClick={() =>
                    setConfirmKycModal({
                      isOpen: true,
                      action: "approve",
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve KYC
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmKycModal({
                      isOpen: true,
                      action: "reject",
                      reason:
                        rejectionNote.trim() ||
                        "Your KYC documents were reviewed and rejected by compliance. Please upload valid, legible, and unexpired documents.",
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Reject / Set Unverified
                </button>
              </div>
            </div>

            {/* Two-Column Document Viewers (Government ID & Utility Bill) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Government ID Viewer */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Government-Issued ID
                      </h3>
                      <p className="text-xs text-slate-500">
                        {client.submitDoc?.cnicName || "Passport / National ID"}
                      </p>
                    </div>
                  </div>
                  {hasCnic && canDeleteKyc && (
                    <button
                      onClick={() => handleDeleteKycDoc("cnic")}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                      title="Delete ID Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {hasCnic ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-64 flex items-center justify-center">
                      {client.submitDoc?.cnicMimeType?.includes("pdf") ||
                      String(client.submitDoc?.cnic)
                        .toLowerCase()
                        .endsWith(".pdf") ? (
                        <iframe
                          src={`/api/kyc/${client._id}/cnic`}
                          className="w-full h-full"
                          title="Government ID PDF"
                        />
                      ) : (
                        <img
                          src={`/api/kyc/${client._id}/cnic`}
                          alt="Government ID"
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/kyc/${client._id}/cnic`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Full View
                      </a>
                      <a
                        href={`/api/kyc/${client._id}/cnic?download=1`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 h-64 flex flex-col items-center justify-center text-xs text-slate-400">
                    No Government ID uploaded by client yet
                  </div>
                )}
              </div>

              {/* Proof of Address Viewer */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 flex flex-col justify-between space-y-4">
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
                        {client.submitDoc?.billName || "Utility Bill / Statement"}
                      </p>
                    </div>
                  </div>
                  {hasBill && canDeleteKyc && (
                    <button
                      onClick={() => handleDeleteKycDoc("bill")}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                      title="Delete Bill Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {hasBill ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-64 flex items-center justify-center">
                      {client.submitDoc?.billMimeType?.includes("pdf") ||
                      String(client.submitDoc?.bill)
                        .toLowerCase()
                        .endsWith(".pdf") ? (
                        <iframe
                          src={`/api/kyc/${client._id}/bill`}
                          className="w-full h-full"
                          title="Proof of Address PDF"
                        />
                      ) : (
                        <img
                          src={`/api/kyc/${client._id}/bill`}
                          alt="Proof of Address"
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/kyc/${client._id}/bill`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Full View
                      </a>
                      <a
                        href={`/api/kyc/${client._id}/bill?download=1`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 h-64 flex flex-col items-center justify-center text-xs text-slate-400">
                    No Proof of Address uploaded by client yet
                  </div>
                )}
              </div>
            </div>

            {/* Document Upload History for Superadmin & Compliance Staff */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Document Upload & Decision History
                    </h3>
                    <p className="text-xs text-slate-500">
                      Audit trail of previous KYC submissions, uploaded documents, and compliance decisions.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {client.kycHistory?.length || 0} Record
                    {client.kycHistory?.length === 1 ? "" : "s"}
                  </span>
                  {client.kycHistory && client.kycHistory.length > 0 && canDeleteKyc && (
                    <button
                      type="button"
                      onClick={handleClearAllHistory}
                      disabled={deletingHistory}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                      title="Clear all KYC history records"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>
              </div>

              {client.kycHistory && client.kycHistory.length > 0 ? (
                <div className="space-y-3">
                  {client.kycHistory.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              item.decision === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {item.decision === "approved"
                              ? "Approved"
                              : "Rejected"}
                          </span>
                          <span className="text-xs text-slate-600">
                            Decision Date:{" "}
                            <strong>
                              {item.decidedAt
                                ? new Date(item.decidedAt).toLocaleString()
                                : "N/A"}
                            </strong>
                          </span>
                          {item.decidedByName && (
                            <span className="text-xs text-slate-500">
                              by {item.decidedByName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          {item.submittedAt && (
                            <span className="text-[11px] text-slate-500">
                              Client Submitted:{" "}
                              {new Date(item.submittedAt).toLocaleDateString()}
                            </span>
                          )}
                          {canDeleteKyc && (
                            <button
                              type="button"
                              onClick={() => handleDeleteHistoryEntry(idx, item._id)}
                              disabled={deletingHistory}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete this history record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {item.rejectionReason && (
                        <div className="p-3 rounded-lg bg-rose-50/80 border border-rose-100 text-xs text-rose-900">
                          <strong>Note / Reason:</strong> {item.rejectionReason}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
                        {item.cnic && (
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-semibold text-slate-800">
                              {item.cnicName || "Government ID"}
                            </span>
                            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
                              <a
                                href={`/api/kyc/${client._id}/cnic?history=${idx}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> View
                              </a>
                              <a
                                href={`/api/kyc/${client._id}/cnic?history=${idx}&download=1`}
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Download
                              </a>
                            </div>
                          </div>
                        )}

                        {item.bill && (
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                            <Home className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="font-semibold text-slate-800">
                              {item.billName || "Proof of Address"}
                            </span>
                            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
                              <a
                                href={`/api/kyc/${client._id}/bill?history=${idx}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> View
                              </a>
                              <a
                                href={`/api/kyc/${client._id}/bill?history=${idx}&download=1`}
                                className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Download
                              </a>
                            </div>
                          </div>
                        )}

                        {!item.cnic && !item.bill && (
                          <span className="text-xs text-slate-400 italic">
                            No document files attached in this record
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  No previous submission history recorded for this client.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 2: CLIENT DOCUMENTS & E-SIGNATURES */}
        {activeSection === "documents" && (
          <div className="space-y-4">
            {canDeleteDocs && documents.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      documents.filter(
                        (d) => !d.isGlobal || isSuperAdmin || isAdmin
                      ).length > 0 &&
                      documents
                        .filter((d) => !d.isGlobal || isSuperAdmin || isAdmin)
                        .every((d) => selectedDocIds.includes(d._id))
                    }
                    onChange={(e) => {
                      const deletable = documents
                        .filter((d) => !d.isGlobal || isSuperAdmin || isAdmin)
                        .map((d) => d._id);
                      setSelectedDocIds(e.target.checked ? deletable : []);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Select All Documents</span>
                </label>

                {selectedDocIds.length > 0 && (
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                      {selectedDocIds.length} Selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocIds([])}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      disabled={bulkDeletingDocs}
                      onClick={handleBulkDeleteSignDocuments}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {bulkDeletingDocs
                          ? "Deleting..."
                          : `Delete Selected (${selectedDocIds.length})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {documents.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-800">
                    No documents uploaded for {client.firstName} yet
                  </p>
                  {canManageDocs && (
                    <button
                      onClick={() => setUploadModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                    >
                      <UploadCloud className="w-4 h-4" />
                      Upload First Document
                    </button>
                  )}
                </div>
              ) : (
                documents.map((doc) => {
                  const canSelect =
                    canDeleteDocs && (!doc.isGlobal || isSuperAdmin || isAdmin);
                  const isDocSelected = selectedDocIds.includes(doc._id);
                  return (
                    <div
                      key={doc._id}
                      className={`bg-white rounded-2xl border shadow-card p-5 flex flex-col justify-between space-y-4 ${
                        isDocSelected
                          ? "border-blue-600 ring-2 ring-blue-500/15"
                          : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {canSelect && (
                            <input
                              type="checkbox"
                              checked={isDocSelected}
                              onChange={() => toggleSelectDoc(doc._id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                          )}
                          <FileTypeIcon
                            type={doc.fileType}
                            fileName={doc.fileName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {doc.title}
                            </h4>
                            <p className="text-xs text-slate-400">
                              {doc.folder} •{" "}
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {canSelect && (
                          <button
                            onClick={() => handleDeleteSignDocument(doc._id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                    {doc.status === "signed" && doc.signature ? (
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Signed by {doc.signature.signerName}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            {doc.signature.certificateId}
                          </span>
                        </div>
                        {doc.signature.signatureDataUrl && (
                          <img
                            src={doc.signature.signatureDataUrl}
                            alt="Client Handwritten Signature"
                            className="h-11 object-contain bg-white rounded border border-emerald-100 px-2 mx-auto"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-xs text-amber-800 font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        Awaiting Client Signature Online
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <a
                        href={`/api/documents/${doc._id}/download?inline=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 text-center"
                      >
                        Preview PDF
                      </a>
                      <a
                        href={`/api/documents/${doc._id}/download`}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: CLIENT PROFILE EDITOR */}
        {activeSection === "profile" && (
          <form
            onSubmit={handleSaveClientProfile}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Edit Client Profile & Compliance Notes
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name
                </label>
                <input
                  value={profileForm.firstName}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, firstName: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Last Name
                </label>
                <input
                  value={profileForm.lastName}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, lastName: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address
                </label>
                <input
                  value={profileForm.address}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, address: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  value={profileForm.city}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, city: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Country
                </label>
                <input
                  value={profileForm.country}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, country: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Admin Note
              </label>
              <textarea
                rows={3}
                value={profileForm.note}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder="Compliance notes or internal remarks..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Password (Visible to Superadmin / Permitted Admin — edit to change)
              </label>
              <div className="relative max-w-sm">
                <input
                  type={showPassword ? "text" : "password"}
                  value={profileForm.password}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, password: e.target.value }))
                  }
                  placeholder="Account password..."
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? "Saving..." : "Save Client Changes"}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Confirmation Modal for KYC Approve / Reject */}
      {confirmKycModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmKycModal.action === "approve"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {confirmKycModal.action === "approve" ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {confirmKycModal.action === "approve"
                    ? "Confirm KYC Approval"
                    : "Confirm KYC Rejection"}
                </h3>
                <p className="text-xs text-slate-500">
                  {client.firstName} {client.lastName} ({client.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmKycModal.action === "approve"
                ? "Are you sure you want to approve this client's KYC verification? This will grant them full verified compliance status and dispatch an approval email."
                : "Are you sure you want to reject this KYC verification? The current uploaded documents will be archived to history and cleared from the user's dashboard so they can upload fresh files. An email notification will also be dispatched."}
            </p>

            {confirmKycModal.action === "reject" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Rejection Reason / Guidance for Client
                </label>
                <textarea
                  rows={3}
                  value={confirmKycModal.reason || ""}
                  onChange={(e) =>
                    setConfirmKycModal((prev) =>
                      prev ? { ...prev, reason: e.target.value } : null
                    )
                  }
                  placeholder="Explain why the documents were rejected..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={submittingKycDecision}
                onClick={() => setConfirmKycModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingKycDecision}
                onClick={() =>
                  handleExecuteKycDecision(
                    confirmKycModal.action,
                    confirmKycModal.reason
                  )
                }
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 ${
                  confirmKycModal.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {submittingKycDecision ? (
                  <span>Processing...</span>
                ) : confirmKycModal.action === "approve" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Approve</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Confirm & Reject</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <UploadDocumentModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        preselectedUserId={client._id}
        onUploaded={loadClientHub}
        showToast={showToast}
      />
    </div>
  );
}

