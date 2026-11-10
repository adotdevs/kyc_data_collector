"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  note?: string;
  role: "superadmin" | "admin" | "subadmin" | "user";
  verified: boolean;
  kyc: boolean;
  submitDoc?: {
    status: "pending" | "completed" | "verified" | "rejected";
    cnic?: string | null;
    cnicName?: string | null;
    cnicMimeType?: string | null;
    bill?: string | null;
    billName?: string | null;
    billMimeType?: string | null;
    idType?: "passport" | "national_id" | "driving_license";
    idNumber?: string;
    dateOfBirth?: string;
    nationality?: string;
    submittedAt?: string | null;
    verifiedAt?: string | null;
    rejectionReason?: string | null;
  };
  isShared?: boolean;
  assignedSubAdmins?: any[];
  isComplianceRestricted?: boolean;
  permissions?: {
    viewClientDetails: boolean;
    editUserProfile: boolean;
    canReviewKyc: boolean;
    canManageDocuments: boolean;
  };
  adminPermissions?: {
    isProfileUpdate: boolean;
    isSubManagement: boolean;
    isEditSubManagementPermissions: boolean;
    isAddUsersToSubAdmin: boolean;
    canManageKyc: boolean;
    canManageDocuments: boolean;
  };
  smtpConfig?: {
    enabled: boolean;
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    fromEmail?: string;
    fromName?: string;
  };
  savedSignature?: string | null;
  online?: boolean;
  lastOnline?: string | null;
  createdAt?: string;
}

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  stats: {
    unreadNotifications: number;
    pendingDocsCount: number;
    signedDocsCount: number;
  };
  settings: {
    requireEmailVerification: boolean;
    requireKycBeforeSign: boolean;
    companyName?: string;
  };
  refreshUser: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  showToast: (
    title: string,
    type?: "success" | "error" | "info",
    description?: string
  ) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    unreadNotifications: 0,
    pendingDocsCount: 0,
    signedDocsCount: 0,
  });
  const [settings, setSettings] = useState({
    requireEmailVerification: false,
    requireKycBeforeSign: false,
    companyName: "SignDocs",
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const router = useRouter();

  const showToast = useCallback(
    (
      title: string,
      type: "success" | "error" | "info" = "success",
      description?: string
    ) => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        if (data.stats) setStats(data.stats);
        if (data.settings) setSettings(data.settings);
        return data.user as UserProfile;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      showToast("Signed out successfully", "info");
      router.push("/login");
    }
  }, [router, showToast]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        stats,
        settings,
        refreshUser,
        logout,
        showToast,
      }}
    >
      {children}

      {/* Floating Modern Toast Stack */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 ${
              t.type === "success"
                ? "bg-white/95 border-emerald-200 text-slate-900"
                : t.type === "error"
                ? "bg-white/95 border-rose-200 text-slate-900"
                : "bg-white/95 border-blue-200 text-slate-900"
            }`}
          >
            {t.type === "success" && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {t.type === "error" && (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            {t.type === "info" && (
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.description && (
                <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== t.id))
              }
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

