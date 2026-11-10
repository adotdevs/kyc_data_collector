"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Save,
  PenTool,
  ShieldCheck,
  Trash2,
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
  const [saving, setSaving] = useState(false);
  const [sigModalOpen, setSigModalOpen] = useState(false);

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
    const res = await fetch(`/api/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedSignature: payload.signatureDataUrl }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.msg || "Could not save signature");
    }
    showToast("Default electronic signature saved!", "success");
    await refreshUser();
  };

  const clearSavedSignature = async () => {
    await fetch(`/api/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedSignature: null }),
    });
    showToast("Saved signature removed", "info");
    await refreshUser();
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
            {user.savedSignature && (
              <button
                type="button"
                onClick={clearSavedSignature}
                className="p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                title="Remove Saved Signature"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
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
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
