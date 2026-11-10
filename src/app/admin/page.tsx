"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  EyeOff,
  Sliders,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import FileTypeIcon from "@/components/FileTypeIcon";
import UploadDocumentModal from "@/components/UploadDocumentModal";
import { triggerTopProgress } from "@/components/TopProgressBar";
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
    adminAlertEmail: "info@goin-in-vest.com",
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
    companyName: "GOin SAS Compliance Portal",
    supportEmail: "support@betabase.pro",
    smtpConfig: {
      enabled: true,
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      user: "support@betabase.pro",
      pass: "",
      fromEmail: "support@betabase.pro",
      fromName: "GOin SAS",
      adminAlertEmail: "info@goin-in-vest.com",
    },
  });
  const [savingGlobalSmtp, setSavingGlobalSmtp] = useState(false);
  const [testingGlobalSmtp, setTestingGlobalSmtp] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [showGlobalSmtpPass, setShowGlobalSmtpPass] = useState(false);
  const [showNewMemberPass, setShowNewMemberPass] = useState(false);
  const [showAdminSmtpPass, setShowAdminSmtpPass] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<
    Record<string, boolean>
  >({});

  // Bulk Selection State
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedSubAdminAccountIds, setSelectedSubAdminAccountIds] = useState<
    string[]
  >([]);
  const [selectedAdminAccountIds, setSelectedAdminAccountIds] = useState<
    string[]
  >([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleUserPasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleItemSelection = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  const isSubAdmin = user?.role === "subadmin";
  const canManageSubAdmins =
    isSuperAdmin || (isAdmin && user?.adminPermissions?.isSubManagement !== false);
  const canEditSubAdminPerms =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.isEditSubManagementPermissions !== false);
  const canAssignUsersToSubAdmin =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.isAddUsersToSubAdmin !== false);
  const canCreateClients =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.canCreateUsers !== false) ||
    (isSubAdmin && user?.permissions?.canCreateUsers !== false);
  const canCreateAnyAccount =
    canCreateClients || canManageSubAdmins || isSuperAdmin;
  const canDeleteClients =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.canDeleteUsers !== false) ||
    (isSubAdmin && user?.permissions?.canDeleteUsers === true);
  const canManageDocuments =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.canManageDocuments !== false) ||
    (isSubAdmin && user?.permissions?.canManageDocuments !== false);
  const canDeleteDocuments =
    isSuperAdmin ||
    (isAdmin &&
      user?.adminPermissions?.canManageDocuments !== false &&
      user?.adminPermissions?.canDeleteDocuments !== false) ||
    (isSubAdmin &&
      user?.permissions?.canManageDocuments !== false &&
      user?.permissions?.canDeleteDocuments === true);
  const canManageKyc =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.canManageKyc !== false) ||
    (isSubAdmin && user?.permissions?.canReviewKyc !== false);
  const canManageComplianceLock =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.canManageComplianceLock !== false) ||
    (isSubAdmin && user?.permissions?.canManageComplianceLock !== false);
  const canManageGlobalSettings =
    isSuperAdmin ||
    (isAdmin && user?.adminPermissions?.canManageSettings !== false);

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
        setSysSettings((prev) => ({
          ...prev,
          ...settingsData.settings,
          smtpConfig: {
            ...prev.smtpConfig,
            ...(settingsData.settings.smtpConfig || {}),
          },
        }));
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

  // ==================== SORTED RECENT TILES (LATEST ACTIVITY TOP) ====================

  const sortedKycClients = useMemo(() => {
    return [...usersList].sort((a, b) => {
      // 1. Pending KYC review submissions ALWAYS on top
      const aPending = !a.kyc && a.submitDoc?.status === "completed";
      const bPending = !b.kyc && b.submitDoc?.status === "completed";
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      // 2. Rejected KYC next
      const aRejected = !a.kyc && a.submitDoc?.status === "rejected";
      const bRejected = !b.kyc && b.submitDoc?.status === "rejected";
      if (aRejected && !bRejected) return -1;
      if (!aRejected && bRejected) return 1;

      // 3. Newest activity (submittedAt, updatedAt, or createdAt)
      const aRaw = a.submitDoc?.submittedAt || a.updatedAt || a.createdAt;
      const bRaw = b.submitDoc?.submittedAt || b.updatedAt || b.createdAt;
      const aTime = aRaw ? new Date(aRaw).getTime() : 0;
      const bTime = bRaw ? new Date(bRaw).getTime() : 0;
      return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
    });
  }, [usersList]);

  const sortedRecentDocs = useMemo(() => {
    return [...documentsList].sort((a, b) => {
      // Latest signature or document creation/update
      const aRaw = a.signature?.signedAt || a.updatedAt || a.createdAt;
      const bRaw = b.signature?.signedAt || b.updatedAt || b.createdAt;
      const aTime = aRaw ? new Date(aRaw).getTime() : 0;
      const bTime = bRaw ? new Date(bRaw).getTime() : 0;
      return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
    });
  }, [documentsList]);

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
    action: "approve" | "reject",
    customReason?: string
  ) => {
    try {
      const res = await fetch(`/api/kyc/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason:
            action === "reject"
              ? customReason ||
              "Your KYC documents were reviewed and rejected by compliance. Please upload valid, legible copies."
            : undefined,
        }),
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

  const handleBulkDeleteUsers = async (
    ids: string[],
    label: string,
    clearSelection: () => void
  ) => {
    if (ids.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${ids.length} selected ${label}?`
      )
    ) {
      return;
    }
    try {
      setBulkDeleting(true);
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.msg || `Deleted ${ids.length} ${label} successfully`,
          "info"
        );
        clearSelection();
        fetchAdminData();
      } else {
        showToast(data.msg || "Bulk delete failed", "error");
      }
    } catch {
      showToast("Failed to bulk delete accounts", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkDeleteDocuments = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${ids.length} selected document(s)?`
      )
    ) {
      return;
    }
    try {
      setBulkDeleting(true);
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.msg || `Deleted ${ids.length} document(s) successfully`,
          "info"
        );
        setSelectedDocIds([]);
        fetchAdminData();
      } else {
        showToast(data.msg || "Bulk document deletion failed", "error");
      }
    } catch {
      showToast("Failed to delete selected documents", "error");
    } finally {
      setBulkDeleting(false);
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

  const handleDeleteDocument = async (docId: string, docTitle?: string) => {
    if (
      !confirm(
        `Delete document "${docTitle || "this document"}" from portal and Cloudinary?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast("Document deleted", "info");
        fetchAdminData();
      } else {
        showToast(data.msg || "Failed to delete document", "error");
      }
    } catch {
      showToast("Error deleting document", "error");
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

  const handleSaveGlobalSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobalSmtp(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: sysSettings.companyName,
          supportEmail: sysSettings.supportEmail,
          smtpConfig: sysSettings.smtpConfig,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Global SMTP configuration saved!", "success");
      } else {
        showToast(data.msg || "Failed to save SMTP configuration", "error");
      }
    } catch {
      showToast("Error saving Global SMTP configuration", "error");
    } finally {
      setSavingGlobalSmtp(false);
    }
  };

  const handleTestGlobalSmtp = async () => {
    setTestingGlobalSmtp(true);
    try {
      const res = await fetch("/api/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpConfig: sysSettings.smtpConfig,
          testRecipient: testRecipientEmail.trim() || user.email,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.msg || "Test email sent!", "success");
      } else {
        showToast(data.msg || "SMTP connection test failed", "error");
      }
    } catch {
      showToast("Failed to run SMTP test", "error");
    } finally {
      setTestingGlobalSmtp(false);
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
        show: canCreateAnyAccount,
      },
      {
        id: "settings",
        label: "Settings & Global SMTP",
        icon: Settings,
        show: canManageGlobalSettings,
      },
    ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
        {/* ==================== ADMIN SIDEBAR ==================== */}
        <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-5 space-y-6">
          {canManageDocuments && (
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
          )}

          <nav className="space-y-1">
            {sidebarTabs
              .filter((t) => t.show)
              .map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      triggerTopProgress();
                      setActiveTab(tab.id);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${active
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
                        className={`text-[11px] px-2 py-0.5 rounded-full ${active
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
                  {canCreateAnyAccount && (
                    <button
                      onClick={() => {
                        setNewMember((p) => ({
                          ...p,
                          role: canCreateClients
                            ? "user"
                            : canManageSubAdmins
                              ? "subadmin"
                              : "admin",
                        }));
                        setActiveTab("add-member");
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-sm"
                    >
                      <UserPlus className="w-4 h-4 text-blue-600" />
                      Add Client / Staff
                    </button>
                  )}
                  {canManageDocuments && (
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
                  )}
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

              {/* Two-Column Recent Activity: Recent Clients & Recent Signed Docs (LATEST ON TOP) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Recent Clients & KYC Queue */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Client KYC Onboarding Status
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Latest submissions &amp; pending reviews prioritized at the top
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("clients")}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      View All Clients
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {sortedKycClients.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400">
                        No client accounts found yet.
                      </p>
                    ) : (
                      sortedKycClients.slice(0, 6).map((client) => (
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
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold animate-pulse">
                                  KYC Submitted (Review)
                                </span>
                              ) : client.submitDoc?.status === "rejected" ? (
                                <span
                                  className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold"
                                  title={client.submitDoc?.rejectionReason || "KYC Rejected"}
                                >
                                  KYC Rejected
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                                  Onboarding
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {client.email}
                              {client.submitDoc?.submittedAt
                                ? ` • Submitted: ${new Date(client.submitDoc.submittedAt).toLocaleDateString()}`
                                : client.createdAt
                              ? ` • Joined: ${new Date(client.createdAt).toLocaleDateString()}`
                                  : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!client.kyc && canManageKyc && (
                              <>
                                <button
                                  onClick={() =>
                                    handleQuickKycAction(client._id, "approve")
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm"
                                  title="Approve Client KYC"
                                >
                                  Approve
                                </button>
                                {client.submitDoc?.status !== "rejected" && (
                                  <button
                                    onClick={() =>
                                      handleQuickKycAction(client._id, "reject")
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold"
                                    title="Reject Client KYC"
                                  >
                                    Reject
                                  </button>
                                )}
                              </>
                            )}
                            <Link
                              href={`/admin/users/${client._id}`}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold"
                            >
                              Manage
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Documents & Signatures */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Recent Client Documents & Signatures
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Newly signed contracts &amp; uploads prioritized at the top
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("documents")}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      View All Documents
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {sortedRecentDocs.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400">
                        No client documents uploaded yet.
                      </p>
                    ) : (
                      sortedRecentDocs.slice(0, 6).map((doc) => (
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
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                Client: {doc.user?.firstName} {doc.user?.lastName} •{" "}
                                {doc.signature?.signedAt
                                  ? `Signed: ${new Date(doc.signature.signedAt).toLocaleDateString()}`
                                  : doc.createdAt
                                ? `Uploaded: ${new Date(doc.createdAt).toLocaleDateString()}`
                                    : "Agreements"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {doc.status === "signed" ? (
                              <div className="flex items-center gap-2">
                                {doc.signature?.signatureDataUrl && (
                                  <img
                                    src={doc.signature.signatureDataUrl}
                                    alt="Handwritten Signature"
                                    className="h-7 object-contain bg-slate-50 rounded border border-emerald-200 px-1.5"
                                  />
                                )}
                                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                  Signed ✓
                                </span>
                              </div>
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
                      ))
                    )}
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

                {canCreateClients && (
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
                )}
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
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${clientKycFilter === f.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Selection Toolbar for Clients */}
              {canDeleteClients && filteredClients.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                  <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        filteredClients.length > 0 &&
                        filteredClients.every((c) =>
                          selectedClientIds.includes(c._id)
                        )
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClientIds(
                            filteredClients.map((c) => c._id)
                          );
                        } else {
                          setSelectedClientIds([]);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>
                      Select All Visible Clients ({filteredClients.length})
                    </span>
                  </label>

                  {selectedClientIds.length > 0 && (
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                        {selectedClientIds.length} Selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedClientIds([])}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        disabled={bulkDeleting}
                        onClick={() =>
                          handleBulkDeleteUsers(
                            selectedClientIds,
                            "client account(s)",
                            () => setSelectedClientIds([])
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {bulkDeleting
                            ? "Deleting..."
                            : `Delete Selected (${selectedClientIds.length})`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Client Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredClients.map((client) => {
                  const docStats = client.documentStats || {
                    totalDocs: 0,
                    pendingDocs: 0,
                    signedDocs: 0,
                  };
                  const assignedList = client.assignedSubAdmins || [];
                  const isClientSelected = selectedClientIds.includes(
                    client._id
                  );

                  return (
                    <div
                      key={client._id}
                      className={`bg-white rounded-2xl border shadow-card hover:shadow-card-hover transition-all p-5 flex flex-col justify-between space-y-4 ${isClientSelected
                        ? "border-blue-600 ring-2 ring-blue-500/15"
                        : "border-slate-200/90"
                        }`}
                    >
                      <div className="space-y-3.5">
                        {/* Top Header: Checkbox + Name + KYC Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            {canDeleteClients && (
                              <input
                                type="checkbox"
                                checked={isClientSelected}
                                onChange={() =>
                                  toggleItemSelection(
                                    client._id,
                                    setSelectedClientIds
                                  )
                                }
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                title="Select Client"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${client.online
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
                          </div>

                          {client.kyc ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              KYC Verified
                            </span>
                          ) : client.submitDoc?.status === "rejected" ? (
                            <span
                              className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center gap-1"
                              title={client.submitDoc?.rejectionReason || "KYC Rejected"}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              KYC Rejected
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
                          {canManageDocuments && (
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
                          )}
                          {canAssignUsersToSubAdmin && (
                            <button
                              onClick={() => openAssignModal(client)}
                              className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                              title="Assign Sub-Admins"
                            >
                              <UserCog className="w-4 h-4" />
                            </button>
                          )}
                          {canManageComplianceLock && (
                            <button
                              onClick={() =>
                                handleToggleUserFlag(
                                  client._id,
                                  "isComplianceRestricted",
                                  !client.isComplianceRestricted
                                )
                              }
                              className={`p-2 rounded-lg transition-colors ${client.isComplianceRestricted
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
                          )}
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

                          {client.password && (
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                              <span className="flex items-center gap-2 text-slate-700 font-medium truncate">
                                <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="text-slate-500">Password:</span>
                                <code className="font-mono font-bold text-slate-900">
                                  {visiblePasswords[client._id]
                                    ? client.password
                                    : "••••••••"}
                                </code>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleUserPasswordVisibility(client._id)
                                }
                                className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-white transition-colors"
                                title={
                                  visiblePasswords[client._id]
                                    ? "Hide Password"
                                    : "Show Password"
                                }
                              >
                                {visiblePasswords[client._id] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
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
                        {canDeleteClients && (
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
                        )}
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
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${docStatusFilter === f.id
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Selection Bar for Documents */}
              {canDeleteDocuments && selectedDocIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                      {selectedDocIds.length} Document(s) Selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocIds([])}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={bulkDeleting}
                    onClick={() => handleBulkDeleteDocuments(selectedDocIds)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {bulkDeleting
                        ? "Deleting Documents..."
                        : `Delete Selected Documents (${selectedDocIds.length})`}
                    </span>
                  </button>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {canDeleteDocuments && (
                          <th className="py-3.5 pl-5 pr-2 w-10">
                            <input
                              type="checkbox"
                              checked={
                                filteredDocs.filter(
                                  (d) => !d.isGlobal || isSuperAdmin || isAdmin
                                ).length > 0 &&
                                filteredDocs
                                  .filter(
                                    (d) =>
                                      !d.isGlobal || isSuperAdmin || isAdmin
                                  )
                                  .every((d) => selectedDocIds.includes(d._id))
                              }
                              onChange={(e) => {
                                const deletable = filteredDocs
                                  .filter(
                                    (d) =>
                                      !d.isGlobal || isSuperAdmin || isAdmin
                                  )
                                  .map((d) => d._id);
                                setSelectedDocIds(
                                  e.target.checked ? deletable : []
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              title="Select All Documents"
                            />
                          </th>
                        )}
                        <th className="py-3.5 px-5">Document</th>
                        <th className="py-3.5 px-4">Assigned Client</th>
                        <th className="py-3.5 px-4">Folder</th>
                        <th className="py-3.5 px-4">Status & Certificate</th>
                        <th className="py-3.5 px-4">Signature Preview</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredDocs.map((doc) => {
                        const canSelectThisDoc =
                          canDeleteDocuments &&
                          (!doc.isGlobal || isSuperAdmin || isAdmin);
                        const isDocSelected = selectedDocIds.includes(doc._id);

                        return (
                          <tr
                            key={doc._id}
                            className={`transition-colors ${isDocSelected
                              ? "bg-blue-50/40"
                              : "hover:bg-slate-50/80"
                              }`}
                          >
                            {canDeleteDocuments && (
                              <td className="py-3.5 pl-5 pr-2">
                                {canSelectThisDoc && (
                                  <input
                                    type="checkbox"
                                    checked={isDocSelected}
                                    onChange={() =>
                                      toggleItemSelection(
                                        doc._id,
                                        setSelectedDocIds
                                      )
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                )}
                              </td>
                            )}
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
                              {doc.isGlobal ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold">
                                    <Share2 className="w-3 h-3" />
                                    Global (All Clients)
                                  </span>
                                  <span className="text-[11px] text-slate-400 block mt-0.5">
                                    Shared globally
                                  </span>
                                </div>
                              ) : doc.user ? (
                                <>
                                  <Link
                                    href={`/admin/users/${doc.user._id}`}
                                    className="font-bold text-blue-600 hover:underline block"
                                  >
                                    {doc.user.firstName} {doc.user.lastName}
                                  </Link>
                                  <span className="text-[11px] text-slate-400 block">
                                    {doc.user?.email}
                                  </span>
                                  {doc.globalParentId && (
                                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-semibold">
                                      Signed Global Copy
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400">Client</span>
                              )}
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
                              {doc.status === "signed" &&
                                doc.signature?.signatureDataUrl ? (
                                <img
                                  src={doc.signature.signatureDataUrl}
                                  alt="Handwritten Signature"
                                  className="h-9 object-contain bg-slate-50 rounded border border-slate-200 px-2 py-0.5"
                                />
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
                                {canDeleteDocuments &&
                                  (!doc.isGlobal || isSuperAdmin || isAdmin) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteDocument(doc._id, doc.title)
                                      }
                                      className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Delete Document"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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

              {subAdminsList.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                  <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        subAdminsList.length > 0 &&
                        subAdminsList.every((s) =>
                          selectedSubAdminAccountIds.includes(s._id)
                        )
                      }
                      onChange={(e) =>
                        setSelectedSubAdminAccountIds(
                          e.target.checked
                            ? subAdminsList.map((s) => s._id)
                            : []
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Select All Sub-Admins ({subAdminsList.length})</span>
                  </label>

                  {selectedSubAdminAccountIds.length > 0 && (
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                        {selectedSubAdminAccountIds.length} Selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedSubAdminAccountIds([])}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        disabled={bulkDeleting}
                        onClick={() =>
                          handleBulkDeleteUsers(
                            selectedSubAdminAccountIds,
                            "Sub-Admin account(s)",
                            () => setSelectedSubAdminAccountIds([])
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {bulkDeleting
                            ? "Deleting..."
                            : `Delete Selected (${selectedSubAdminAccountIds.length})`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {subAdminsList.map((sub) => (
                  <div
                    key={sub._id}
                    className={`bg-white rounded-2xl border shadow-card p-6 space-y-4 ${selectedSubAdminAccountIds.includes(sub._id)
                      ? "border-blue-600 ring-2 ring-blue-500/15"
                      : "border-slate-200/90"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedSubAdminAccountIds.includes(sub._id)}
                          onChange={() =>
                            toggleItemSelection(
                              sub._id,
                              setSelectedSubAdminAccountIds
                            )
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900">
                            {sub.firstName} {sub.lastName}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {sub.email} • {sub.phone}
                          </p>
                          {sub.password && (
                            <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                              <span className="text-slate-500 font-medium">
                                Password:
                              </span>
                              <code className="font-mono font-bold text-slate-900">
                                {visiblePasswords[sub._id]
                                  ? sub.password
                                  : "••••••••"}
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleUserPasswordVisibility(sub._id)
                                }
                                className="text-slate-500 hover:text-blue-600"
                                title={
                                  visiblePasswords[sub._id]
                                    ? "Hide Password"
                                    : "Show Password"
                                }
                              >
                                {visiblePasswords[sub._id] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
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
                          key: "canCreateUsers",
                          label: "Can Create New Client Accounts",
                          defaultVal: true,
                        },
                        {
                          key: "canDeleteUsers",
                          label: "Can Delete Assigned Client Accounts",
                          defaultVal: false,
                        },
                        {
                          key: "viewClientDetails",
                          label: "View Client Contact Details (Email/Phone)",
                          defaultVal: true,
                        },
                        {
                          key: "editUserProfile",
                          label: "Edit Client Profile & View Client Password",
                          defaultVal: false,
                        },
                        {
                          key: "canReviewKyc",
                          label: "Approve / Reject KYC Verification",
                          defaultVal: true,
                        },
                        {
                          key: "canDeleteKyc",
                          label: "Can Delete Client KYC Documents",
                          defaultVal: false,
                        },
                        {
                          key: "canManageDocuments",
                          label: "Can Upload & Manage Client Documents",
                          defaultVal: true,
                        },
                        {
                          key: "canDeleteDocuments",
                          label: "Can Delete Client Documents",
                          defaultVal: false,
                        },
                        {
                          key: "canManageComplianceLock",
                          label: "Can Restrict / Unlock Client Compliance Access",
                          defaultVal: true,
                        },
                      ].map((perm) => {
                        const checked =
                          sub.permissions?.[perm.key] !== undefined
                            ? Boolean(sub.permissions[perm.key])
                            : perm.defaultVal;
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-center justify-between text-xs text-slate-700 py-1 ${canEditSubAdminPerms
                              ? "cursor-pointer"
                              : "opacity-60 cursor-not-allowed"
                              }`}
                          >
                            <span>{perm.label}</span>
                            <input
                              type="checkbox"
                              disabled={!canEditSubAdminPerms}
                              checked={checked}
                              onChange={(e) =>
                                handleToggleSubAdminPermission(
                                  sub,
                                  perm.key,
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <Link
                        href={`/admin/users/${sub._id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        View / Edit Profile
                      </Link>
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

              {adminsList.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
                  <label className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        adminsList.length > 0 &&
                        adminsList.every((a) =>
                          selectedAdminAccountIds.includes(a._id)
                        )
                      }
                      onChange={(e) =>
                        setSelectedAdminAccountIds(
                          e.target.checked ? adminsList.map((a) => a._id) : []
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Select All Admins ({adminsList.length})</span>
                  </label>

                  {selectedAdminAccountIds.length > 0 && (
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                        {selectedAdminAccountIds.length} Selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedAdminAccountIds([])}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        disabled={bulkDeleting}
                        onClick={() =>
                          handleBulkDeleteUsers(
                            selectedAdminAccountIds,
                            "Admin account(s)",
                            () => setSelectedAdminAccountIds([])
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {bulkDeleting
                            ? "Deleting..."
                            : `Delete Selected (${selectedAdminAccountIds.length})`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {adminsList.map((adm) => (
                  <div
                    key={adm._id}
                    className={`bg-white rounded-2xl border shadow-card p-6 space-y-4 ${selectedAdminAccountIds.includes(adm._id)
                      ? "border-blue-600 ring-2 ring-blue-500/15"
                      : "border-slate-200/90"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedAdminAccountIds.includes(adm._id)}
                          onChange={() =>
                            toggleItemSelection(
                              adm._id,
                              setSelectedAdminAccountIds
                            )
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 capitalize">
                            {adm.firstName} {adm.lastName}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {adm.email} • {adm.phone}
                          </p>
                          {adm.password && (
                            <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                              <span className="text-slate-500 font-medium">
                                Password:
                              </span>
                              <code className="font-mono font-bold text-slate-900">
                                {visiblePasswords[adm._id]
                                  ? adm.password
                                  : "••••••••"}
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleUserPasswordVisibility(adm._id)
                                }
                                className="text-slate-500 hover:text-blue-600"
                                title={
                                  visiblePasswords[adm._id]
                                    ? "Hide Password"
                                    : "Show Password"
                                }
                              >
                                {visiblePasswords[adm._id] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold">
                        Admin
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Granular Admin Privileges
                      </p>
                      {[
                        {
                          key: "canCreateUsers",
                          label: "Can Create New Client Accounts",
                        },
                        {
                          key: "canDeleteUsers",
                          label: "Can Delete Client Accounts (Single & Bulk)",
                        },
                        {
                          key: "isProfileUpdate",
                          label: "Can Edit Client Profiles & View Passwords",
                        },
                        {
                          key: "canManageDocuments",
                          label: "Can Upload & Manage Documents",
                        },
                        {
                          key: "canDeleteDocuments",
                          label: "Can Delete Documents (Single & Bulk)",
                        },
                        {
                          key: "canManageKyc",
                          label: "Can Approve, Reject & Delete KYC Documents",
                        },
                        {
                          key: "canManageComplianceLock",
                          label: "Can Restrict / Unlock Client Compliance Access",
                        },
                        {
                          key: "isSubManagement",
                          label: "Can Create & Delete Sub-Admins",
                        },
                        {
                          key: "isEditSubManagementPermissions",
                          label: "Can Edit Sub-Admin Permissions",
                        },
                        {
                          key: "isAddUsersToSubAdmin",
                          label: "Can Assign Clients to Sub-Admins",
                        },
                        {
                          key: "canManageSettings",
                          label: "Can Edit Global Compliance & SMTP Settings",
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

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${adm._id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          View / Edit Profile
                        </Link>
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
                              fromName: adm.smtpConfig?.fromName || "GOin SAS",
                              adminAlertEmail:
                                adm.smtpConfig?.adminAlertEmail || "info@goin-in-vest.com",
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                        >
                          <Sliders className="w-3.5 h-3.5 text-blue-600" />
                          Configure SMTP
                        </button>
                      </div>

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
                    {canCreateClients && (
                      <option value="user">Client (KYC & Document Signing)</option>
                    )}
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
                  <div className="relative">
                    <input
                      type={showNewMemberPass ? "text" : "password"}
                      required
                      value={newMember.password}
                      onChange={(e) =>
                        setNewMember((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder="Min. 6 characters"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewMemberPass(!showNewMemberPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={
                        showNewMemberPass ? "Hide password" : "Show password"
                      }
                    >
                      {showNewMemberPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
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

          {/* 7. GLOBAL COMPLIANCE & SMTP SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">
                  Global Compliance & SMTP Configuration
                </h1>
                <p className="text-sm text-slate-500">
                  Configure platform policies and the global outgoing SMTP email server.
                </p>
              </div>

              {/* Card A: Compliance & Onboarding Toggles */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Client Onboarding & E-Signing Policies
                </h2>

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

              {/* Card B: Global Outgoing SMTP Server Configuration */}
              <form
                onSubmit={handleSaveGlobalSmtpConfig}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Global Outgoing SMTP Configuration
                      </h2>
                      <p className="text-xs text-slate-500">
                        Used for verification links, KYC alerts, and signed document notifications.
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(sysSettings.smtpConfig?.enabled)}
                      onChange={(e) =>
                        setSysSettings((prev) => ({
                          ...prev,
                          smtpConfig: {
                            ...prev.smtpConfig,
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Enable Global SMTP</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SMTP Host Server *
                    </label>
                    <input
                      type="text"
                      required
                      value={sysSettings.smtpConfig?.host || ""}
                      onChange={(e) =>
                        setSysSettings((prev) => ({
                          ...prev,
                          smtpConfig: {
                            ...prev.smtpConfig,
                            host: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., smtp.hostinger.com or smtp.gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SMTP Port *
                    </label>
                    <input
                      type="number"
                      required
                      value={sysSettings.smtpConfig?.port || 465}
                      onChange={(e) => {
                        const nextPort = Number(e.target.value);
                        setSysSettings((prev) => ({
                          ...prev,
                          smtpConfig: {
                            ...prev.smtpConfig,
                            port: nextPort,
                            secure: nextPort === 465,
                          },
                        }));
                      }}
                      placeholder="465"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SMTP Username / Account Email *
                    </label>
                    <input
                      type="text"
                      required
                      value={sysSettings.smtpConfig?.user || ""}
                      onChange={(e) =>
                        setSysSettings((prev) => ({
                          ...prev,
                          smtpConfig: {
                            ...prev.smtpConfig,
                            user: e.target.value,
                          },
                        }))
                      }
                      placeholder="support@yourdomain.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SMTP Password / App Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showGlobalSmtpPass ? "text" : "password"}
                        required
                        value={sysSettings.smtpConfig?.pass || ""}
                        onChange={(e) =>
                          setSysSettings((prev) => ({
                            ...prev,
                            smtpConfig: {
                              ...prev.smtpConfig,
                              pass: e.target.value,
                            },
                          }))
                        }
                        placeholder="Enter SMTP password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowGlobalSmtpPass(!showGlobalSmtpPass)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={
                          showGlobalSmtpPass ? "Hide password" : "Show password"
                        }
                      >
                        {showGlobalSmtpPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sender From Email
                    </label>
                    <input
                      type="email"
                      value={sysSettings.smtpConfig?.fromEmail || ""}
                      onChange={(e) =>
                        setSysSettings((prev) => ({
                          ...prev,
                          smtpConfig: {
                            ...prev.smtpConfig,
                            fromEmail: e.target.value,
                          },
                        }))
                      }
                      placeholder="noreply@yourdomain.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sender Display Name
                    </label>
                    <input
                      type="text"
                      value={sysSettings.smtpConfig?.fromName || ""}
                      onChange={(e) =>
                        setSysSettings((prev) => ({
                          ...prev,
                          smtpConfig: {
                            ...prev.smtpConfig,
                            fromName: e.target.value,
                          },
                        }))
                      }
                      placeholder="GOin SAS Compliance"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin Notification Alert Email (KYC Submissions, Signed Docs, Onboarding)
                  </label>
                  <input
                    type="email"
                    value={sysSettings.smtpConfig?.adminAlertEmail || ""}
                    onChange={(e) =>
                      setSysSettings((prev) => ({
                        ...prev,
                        smtpConfig: {
                          ...prev.smtpConfig,
                          adminAlertEmail: e.target.value,
                        },
                      }))
                    }
                    placeholder="info@goin-in-vest.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Real-time email notifications for every client KYC submission, signed document, and onboarding agreement are dispatched to this address (default: info@goin-in-vest.com).
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(sysSettings.smtpConfig?.secure)}
                    onChange={(e) =>
                      setSysSettings((prev) => ({
                        ...prev,
                        smtpConfig: {
                          ...prev.smtpConfig,
                          secure: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    Use SSL/TLS Secure Connection (Recommended for Port 465; uncheck for STARTTLS Port 587)
                  </span>
                </label>

                {/* Test SMTP Connection Box */}
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Verify & Send Test Email
                    </label>
                    <input
                      type="email"
                      value={testRecipientEmail}
                      onChange={(e) => setTestRecipientEmail(e.target.value)}
                      placeholder={`Recipient email (defaults to ${user.email})`}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={testingGlobalSmtp}
                    onClick={handleTestGlobalSmtp}
                    className="sm:mt-4 px-4 py-2.5 rounded-xl border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-60 text-xs font-bold shrink-0 transition-colors"
                  >
                    {testingGlobalSmtp
                      ? "Testing SMTP..."
                      : "Send Test Email"}
                  </button>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={savingGlobalSmtp}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
                  >
                    {savingGlobalSmtp
                      ? "Saving SMTP Configuration..."
                      : "Save Global SMTP Configuration"}
                  </button>
                </div>
              </form>
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
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${checked
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
                <div className="relative">
                  <input
                    type={showAdminSmtpPass ? "text" : "password"}
                    value={smtpForm.pass}
                    onChange={(e) =>
                      setSmtpForm((p) => ({ ...p, pass: e.target.value }))
                    }
                    placeholder="••••••••"
                    className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminSmtpPass(!showAdminSmtpPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={
                      showAdminSmtpPass ? "Hide password" : "Show password"
                    }
                  >
                    {showAdminSmtpPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Admin Notification Alert Email
                </label>
                <input
                  type="email"
                  value={smtpForm.adminAlertEmail}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, adminAlertEmail: e.target.value }))
                  }
                  placeholder="info@goin-in-vest.com"
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

