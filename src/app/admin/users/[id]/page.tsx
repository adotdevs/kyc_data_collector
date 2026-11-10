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
} from "lucide-react";
import Navbar from "@/components/Navbar";
import FileTypeIcon from "@/components/FileTypeIcon";
import UploadDocumentModal from "@/components/UploadDocumentModal";
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
  const [savingProfile, setSavingProfile] = useState(false);

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
        password: "",
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

  const handleKycDecision = async (action: "approve" | "reject") => {
    const res = await fetch(`/api/kyc/${client._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reason: rejectionNote.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.msg || "KYC status updated", "success");
      setRejectionNote("");
      loadClientHub();
    } else {
      showToast(data.msg || "Failed to update KYC", "error");
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
      loadClientHub();
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
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    KYC Unverified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {client.email} • {client.phone} •{" "}
                {[client.city, client.country].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
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

            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Document for Client
            </button>
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
                onClick={() => setActiveSection(t.id as any)}
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
                  onClick={() => handleKycDecision("approve")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve KYC
                </button>
                <button
                  onClick={() => handleKycDecision("reject")}
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
                  {hasCnic && (
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
                  {hasBill && (
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
          </div>
        )}

        {/* SECTION 2: CLIENT DOCUMENTS & E-SIGNATURES */}
        {activeSection === "documents" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {documents.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-800">
                    No documents uploaded for {client.firstName} yet
                  </p>
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Upload First Document
                  </button>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc._id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
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
                      <button
                        onClick={() => handleDeleteSignDocument(doc._id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                        {doc.signature.signatureDataUrl ? (
                          <img
                            src={doc.signature.signatureDataUrl}
                            alt="Client Signature"
                            className="h-11 object-contain bg-white rounded border border-emerald-100 px-2 mx-auto"
                          />
                        ) : (
                          <p className="font-sig-dancing text-xl text-blue-700 text-center">
                            {doc.signature.typedText ||
                              doc.signature.signerName}
                          </p>
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
                ))
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
                Reset Client Password (leave blank to keep unchanged)
              </label>
              <input
                type="password"
                value={profileForm.password}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="New password..."
                className="w-full max-w-sm px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
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
