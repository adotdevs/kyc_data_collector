"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Folder,
  FileText,
  Clock,
  CheckCircle2,
  PenTool,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Trash2,
  UserCheck,
  Globe,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import FileTypeIcon from "@/components/FileTypeIcon";
import SignatureModal from "@/components/SignatureModal";
import UploadDocumentModal from "@/components/UploadDocumentModal";
import { triggerTopProgress } from "@/components/TopProgressBar";
import { useAuth } from "@/context/AuthContext";

interface DocumentItem {
  _id: string;
  title: string;
  fileName: string;
  description: string;
  folder: string;
  fileType: "pdf" | "doc" | "image";
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  pageCount: number;
  requiresSignature: boolean;
  isGlobal?: boolean;
  globalParentId?: string | null;
  status: "pending_signature" | "signed" | "completed";
  documentContentPreview?: string;
  uploadedByName?: string;
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    kyc?: boolean;
  };
  signature?: {
    signatureDataUrl?: string;
    signatureMode?: "draw" | "type";
    typedText?: string;
    fontFamily?: string;
    signerName: string;
    signerEmail: string;
    signerTitle?: string;
    signedAt: string;
    certificateId: string;
  };
  createdAt: string;
}

const FOLDER_LIST = [
  "Contracts",
  "Agreements",
  "NDAs",
  "KYC & Compliance",
  "Other",
];

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "1.8 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.round(kb)} KB`;
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Mar 6, 2026";
  }
}

export default function DocumentGalleryPage() {
  const { user, loading: authLoading, refreshUser, showToast } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    pendingSignature: 0,
    signed: 0,
    totalBytes: 0,
    folderCounts: {} as Record<string, number>,
  });

  // Filters & View State
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending_signature" | "signed"
  >("all");
  const [selectedFolder, setSelectedFolder] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Active Document in Right Preview Panel
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [docToSign, setDocToSign] = useState<DocumentItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [selectedBulkDocIds, setSelectedBulkDocIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleBulkDocSelect = (docId: string) => {
    setSelectedBulkDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const isStaff =
    user?.role === "superadmin" ||
    user?.role === "admin" ||
    user?.role === "subadmin";

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoadingDocs(true);
    try {
      const params = new URLSearchParams();
      if (selectedFolder !== "All") params.set("folder", selectedFolder);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/documents?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        const list: DocumentItem[] = data.documents || [];
        list.sort((a, b) => {
          const aTime = new Date(
            a.signature?.signedAt || (a as any).updatedAt || a.createdAt
          ).getTime();
          const bTime = new Date(
            b.signature?.signedAt || (b as any).updatedAt || b.createdAt
          ).getTime();
          return bTime - aTime;
        });
        setDocuments(list);
        if (data.summary) setSummary(data.summary);

        if (list.length > 0) {
          setSelectedDoc((prev) => {
            if (!prev) return list[0];
            const updatedMatch = list.find((d) => d._id === prev._id);
            return updatedMatch || list[0];
          });
        } else {
          setSelectedDoc(null);
        }
      }
    } catch {
      showToast("Failed to load documents", "error");
    } finally {
      setLoadingDocs(false);
    }
  }, [user, selectedFolder, statusFilter, searchQuery, showToast]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user, fetchDocuments]);

  useEffect(() => {
    if (isStaff) {
      fetch("/api/users?role=user")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setClientsList(d.users || []);
        })
        .catch(() => {});
    }
  }, [isStaff]);

  const openSignModal = (doc: DocumentItem) => {
    setDocToSign(doc);
    setSelectedDoc(doc);
    setSignModalOpen(true);
  };

  const handleConfirmSignature = async (payload: {
    signatureDataUrl: string;
    signatureMode: "draw" | "type";
    typedText: string;
    fontFamily: string;
    signerName: string;
    signerTitle: string;
    saveForFuture: boolean;
  }) => {
    if (!docToSign) return;
    const res = await fetch(`/api/documents/${docToSign._id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        pageNumber: currentPage,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.msg || "Could not sign document");
    }

    showToast(
      data.msg || "Document signed & certified!",
      "success",
      `Certificate: ${data.document?.signature?.certificateId || "Verified"}`
    );
    await fetchDocuments();
    await refreshUser();
    if (data.document) {
      setSelectedDoc(data.document);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast("Document deleted", "info");
        setSelectedBulkDocIds((prev) => prev.filter((id) => id !== docId));
        fetchDocuments();
      } else {
        showToast(data.msg || "Failed to delete", "error");
      }
    } catch {
      showToast("Error deleting document", "error");
    }
  };

  const handleBulkDeleteDocuments = async () => {
    if (selectedBulkDocIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${selectedBulkDocIds.length} selected document(s)?`
      )
    ) {
      return;
    }
    try {
      setBulkDeleting(true);
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedBulkDocIds }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.msg || `Deleted ${selectedBulkDocIds.length} document(s)`,
          "info"
        );
        setSelectedBulkDocIds([]);
        fetchDocuments();
      } else {
        showToast(data.msg || "Bulk delete failed", "error");
      }
    } catch {
      showToast("Failed to delete selected documents", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const canDeleteDoc = (doc: DocumentItem) => {
    if (!user || !isStaff) return false;
    if (user.role === "superadmin") return true;
    if (user.role === "admin") {
      return (
        user.adminPermissions?.canManageDocuments !== false &&
        user.adminPermissions?.canDeleteDocuments !== false
      );
    }
    if (user.role === "subadmin") {
      return (
        !doc.isGlobal &&
        user.permissions?.canManageDocuments !== false &&
        user.permissions?.canDeleteDocuments === true
      );
    }
    return false;
  };

  const canUploadDocs =
    user?.role === "superadmin" ||
    (user?.role === "admin" &&
      user?.adminPermissions?.canManageDocuments !== false) ||
    (user?.role === "subadmin" &&
      user?.permissions?.canManageDocuments !== false);

  const totalPages = selectedDoc?.pageCount || 5;

  const storageMb = Math.max(
    2.4,
    Number(((summary.totalBytes || 0) / (1024 * 1024)).toFixed(1))
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
          <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          Loading GOin SAS Workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
        {/* ==================== LEFT SIDEBAR (SignDocs Style) ==================== */}
        <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-5 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            {/* Primary Action Button (Staff with Document Permission Only) */}
            {isStaff && canUploadDocs && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/25 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Upload Documents</span>
              </button>
            )}

            {/* Main Views Navigation */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  triggerTopProgress();
                  setStatusFilter("all");
                  setSelectedFolder("All");
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  statusFilter === "all" && selectedFolder === "All"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  Document Gallery
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {summary.total}
                </span>
              </button>

              <button
                onClick={() => {
                  triggerTopProgress();
                  setStatusFilter("pending_signature");
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  statusFilter === "pending_signature"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4" />
                  Pending Signature
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    summary.pendingSignature > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {summary.pendingSignature}
                </span>
              </button>

              <button
                onClick={() => {
                  triggerTopProgress();
                  setStatusFilter("signed");
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  statusFilter === "signed"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {summary.signed}
                </span>
              </button>

              {!isStaff && (
                <Link
                  href="/kyc"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <span className="flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    KYC Onboarding
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      user.kyc ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </Link>
              )}
            </div>

            {/* Folders Section */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Folders
                </span>
                <button
                  onClick={() => setSelectedFolder("All")}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  Reset
                </button>
              </div>

              <div className="space-y-1">
                {FOLDER_LIST.map((folderName) => {
                  const count = summary.folderCounts?.[folderName] || 0;
                  const active = selectedFolder === folderName;
                  return (
                    <button
                      key={folderName}
                      onClick={() => {
                        triggerTopProgress();
                        setSelectedFolder(active ? "All" : folderName);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? "bg-blue-50 text-blue-600"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Folder
                          className={`w-4 h-4 shrink-0 ${
                            active ? "text-blue-600" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{folderName}</span>
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Storage & KYC Progress Widget */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>Vault Storage</span>
                <span className="text-slate-400">{storageMb} MB of 10 GB</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: "24%" }}
                />
              </div>
            </div>

            {!isStaff && (
              <Link
                href="/kyc"
                className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                  user.kyc
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                    : "bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  {user.kyc ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold leading-tight">
                      {user.kyc ? "KYC Verified" : "KYC Verification"}
                    </p>
                    <p className="text-[10px] opacity-80">
                      {user.kyc
                        ? "Identity approved"
                        : user.submitDoc?.status === "completed"
                        ? "Pending admin review"
                        : "Click to upload ID & Bill"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-60" />
              </Link>
            )}
          </div>
        </aside>

        {/* ==================== CENTER DOCUMENT GALLERY ==================== */}
        <main className="flex-1 p-6 lg:p-8 min-w-0">
          {/* Top Title & Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Document Gallery
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage your documents and sign them online.
              </p>
            </div>

            {/* Active Filter Pills */}
            {(selectedFolder !== "All" || statusFilter !== "all") && (
              <div className="flex items-center gap-2">
                {selectedFolder !== "All" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                    Folder: {selectedFolder}
                    <button onClick={() => setSelectedFolder("All")}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                    {statusFilter === "pending_signature"
                      ? "Pending Signature"
                      : "Completed"}
                    <button onClick={() => setStatusFilter("all")}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Optional KYC Onboarding Banner for Unverified Clients */}
          {!isStaff && !user.kyc && (
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {user.submitDoc?.status === "completed"
                      ? "Your KYC Verification is Under Compliance Review"
                      : "Complete Your KYC Identity Onboarding"}
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {user.submitDoc?.status === "completed"
                      ? "Both your Government ID and Proof of Address have been submitted. You can continue signing documents below."
                      : "Upload your Government ID and Proof of Address to verify your identity alongside signing your agreements."}
                  </p>
                </div>
              </div>
              <Link
                href="/kyc"
                className="shrink-0 px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-sm transition-colors"
              >
                {user.submitDoc?.status === "completed"
                  ? "View KYC Status"
                  : "Complete KYC Now"}
              </Link>
            </div>
          )}

          {/* Search Bar & View Mode Toggle */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-xl">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white border border-slate-200/90 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="inline-flex items-center rounded-xl bg-white border border-slate-200/90 p-1 shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Staff Bulk Selection Bar */}
          {isStaff && canUploadDocs && documents.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
              <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    documents.filter((d) => canDeleteDoc(d)).length > 0 &&
                    documents
                      .filter((d) => canDeleteDoc(d))
                      .every((d) => selectedBulkDocIds.includes(d._id))
                  }
                  onChange={(e) => {
                    const deletable = documents
                      .filter((d) => canDeleteDoc(d))
                      .map((d) => d._id);
                    setSelectedBulkDocIds(e.target.checked ? deletable : []);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Select All Deletable Documents</span>
              </label>

              {selectedBulkDocIds.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                    {selectedBulkDocIds.length} Selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBulkDocIds([])}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={bulkDeleting}
                    onClick={handleBulkDeleteDocuments}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {bulkDeleting
                        ? "Deleting..."
                        : `Delete Selected (${selectedBulkDocIds.length})`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Documents Grid or List */}
          {loadingDocs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-60 rounded-2xl bg-white border border-slate-200/80 p-5 animate-pulse flex flex-col justify-between"
                >
                  <div className="w-12 h-14 bg-slate-100 rounded-lg mx-auto mt-4" />
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-2/3 mx-auto" />
                    <div className="h-3 bg-slate-100 rounded w-1/2 mx-auto" />
                  </div>
                  <div className="h-9 bg-slate-100 rounded-xl w-full" />
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                No documents found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                There are no documents matching your current filter or search
                criteria.
              </p>
              <button
                onClick={() => {
                  setSelectedFolder("All");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                Show All Documents
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {documents.map((doc) => {
                const isSelected = selectedDoc?._id === doc._id;
                const isSigned = doc.status === "signed";

                return (
                  <div
                    key={doc._id}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setCurrentPage(1);
                    }}
                    className={`group relative rounded-2xl bg-white p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "border-2 border-blue-600 shadow-card-hover ring-4 ring-blue-500/5"
                        : "border border-slate-200/90 hover:border-blue-300 shadow-card hover:shadow-card-hover"
                    }`}
                  >
                    {/* Card Top Row: Selection Checkbox & Menu */}
                    <div className="flex items-center justify-between">
                      {canDeleteDoc(doc) ? (
                        <input
                          type="checkbox"
                          checked={selectedBulkDocIds.includes(doc._id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleBulkDocSelect(doc._id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select document for bulk delete"
                        />
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 bg-white group-hover:border-blue-400"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        {(doc.isGlobal || doc.globalParentId) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                            <Globe className="w-2.5 h-2.5" />
                            Global
                          </span>
                        )}
                        {isSigned && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Signed
                          </span>
                        )}
                        <a
                          href={`/api/documents/${doc._id}/download`}
                          onClick={(e) => e.stopPropagation()}
                          title="Download PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {canDeleteDoc(doc) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDocument(doc._id);
                            }}
                            title="Delete Document"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Center File Icon & Title */}
                    <div className="my-5 flex flex-col items-center text-center">
                      <FileTypeIcon
                        type={doc.fileType}
                        fileName={doc.fileName}
                        size="md"
                      />

                      <h3 className="mt-4 text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {doc.title}
                      </h3>

                      <p className="text-xs text-slate-400 mt-1">
                        {formatFileSize(doc.fileSize)} •{" "}
                        {formatShortDate(doc.createdAt)}
                      </p>

                      {isStaff && (
                        <p className="mt-1 text-[11px] font-medium text-slate-500 truncate max-w-full">
                          {doc.isGlobal
                            ? "Shared: Global (All Clients)"
                            : doc.user
                            ? `Client: ${doc.user.firstName} ${doc.user.lastName}`
                            : ""}
                        </p>
                      )}

                      {isSigned && doc.signature?.signatureDataUrl && (
                        <div className="mt-3 w-full rounded-xl bg-emerald-50/60 border border-emerald-200/80 px-3 py-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-emerald-800 truncate">
                            Signed by {doc.signature.signerName}
                          </span>
                          <img
                            src={doc.signature.signatureDataUrl}
                            alt="Handwritten Signature"
                            className="h-7 object-contain bg-white rounded border border-emerald-100 px-1.5 shrink-0"
                          />
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Button (Sign Now vs Signed) */}
                    {isSigned ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDoc(doc);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Signed • View Copy</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSignModal(doc);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl border border-blue-500/80 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Sign Now</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden divide-y divide-slate-100">
              {documents.map((doc) => {
                const isSelected = selectedDoc?._id === doc._id;
                const isSigned = doc.status === "signed";
                return (
                  <div
                    key={doc._id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 p-4 cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {canDeleteDoc(doc) && (
                        <input
                          type="checkbox"
                          checked={selectedBulkDocIds.includes(doc._id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleBulkDocSelect(doc._id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                          title="Select document for bulk delete"
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
                        <p className="text-xs text-slate-500">
                          {doc.folder} • {formatFileSize(doc.fileSize)} •{" "}
                          {formatShortDate(doc.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isSigned ? (
                        <div className="flex items-center gap-2">
                          {doc.signature?.signatureDataUrl && (
                            <img
                              src={doc.signature.signatureDataUrl}
                              alt="Handwritten Signature"
                              className="h-8 object-contain bg-slate-50 rounded border border-emerald-200 px-2 py-0.5"
                            />
                          )}
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Signed
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSignModal(doc);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-bold transition-colors"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          Sign Now
                        </button>
                      )}
                      <a
                        href={`/api/documents/${doc._id}/download`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {canDeleteDoc(doc) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc._id);
                          }}
                          className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ==================== RIGHT DOCUMENT PREVIEW & SIGNING PANEL ==================== */}
        {selectedDoc && (
          <aside className="w-full lg:w-[380px] xl:w-[410px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200/80 p-6 flex flex-col justify-between gap-5 shadow-panel">
            <div className="space-y-5">
              {/* Top Document Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileTypeIcon
                    type={selectedDoc.fileType}
                    fileName={selectedDoc.fileName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {selectedDoc.title}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {formatFileSize(selectedDoc.fileSize)} •{" "}
                      {formatShortDate(selectedDoc.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Live Cloudinary PDF & Signature Preview */}
              <div className="rounded-2xl bg-slate-50/80 border border-slate-200/90 p-3 shadow-inner space-y-3">
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden h-[320px] flex flex-col">
                  <iframe
                    key={`${selectedDoc._id}-${selectedDoc.status}-${
                      selectedDoc.signature?.certificateId || "raw"
                    }`}
                    src={`/api/documents/${selectedDoc._id}/download?inline=1&v=${
                      selectedDoc.status === "signed"
                        ? selectedDoc.signature?.certificateId || "signed"
                        : "unsigned"
                    }`}
                    className="w-full h-full border-0"
                    title={selectedDoc.title}
                  />
                </div>

                {/* Signature Status Bar Below PDF Viewer */}
                <div className="bg-white rounded-xl border border-slate-200/80 px-4 py-3 flex items-center justify-between gap-3">
                  {selectedDoc.status === "signed" && selectedDoc.signature ? (
                    <>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Signed by {selectedDoc.signature.signerName}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate">
                          Cert: {selectedDoc.signature.certificateId}
                        </p>
                      </div>
                      {selectedDoc.signature.signatureDataUrl && (
                        <img
                          src={selectedDoc.signature.signatureDataUrl}
                          alt="Handwritten Client Signature"
                          className="h-10 object-contain bg-slate-50 rounded border border-emerald-200 px-2 py-0.5 shrink-0"
                        />
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openSignModal(selectedDoc)}
                      className="w-full py-2 px-3 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50 text-center transition-all flex items-center justify-between"
                    >
                      <span className="text-[11px] font-bold text-blue-700">
                        Handwritten Signature Required
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        Draw Signature →
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Page Switcher (< 1 of 5 >) */}
              <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-600">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons Stack at Bottom of Right Panel */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => openSignModal(selectedDoc)}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/25 transition-all"
              >
                <PenTool className="w-4 h-4" />
                <span>
                  {selectedDoc.status === "signed"
                    ? "Update / Re-Sign Document"
                    : "Sign Document"}
                </span>
              </button>

              <a
                href={`/api/documents/${selectedDoc._id}/download?inline=1`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Full PDF Preview</span>
              </a>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/documents/${selectedDoc._id}/download`}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Document PDF</span>
                </a>

                {canDeleteDoc(selectedDoc) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(selectedDoc._id)}
                    title="Delete Document"
                    className="p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Interactive E-Signature Modal */}
      <SignatureModal
        isOpen={signModalOpen}
        onClose={() => setSignModalOpen(false)}
        documentTitle={docToSign?.title || "Agreement.pdf"}
        defaultSignerName={`${user.firstName} ${user.lastName}`}
        defaultSignerEmail={user.email}
        savedSignature={user.savedSignature}
        onConfirmSign={handleConfirmSignature}
      />

      {/* Upload Document Modal */}
      <UploadDocumentModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        clients={clientsList}
        preselectedUserId={isStaff ? "" : user._id}
        onUploaded={fetchDocuments}
        showToast={showToast}
      />
    </div>
  );
}

