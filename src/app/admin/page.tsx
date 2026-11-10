"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Shield,
  FileSignature,
  UserPlus,
  Settings,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  UploadCloud,
  Download,
  Trash2,
  Share2,
  Lock,
  Unlock,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Plus,
  X,
  Check,
  ShieldCheck,
  PenTool,
  Eye,
  Sliders,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import FileTypeIcon from "@/components/FileTypeIcon";
import UploadDocumentModal from "@/components/UploadDocumentModal";
import { useAuth } from "@/context/AuthContext";

type AdminTab =
  | "overview"
  | "clients"
  | "documents"
  | "subadmins"
  | "admins"
  | "add-member"
  | "settings";

export default function AdminConsolePage() {
  const { user, loading: authLoading, showToast } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subAdminsList, setSubAdminsList] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [documentsList, setDocumentsList] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    totalClients: 0,
    verifiedClients: 0,
    unverifiedClients: 0,
    kycApprovedCount: 0,
    kycPendingReviewCount: 0,
    totalAdmins: 0,
    totalSubAdmins: 0,
  });

  // Filters
  const [clientSearch, setClientSearch] = useState("");
  const [clientKycFilter, setClientKycFilter] = useState<string>("all");
  const [docStatusFilter, setDocStatusFilter] = useState<string>("all");

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetUserId, setUploadTargetUserId] = useState<string>("");
  const [assignModalUser, setAssignModalUser] = useState<any | null>(null);
  const [selectedSubAdminIds, setSelectedSubAdminIds] = useState<string[]>([]);
  const [smtpModalAdmin, setSmtpModalAdmin] = useState<any | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    enabled: false,
    host: "",
    port: 465,
    user: "",
    pass: "",
    fromEmail: "",
    fromName: "",
  });

  // Add Member Form State
  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    password: "",
    role: "user",
    note: "",
  });
  const [creatingMember, setCreatingMember] = useState(false);

  // System Settings State
  const [sysSettings, setSysSettings] = useState({
    requireEmailVerification: false,
    requireKycBeforeSign: false,
    autoNotifyClientOnUpload: true,
    autoNotifyAdminOnSign: true,
    companyName: "SignDocs Compliance Portal",
    supportEmail: "support@betabase.pro",
  });

  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  const isSubAdmin = user?.role === "subadmin";
  const canManageSubAdmins =
    isSuperAdmin || (isAdmin && user?.adminPermissions?.isSubManagement !== false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role === "user") {
        router.replace("/documents");
      }
    }
  }, [authLoading, user, router]);

  const fetchAdminData = useCallback(async () => {
    if (!user || user.role === "user") return;
    try {
      const [clientsRes, docsRes, settingsRes] = await Promise.all([
        fetch("/api/users?role=user", { cache: "no-store" }),
        fetch("/api/documents", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);

      const clientsData = await clientsRes.json();
      if (clientsData.success) {
        setUsersList(clientsData.users || []);
        if (clientsData.counts) setCounts(clientsData.counts);
      }

      const docsData = await docsRes.json();
      if (docsData.success) {
        setDocumentsList(docsData.documents || []);
      }

      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings) {
        setSysSettings(settingsData.settings);
      }

      if (canManageSubAdmins) {
        const subRes = await fetch("/api/users?role=subadmin", {
          cache: "no-store",
        });
        const subData = await subRes.json();
        if (subData.success) setSubAdminsList(subData.users || []);
      }

      if (isSuperAdmin) {
        const admRes = await fetch("/api/users?role=admin", {
          cache: "no-store",
        });
        const admData = await admRes.json();
        if (admData.success) setAdminsList(admData.users || []);
      }
    } catch {
      // ignore
    }
  }, [user, canManageSubAdmins, isSuperAdmin]);

  useEffect(() => {
    if (user && user.role !== "user") {
      fetchAdminData();
    }
  }, [user, fetchAdminData]);

  if (authLoading || !user || user.role === "user") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ==================== HANDLERS ====================

  const handleQuickKycAction = async (
    userId: string,
    action: "approve" | "reject"
  ) => {
    try {
      const res = await fetch(`/api/kyc/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.msg || "KYC updated", "success");
        fetchAdminData();
      } else {
        showToast(data.msg || "Failed to update KYC", "error");
      }
    } catch {
      showToast("Error updating KYC", "error");
    }
  };

  const handleToggleUserFlag = async (
    userId: string,
    field: "isShared" | "verified" | "isComplianceRestricted",
    value: boolean
  ) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Client setting updated", "success");
        fetchAdminData();
      } else {
        showToast(data.msg || "Update failed", "error");
      }
    } catch {
      showToast("Update failed", "error");
    }
  };

  const handleDeleteAccount = async (userId: string, label: string) => {
    if (!confirm(`Are you sure you want to permanently delete ${label}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.msg || "Deleted successfully", "info");
        fetchAdminData();
      } else {
        showToast(data.msg || "Delete failed", "error");
      }
    } catch {
      showToast("Error deleting account", "error");
    }
  };

  const openAssignModal = (client: any) => {
    setAssignModalUser(client);
    const current = (client.assignedSubAdmins || []).map((s: any) =>
      typeof s === "object" ? String(s._id) : String(s)
    );
    setSelectedSubAdminIds(current);
  };

  const handleSaveSubAdminAssignment = async () => {
    if (!assignModalUser) return;
    try {
      const res = await fetch("/api/users/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: assignModalUser._id,
          subadminIds: selectedSubAdminIds,
          action: "set",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Sub-Admin assignments updated", "success");
        setAssignModalUser(null);
        fetchAdminData();
      } else {
        showToast(data.msg || "Assignment failed", "error");
      }
    } catch {
      showToast("Failed to save assignment", "error");
    }
  };

  const handleToggleSubAdminPermission = async (
    subAdmin: any,
    permKey: string,
    nextVal: boolean
  ) => {
    const res = await fetch(`/api/users/${subAdmin._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: {
          ...subAdmin.permissions,
          [permKey]: nextVal,
        },
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Sub-Admin permission updated", "success");
      fetchAdminData();
    } else {
      showToast(data.msg || "Permission update failed", "error");
    }
  };

  const handleToggleAdminPermission = async (
    adminItem: any,
    permKey: string,
    nextVal: boolean
  ) => {
    const res = await fetch(`/api/users/${adminItem._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminPermissions: {
          ...adminItem.adminPermissions,
          [permKey]: nextVal,
        },
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Admin permission updated", "success");
      fetchAdminData();
    } else {
      showToast(data.msg || "Permission update failed", "error");
    }
  };

  const handleSaveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpModalAdmin) return;
    const res = await fetch(`/api/users/${smtpModalAdmin._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smtpConfig: smtpForm }),
    });
    const data = await res.json();
    if (data.success) {
      showToast("SMTP configuration saved", "success");
      setSmtpModalAdmin(null);
      fetchAdminData();
    } else {
      showToast(data.msg || "Failed to save SMTP config", "error");
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMember(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.msg || "Could not create account");
      }
      showToast(data.msg || "Account created!", "success");
      setNewMember({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        country: "",
        postalCode: "",
        password: "",
        role: "user",
        note: "",
      });
      await fetchAdminData();
      if (newMember.role === "admin") setActiveTab("admins");
      else if (newMember.role === "subadmin") setActiveTab("subadmins");
      else setActiveTab("clients");
    } catch (err: any) {
      showToast(err?.message || "Failed to create member", "error");
    } finally {
      setCreatingMember(false);
    }
  };

  const handleUpdateSystemSettings = async (
    updates: Partial<typeof sysSettings>
  ) => {
    const next = { ...sysSettings, ...updates };
    setSysSettings(next);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Global settings saved", "success");
    } else {
      showToast(data.msg || "Failed to update settings", "error");
    }
  };

  // Filtered lists
  const filteredClients = usersList.filter((u) => {
    if (clientKycFilter === "verified" && !u.kyc) return false;
    if (
      clientKycFilter === "submitted" &&
      (u.kyc || u.submitDoc?.status !== "completed")
    ) {
      return false;
    }
    if (clientKycFilter === "unverified" && u.kyc) return false;

    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      const match =
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        (u.city || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const filteredDocs = documentsList.filter((d) => {
    if (docStatusFilter === "pending_signature" && d.status === "signed")
      return false;
    if (docStatusFilter === "signed" && d.status !== "signed") return false;
    return true;
  });

  const pendingDocsTotal = documentsList.filter(
    (d) => d.status === "pending_signature"
  ).length;
  const signedDocsTotal = documentsList.filter(
    (d) => d.status === "signed"
  ).length;

  const sidebarTabs: {
    id: AdminTab;
    label: string;
    icon: any;
    badge?: number;
    show: boolean;
  }[] = [
    {
      id: "overview",
      label: "Dashboard Overview",
      icon: LayoutDashboard,
      show: true,
    },
    {
      id: "clients",
      label: "Clients & KYC Review",
      icon: Users,
      badge: counts.totalClients,
      show: true,
    },
    {
      id: "documents",
      label: "Documents & E-Signatures",
      icon: FileSignature,
      badge: documentsList.length,
      show: true,
    },
    {
      id: "subadmins",
      label: "Manage Sub-Admins",
      icon: UserCog,
      badge: subAdminsList.length,
      show: canManageSubAdmins,
    },
    {
      id: "admins",
      label: "Manage Admins",
      icon: Shield,
      badge: adminsList.length,
      show: isSuperAdmin,
    },
    {
      id: "add-member",
      label: "Add New Account",
      icon: UserPlus,
      show: true,
    },
    {
      id: "settings",
      label: "Compliance Settings",
      icon: Settings,
      show: !isSubAdmin,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
        {/* ==================== ADMIN SIDEBAR ==================== */}
        <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-5 space-y-6">
          <button
            onClick={() => {
              setUploadTargetUserId("");
              setUploadModalOpen(true);
            }}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/25 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Client Document</span>
          </button>

          <nav className="space-y-1">
            {sidebarTabs
              .filter((t) => t.show)
              .map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? "bg-blue-50 text-blue-600"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </span>
                    {typeof tab.badge === "number" && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>

          {/* Role Indicator Card */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                {user.role} Access
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {isSuperAdmin
                ? "Full control over Admins, Sub-Admins, Clients, KYC approvals, and E-Signatures."
                : isAdmin
                ? "Manage Clients, Sub-Admins, KYC approvals, and Document Signing."
                : "Manage assigned & shared clients, review KYC, and upload documents."}
            </p>
          </div>
        </aside>

        {/* ==================== MAIN ADMIN CONTENT ==================== */}
        <main className="flex-1 p-6 lg:p-8 min-w-0 space-y-6">
          {/* 1. OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Compliance & E-Signature Console
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Real-time overview of client KYC onboarding and signed agreements.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setActiveTab("add-member")}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-sm"
                  >
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    Add Client / Staff
                  </button>
                  <button
                    onClick={() => {
                      setUploadTargetUserId("");
                      setUploadModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Upload Document
                  </button>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div
                  onClick={() => setActiveTab("clients")}
                  className="cursor-pointer bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Total Clients
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 mt-3">
                    {counts.totalClients}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {counts.verifiedClients} email verified
                  </p>
                </div>

                <div
                  onClick={() => {
                    setClientKycFilter("submitted");
                    setActiveTab("clients");
                  }}
                  className="cursor-pointer bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      KYC Pending Review
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 mt-3">
                    {counts.kycPendingReviewCount}
                  </p>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">
                    {counts.kycApprovedCount} KYC Approved
                  </p>
                </div>

                <div
                  onClick={() => {
                    setDocStatusFilter("pending_signature");
                    setActiveTab("documents");
                  }}
                  className="cursor-pointer bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Awaiting Signature
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <PenTool className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 mt-3">
                    {pendingDocsTotal}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Assigned to clients
                  </p>
                </div>

                <div
                  onClick={() => {
                    setDocStatusFilter("signed");
                    setActiveTab("documents");
                  }}
                  className="cursor-pointer bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Signed Documents
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-slate-900 mt-3">
                    {signedDocsTotal}
                  </p>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">
                    Certified PDFs ready
                  </p>
                </div>
              </div>

              {/* Two-Column Recent Activity: Recent Clients & Recent Signed Docs */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Recent Clients & KYC Queue */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      Client KYC Onboarding Status
                    </h2>
                    <button
                      onClick={() => setActiveTab("clients")}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      View All Clients
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {usersList.slice(0, 5).map((client) => (
                      <div
                        key={client._id}
                        className="py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {client.firstName} {client.lastName}
                            </p>
                            {client.kyc ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                KYC Verified
                              </span>
                            ) : client.submitDoc?.status === "completed" ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                                KYC Submitted
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                                Onboarding
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {client.email} • {client.phone}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!client.kyc && (
                            <button
                              onClick={() =>
                                handleQuickKycAction(client._id, "approve")
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                            >
                              Approve KYC
                            </button>
                          )}
                          <Link
                            href={`/admin/users/${client._id}`}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold"
                          >
                            Manage
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Documents & Signatures */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      Recent Client Documents & Signatures
                    </h2>
                    <button
                      onClick={() => setActiveTab("documents")}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      View All Documents
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {documentsList.slice(0, 5).map((doc) => (
                      <div
                        key={doc._id}
                        className="py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileTypeIcon
                            type={doc.fileType}
                            fileName={doc.fileName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {doc.title}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              Client: {doc.user?.firstName} {doc.user?.lastName} •{" "}
                              {doc.folder}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {doc.status === "signed" ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              Signed ✓
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                              Pending
                            </span>
                          )}
                          <a
                            href={`/api/documents/${doc._id}/download`}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CLIENTS & KYC MANAGEMENT TAB */}
          {activeTab === "clients" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    Client Accounts & KYC Verification
                  </h1>
                  <p className="text-sm text-slate-500">
                    Inspect KYC documents, upload contracts for signing, and assign Sub-Admins.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setNewMember((p) => ({ ...p, role: "user" }));
                    setActiveTab("add-member");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm self-start"
                >
                  <UserPlus className="w-4 h-4" />
                  Add New Client
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search client name, email, phone, or city..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "all", label: "All Clients" },
                    { id: "submitted", label: "KYC Submitted" },
                    { id: "verified", label: "KYC Verified" },
                    { id: "unverified", label: "KYC Unverified" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setClientKycFilter(f.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        clientKycFilter === f.id
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredClients.map((client) => {
                  const docStats = client.documentStats || {
                    totalDocs: 0,
                    pendingDocs: 0,
                    signedDocs: 0,
                  };
                  const assignedList = client.assignedSubAdmins || [];

                  return (
                    <div
                      key={client._id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-card hover:shadow-card-hover transition-all p-5 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3.5">
                        {/* Top Header: Name + KYC Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  client.online
                                    ? "bg-emerald-500"
                                    : "bg-slate-300"
                                }`}
                              />
                              <h3 className="text-base font-extrabold text-slate-900">
                                {client.firstName} {client.lastName}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Joined{" "}
                              {new Date(client.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          {client.kyc ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              KYC Verified
                            </span>
                          ) : client.submitDoc?.status === "completed" ? (
                            <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              KYC Submitted
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">
                              KYC Pending
                            </span>
                          )}
                        </div>

                        {/* Quick Action Toolbar (Edit / Upload Doc / Inspect KYC) */}
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/users/${client._id}`}
                            className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                            title="Open Client Hub & Edit"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => {
                              setUploadTargetUserId(client._id);
                              setUploadModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            title="Upload Document for Client to Sign"
                          >
                            <UploadCloud className="w-4 h-4" />
                          </button>
                          {(isSuperAdmin || isAdmin) && (
                            <button
                              onClick={() => openAssignModal(client)}
                              className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                              title="Assign Sub-Admins"
                            >
                              <UserCog className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleToggleUserFlag(
                                client._id,
                                "isComplianceRestricted",
                                !client.isComplianceRestricted
                              )
                            }
                            className={`p-2 rounded-lg transition-colors ${
                              client.isComplianceRestricted
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                            title={
                              client.isComplianceRestricted
                                ? "Compliance Restricted (Click to Unlock)"
                                : "Restrict Account"
                            }
                          >
                            {client.isComplianceRestricted ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Contact Box with Verified Indicators */}
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-slate-700 font-medium truncate">
                              <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              {client.phone}
                            </span>
                            <span className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-slate-700 font-medium truncate">
                              <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">{client.email}</span>
                            </span>
                            {client.verified ? (
                              <span
                                className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0"
                                title="Email Verified"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  handleToggleUserFlag(
                                    client._id,
                                    "verified",
                                    true
                                  )
                                }
                                className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold shrink-0"
                                title="Click to Bypass & Verify Email"
                              >
                                Verify
                              </button>
                            )}
                          </div>

                          {(client.city || client.country) && (
                            <div className="flex items-center gap-2 text-slate-500 pt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {[client.address, client.city, client.country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Document Signing Stats Bar */}
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50/60 border border-blue-100 text-xs">
                          <span className="font-semibold text-slate-700">
                            Documents: <strong>{docStats.totalDocs}</strong>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-bold">
                              {docStats.pendingDocs} Pending
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-emerald-700 font-bold">
                              {docStats.signedDocs} Signed
                            </span>
                          </div>
                        </div>

                        {/* Global Sharing & Sub-Admin Chips */}
                        {(isSuperAdmin || isAdmin) && (
                          <div className="pt-1 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                                Shared with all Sub-Admins
                              </span>
                              <input
                                type="checkbox"
                                checked={Boolean(client.isShared)}
                                onChange={(e) =>
                                  handleToggleUserFlag(
                                    client._id,
                                    "isShared",
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </div>

                            {assignedList.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {assignedList.map((sub: any) => (
                                  <span
                                    key={sub._id || sub}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                                  >
                                    {sub.firstName
                                      ? `${sub.firstName} ${sub.lastName}`
                                      : "Assigned Sub-Admin"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                        <Link
                          href={`/admin/users/${client._id}`}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center transition-colors"
                        >
                          Manage KYC & Documents
                        </Link>
                        <button
                          onClick={() =>
                            handleDeleteAccount(
                              client._id,
                              `${client.firstName} ${client.lastName}`
                            )
                          }
                          className="p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. DOCUMENTS & E-SIGNATURES TAB */}
          {activeTab === "documents" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    All Client Documents & E-Signatures
                  </h1>
                  <p className="text-sm text-slate-500">
                    Upload agreements to clients, track signature execution, and download signed PDFs.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {[
                    { id: "all", label: "All Documents" },
                    { id: "pending_signature", label: "Pending Signature" },
                    { id: "signed", label: "Signed & Certified" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setDocStatusFilter(f.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        docStatusFilter === f.id
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-5">Document</th>
                        <th className="py-3.5 px-4">Assigned Client</th>
                        <th className="py-3.5 px-4">Folder</th>
                        <th className="py-3.5 px-4">Status & Certificate</th>
                        <th className="py-3.5 px-4">Signature Preview</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredDocs.map((doc) => (
                        <tr key={doc._id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <FileTypeIcon
                                type={doc.fileType}
                                fileName={doc.fileName}
                                size="sm"
                              />
                              <div>
                                <p className="font-bold text-slate-900">
                                  {doc.title}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Uploaded{" "}
                                  {new Date(doc.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {doc.user ? (
                              <Link
                                href={`/admin/users/${doc.user._id}`}
                                className="font-bold text-blue-600 hover:underline block"
                              >
                                {doc.user.firstName} {doc.user.lastName}
                              </Link>
                            ) : (
                              <span className="text-slate-400">Client</span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {doc.user?.email}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                              {doc.folder}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {doc.status === "signed" ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Signed
                                </span>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {doc.signature?.certificateId}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                Pending Signature
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {doc.status === "signed" && doc.signature ? (
                              doc.signature.signatureDataUrl ? (
                                <img
                                  src={doc.signature.signatureDataUrl}
                                  alt="Signature"
                                  className="h-9 object-contain bg-slate-50 rounded border border-slate-200 px-2 py-0.5"
                                />
                              ) : (
                                <span className="font-sig-dancing text-lg text-blue-700">
                                  {doc.signature.typedText ||
                                    doc.signature.signerName}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 italic">
                                Awaiting client
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <a
                                href={`/api/documents/${doc._id}/download?inline=1`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                                title="Preview PDF"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`/api/documents/${doc._id}/download`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                              >
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. MANAGE SUB-ADMINS TAB */}
          {activeTab === "subadmins" && canManageSubAdmins && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    Sub-Admin Hierarchy & Permissions
                  </h1>
                  <p className="text-sm text-slate-500">
                    Manage Sub-Admin accounts, client visibility, and compliance permissions.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setNewMember((p) => ({ ...p, role: "subadmin" }));
                    setActiveTab("add-member");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add New Sub-Admin
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {subAdminsList.map((sub) => (
                  <div
                    key={sub._id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {sub.firstName} {sub.lastName}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {sub.email} • {sub.phone}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                        {sub.managedUsersCount?.total || 0} Managed Clients
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                      <span>
                        Dedicated:{" "}
                        <strong>{sub.managedUsersCount?.dedicated || 0}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Global Shared:{" "}
                        <strong>{sub.managedUsersCount?.shared || 0}</strong>
                      </span>
                    </div>

                    {/* Permission Toggles */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Granular Sub-Admin Permissions
                      </p>
                      {[
                        {
                          key: "viewClientDetails",
                          label: "View Client Contact Details (Email/Phone)",
                        },
                        {
                          key: "editUserProfile",
                          label: "Edit Client Profile Details",
                        },
                        {
                          key: "canReviewKyc",
                          label: "Approve / Reject KYC Verification",
                        },
                        {
                          key: "canManageDocuments",
                          label: "Upload & Manage Client Documents",
                        },
                      ].map((perm) => {
                        const checked =
                          sub.permissions?.[perm.key] !== undefined
                            ? Boolean(sub.permissions[perm.key])
                            : true;
                        return (
                          <label
                            key={perm.key}
                            className="flex items-center justify-between text-xs text-slate-700 py-1 cursor-pointer"
                          >
                            <span>{perm.label}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                handleToggleSubAdminPermission(
                                  sub,
                                  perm.key,
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() =>
                          handleDeleteAccount(
                            sub._id,
                            `Sub-Admin ${sub.firstName} ${sub.lastName}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Sub-Admin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. MANAGE ADMINS TAB (Superadmin Only) */}
          {activeTab === "admins" && isSuperAdmin && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    Administrator Management (Superadmin)
                  </h1>
                  <p className="text-sm text-slate-500">
                    Control Admin accounts, sub-management privileges, and custom SMTP servers.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setNewMember((p) => ({ ...p, role: "admin" }));
                    setActiveTab("add-member");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add New Admin
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {adminsList.map((adm) => (
                  <div
                    key={adm._id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 capitalize">
                          {adm.firstName} {adm.lastName}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {adm.email} • {adm.phone}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold">
                        Admin
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Admin Privileges
                      </p>
                      {[
                        {
                          key: "isProfileUpdate",
                          label: "Can Edit Client Profiles",
                        },
                        {
                          key: "isSubManagement",
                          label: "Can Create & Manage Sub-Admins",
                        },
                        {
                          key: "isEditSubManagementPermissions",
                          label: "Can Edit Sub-Admin Permissions",
                        },
                        {
                          key: "isAddUsersToSubAdmin",
                          label: "Can Assign Clients to Sub-Admins",
                        },
                      ].map((perm) => {
                        const checked =
                          adm.adminPermissions?.[perm.key] !== undefined
                            ? Boolean(adm.adminPermissions[perm.key])
                            : true;
                        return (
                          <label
                            key={perm.key}
                            className="flex items-center justify-between text-xs text-slate-700 py-1 cursor-pointer"
                          >
                            <span>{perm.label}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                handleToggleAdminPermission(
                                  adm,
                                  perm.key,
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSmtpModalAdmin(adm);
                          setSmtpForm({
                            enabled: Boolean(adm.smtpConfig?.enabled),
                            host: adm.smtpConfig?.host || "",
                            port: adm.smtpConfig?.port || 465,
                            user: adm.smtpConfig?.user || "",
                            pass: adm.smtpConfig?.pass || "",
                            fromEmail: adm.smtpConfig?.fromEmail || "",
                            fromName: adm.smtpConfig?.fromName || "SignDocs",
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                      >
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        Configure SMTP
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteAccount(
                            adm._id,
                            `Admin ${adm.firstName} ${adm.lastName}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Admin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. ADD NEW ACCOUNT TAB */}
          {activeTab === "add-member" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">
                  Add New Account
                </h1>
                <p className="text-sm text-slate-500">
                  Create a new Client, Sub-Admin, or Admin account in the portal.
                </p>
              </div>

              <form
                onSubmit={handleCreateMember}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Role
                  </label>
                  <select
                    value={newMember.role}
                    onChange={(e) =>
                      setNewMember((p) => ({ ...p, role: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="user">Client (KYC & Document Signing)</option>
                    {canManageSubAdmins && (
                      <option value="subadmin">Sub-Admin (Staff)</option>
                    )}
                    {isSuperAdmin && (
                      <option value="admin">Administrator (Full Staff)</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      First Name *
                    </label>
                    <input
                      required
                      value={newMember.firstName}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, firstName: e.target.value }))
                      }
                      placeholder="First Name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      required
                      value={newMember.lastName}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, lastName: e.target.value }))
                      }
                      placeholder="Last Name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={newMember.email}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="email@domain.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      required
                      value={newMember.phone}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder="+49 151 8766106"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Address
                    </label>
                    <input
                      value={newMember.address}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, address: e.target.value }))
                      }
                      placeholder="Street Address"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      value={newMember.city}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, city: e.target.value }))
                      }
                      placeholder="City"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Country
                    </label>
                    <input
                      value={newMember.country}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, country: e.target.value }))
                      }
                      placeholder="Country"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={newMember.password}
                    onChange={(e) =>
                      setNewMember((p) => ({ ...p, password: e.target.value }))
                    }
                    placeholder="Min. 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={creatingMember}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                  >
                    {creatingMember ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 7. GLOBAL COMPLIANCE SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">
                  Global Compliance & Portal Settings
                </h1>
                <p className="text-sm text-slate-500">
                  Configure email verification requirements and KYC signing policies.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-5">
                <label className="flex items-start justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Require Email Verification on Registration
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When enabled, new self-registered clients must click a verification link in their email before logging in.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={sysSettings.requireEmailVerification}
                    onChange={(e) =>
                      handleUpdateSystemSettings({
                        requireEmailVerification: e.target.checked,
                      })
                    }
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <div className="border-t border-slate-100 pt-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Require Approved KYC Before Document Signing
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        When enabled, clients can preview documents but must have Approved KYC status before executing an electronic signature.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sysSettings.requireKycBeforeSign}
                      onChange={(e) =>
                        handleUpdateSystemSettings({
                          requireKycBeforeSign: e.target.checked,
                        })
                      }
                      className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Sub-Admin Assignment Modal */}
      {assignModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold">Assign Sub-Admins</h3>
                <p className="text-xs text-slate-400">
                  Client: {assignModalUser.firstName} {assignModalUser.lastName}
                </p>
              </div>
              <button
                onClick={() => setAssignModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
              {subAdminsList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  No Sub-Admins created yet.
                </p>
              ) : (
                subAdminsList.map((sub) => {
                  const id = String(sub._id);
                  const checked = selectedSubAdminIds.includes(id);
                  return (
                    <label
                      key={id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        checked
                          ? "border-blue-600 bg-blue-50/40"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {sub.firstName} {sub.lastName}
                        </p>
                        <p className="text-[11px] text-slate-500">{sub.email}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubAdminIds((prev) => [...prev, id]);
                          } else {
                            setSelectedSubAdminIds((prev) =>
                              prev.filter((item) => item !== id)
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setAssignModalUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubAdminAssignment}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom SMTP Config Modal */}
      {smtpModalAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveSmtpConfig}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold">Custom SMTP Configuration</h3>
                <p className="text-xs text-slate-400">
                  Admin: {smtpModalAdmin.firstName} {smtpModalAdmin.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSmtpModalAdmin(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpForm.enabled}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, enabled: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Enable Custom Outgoing SMTP Server
              </label>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    SMTP Host
                  </label>
                  <input
                    value={smtpForm.host}
                    onChange={(e) =>
                      setSmtpForm((p) => ({ ...p, host: e.target.value }))
                    }
                    placeholder="smtp.hostinger.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={smtpForm.port}
                    onChange={(e) =>
                      setSmtpForm((p) => ({
                        ...p,
                        port: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  SMTP Username / Email
                </label>
                <input
                  value={smtpForm.user}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, user: e.target.value }))
                  }
                  placeholder="support@betabase.pro"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  SMTP Password
                </label>
                <input
                  type="password"
                  value={smtpForm.pass}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, pass: e.target.value }))
                  }
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSmtpModalAdmin(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                Save SMTP
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Document Modal */}
      <UploadDocumentModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        clients={usersList}
        preselectedUserId={uploadTargetUserId}
        onUploaded={fetchAdminData}
        showToast={showToast}
      />
    </div>
  );
}
