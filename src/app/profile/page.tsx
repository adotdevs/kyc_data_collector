"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Save,
  PenTool,
  ShieldCheck,
  Server,
  Send,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import SignatureModal from "@/components/SignatureModal";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user, loading, refreshUser, showToast } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sigModalOpen, setSigModalOpen] = useState(false);

  const [smtpForm, setSmtpForm] = useState({
    enabled: true,
    host: "smtp.hostinger.com",
    port: 465,
    user: "",
    pass: "",
    fromEmail: "",
    fromName: "GOin SAS",
    adminAlertEmail: "info@goin-in-vest.com",
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
        city: user.city || "",
        country: user.country || "",
        postalCode: user.postalCode || "",
        password: "",
      });

      if (user.role === "superadmin" || user.role === "admin" || user.role === "subadmin") {
        if (user.smtpConfig && user.smtpConfig.host && user.smtpConfig.user) {
          setSmtpForm({
            enabled: user.smtpConfig.enabled !== false,
            host: user.smtpConfig.host || "smtp.hostinger.com",
            port: Number(user.smtpConfig.port || 465),
            user: user.smtpConfig.user || "",
            pass: user.smtpConfig.pass || "",
            fromEmail: user.smtpConfig.fromEmail || user.smtpConfig.user || "",
            fromName: user.smtpConfig.fromName || "GOin SAS",
            adminAlertEmail:
              user.smtpConfig.adminAlertEmail || "info@goin-in-vest.com",
          });
        } else if (user.role === "superadmin") {
          fetch("/api/settings")
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.settings?.smtpConfig) {
                const sc = d.settings.smtpConfig;
                setSmtpForm({
                  enabled: sc.enabled !== false,
                  host: sc.host || "smtp.hostinger.com",
                  port: Number(sc.port || 465),
                  user: sc.user || "",
                  pass: sc.pass || "",
                  fromEmail: sc.fromEmail || sc.user || "",
                  fromName: sc.fromName || "GOin SAS",
                  adminAlertEmail:
                    sc.adminAlertEmail || "info@goin-in-vest.com",
                });
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        postalCode: formData.postalCode,
      };
      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.msg || "Update failed");
      }

      showToast("Profile updated successfully", "success");
      setFormData((p) => ({ ...p, password: "" }));
      await refreshUser();
    } catch (err: any) {
      showToast(err?.message || "Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignature = async (payload: {
    signatureDataUrl: string;
  }) => {
    if (
      !payload.signatureDataUrl ||
      !payload.signatureDataUrl.startsWith("data:image/") ||
      payload.signatureDataUrl.length < 200
    ) {
      throw new Error(
        "Handwritten signature is compulsory. Please draw your signature before saving."
      );
    }
    const res = await fetch(`/api/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedSignature: payload.signatureDataUrl }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.msg || "Could not save signature");
    }
    showToast("Handwritten signature saved!", "success");
    await refreshUser();
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpConfig: {
            enabled: smtpForm.enabled,
            host: smtpForm.host.trim(),
            port: Number(smtpForm.port || 465),
            user: smtpForm.user.trim(),
            pass: smtpForm.pass,
            fromEmail: (smtpForm.fromEmail || smtpForm.user).trim(),
            fromName: (smtpForm.fromName || "GOin SAS").trim(),
            adminAlertEmail: (
              smtpForm.adminAlertEmail || "info@goin-in-vest.com"
            ).trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.msg || "Failed to save SMTP configuration");
      }
      showToast("SMTP mail settings saved successfully!", "success");
      await refreshUser();
    } catch (err: any) {
      showToast(err?.message || "Failed to save SMTP configuration", "error");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const res = await fetch("/api/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpConfig: {
            enabled: true,
            host: smtpForm.host.trim(),
            port: Number(smtpForm.port || 465),
            secure: Number(smtpForm.port || 465) === 465,
            user: smtpForm.user.trim(),
            pass: smtpForm.pass,
            fromEmail: (smtpForm.fromEmail || smtpForm.user).trim(),
            fromName: (smtpForm.fromName || "GOin SAS").trim(),
            adminAlertEmail: (
              smtpForm.adminAlertEmail || "info@goin-in-vest.com"
            ).trim(),
          },
          testRecipient: (smtpForm.fromEmail || smtpForm.user || user.email).trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.msg || "SMTP test failed");
      }
      showToast(data.msg || "Test email sent successfully!", "success");
    } catch (err: any) {
      showToast(err?.message || "SMTP connection test failed", "error");
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Profile & Digital Signature
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your personal contact information and your saved e-signature.
          </p>
        </div>

        {/* Saved Signature Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Saved Electronic Signature
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              Configure a reusable signature to sign contracts and compliance
              documents in a single click.
            </p>
            {user.savedSignature ? (
              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 inline-block">
                <img
                  src={user.savedSignature}
                  alt="Saved Signature"
                  className="h-14 object-contain"
                />
              </div>
            ) : (
              <p className="text-xs italic text-slate-400 pt-1">
                No default signature saved yet.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSigModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center gap-2"
            >
              <PenTool className="w-3.5 h-3.5" />
              {user.savedSignature ? "Update Signature" : "Create Signature"}
            </button>
          </div>
        </div>

        {/* Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">
              Account & Contact Information
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold capitalize">
              <ShieldCheck className="w-3.5 h-3.5" />
              {user.role}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                First Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, firstName: e.target.value }))
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Last Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, lastName: e.target.value }))
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Street Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, address: e.target.value }))
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, city: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Country
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, country: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (leave blank to keep current)
            </label>
            <div className="relative max-w-sm">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Profile Changes"}
            </button>
          </div>
        </form>

        {/* Superadmin / Staff SMTP Mail Server Configuration Card */}
        {(user.role === "superadmin" ||
          user.role === "admin" ||
          user.role === "subadmin") && (
          <form
            onSubmit={handleSaveSmtp}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    SMTP Mail Server Configuration
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {user.role === "superadmin"
                    ? "Configure the primary SMTP email server used for Client Onboarding agreements (Get Started page) and all system notifications."
                    : "Configure your custom staff SMTP sender credentials."}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpForm.enabled}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  SMTP Enabled
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  required
                  placeholder="smtp.hostinger.com"
                  value={smtpForm.host}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, host: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Port (465 SSL / 587 TLS)
                </label>
                <input
                  type="number"
                  required
                  placeholder="465"
                  value={smtpForm.port}
                  onChange={(e) =>
                    setSmtpForm((p) => ({
                      ...p,
                      port: Number(e.target.value || 465),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Username / Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="info@goin-in-vest.com"
                  value={smtpForm.user}
                  onChange={(e) =>
                    setSmtpForm((p) => ({
                      ...p,
                      user: e.target.value,
                      fromEmail: p.fromEmail || e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Password
                </label>
                <div className="relative">
                  <input
                    type={showSmtpPass ? "text" : "password"}
                    required
                    placeholder="Enter SMTP password"
                    value={smtpForm.pass}
                    onChange={(e) =>
                      setSmtpForm((p) => ({ ...p, pass: e.target.value }))
                    }
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showSmtpPass ? "Hide SMTP password" : "Show SMTP password"}
                  >
                    {showSmtpPass ? (
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
                  From / Recipient Email (Receives Onboarding Forms)
                </label>
                <input
                  type="email"
                  required
                  placeholder="info@goin-in-vest.com"
                  value={smtpForm.fromEmail}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, fromEmail: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  placeholder="GOin SAS"
                  value={smtpForm.fromName}
                  onChange={(e) =>
                    setSmtpForm((p) => ({ ...p, fromName: e.target.value }))
                  }
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
                placeholder="info@goin-in-vest.com"
                value={smtpForm.adminAlertEmail}
                onChange={(e) =>
                  setSmtpForm((p) => ({ ...p, adminAlertEmail: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Real-time email notifications for every client KYC submission, signed document, and onboarding agreement are dispatched to this address (default: info@goin-in-vest.com).
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
              {user.role === "superadmin" && (
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  {testingSmtp ? "Testing SMTP..." : "Send Test Email"}
                </button>
              )}
              <button
                type="submit"
                disabled={savingSmtp}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm"
              >
                <Save className="w-4 h-4" />
                {savingSmtp ? "Saving SMTP..." : "Save SMTP Settings"}
              </button>
            </div>
          </form>
        )}
      </main>

      <SignatureModal
        isOpen={sigModalOpen}
        onClose={() => setSigModalOpen(false)}
        documentTitle="Saved Profile Signature"
        defaultSignerName={`${user.firstName} ${user.lastName}`}
        defaultSignerEmail={user.email}
        savedSignature={user.savedSignature}
        onConfirmSign={handleSaveSignature}
      />
    </div>
  );
}

