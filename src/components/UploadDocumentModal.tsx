"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  UploadCloud,
  FileText,
  FolderOpen,
  UserCheck,
  Globe,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ClientOption {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients?: ClientOption[];
  preselectedUserId?: string;
  onUploaded: () => void;
  showToast: (
    title: string,
    type?: "success" | "error" | "info",
    description?: string
  ) => void;
}

const FOLDERS = [
  "Contracts",
  "Agreements",
  "NDAs",
  "KYC & Compliance",
  "Other",
] as const;

export default function UploadDocumentModal({
  isOpen,
  onClose,
  clients = [],
  preselectedUserId = "",
  onUploaded,
  showToast,
}: UploadDocumentModalProps) {
  const { user } = useAuth();
  const isStaff =
    user?.role === "superadmin" ||
    user?.role === "admin" ||
    user?.role === "subadmin";

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [shareScope, setShareScope] = useState<"" | "user" | "global">(
    preselectedUserId ? "user" : ""
  );
  const [selectedUserId, setSelectedUserId] = useState(preselectedUserId || "");
  const [fetchedClients, setFetchedClients] = useState<ClientOption[]>([]);
  const [folder, setFolder] = useState<string>("Agreements");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentPreview, setContentPreview] = useState("");
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const availableClients = clients.length > 0 ? clients : fetchedClients;

  useEffect(() => {
    if (isOpen && isStaff && clients.length === 0) {
      fetch("/api/users?role=user")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.users)) {
            setFetchedClients(d.users);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, isStaff, clients.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (preselectedUserId) {
      setShareScope("user");
      setSelectedUserId(preselectedUserId);
    } else {
      setShareScope("");
      setSelectedUserId("");
    }
  }, [isOpen, preselectedUserId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...incoming]);
      if (!title && incoming.length === 1) {
        setTitle(incoming[0].name);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isStaff) {
      if (!shareScope) {
        showToast(
          "Please select whether to assign to a Specific Client or share Globally",
          "error"
        );
        return;
      }
      if (shareScope === "user" && !selectedUserId) {
        showToast(
          "Please select a client from the list or choose Global (All Clients)",
          "error"
        );
        return;
      }
    }

    if (files.length === 0 && !title.trim()) {
      showToast(
        "Please select a file to upload or enter a document title",
        "error"
      );
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      const isGlobalUpload = isStaff && shareScope === "global";

      formData.append("isGlobal", String(isGlobalUpload));
      if (isGlobalUpload) {
        formData.append("userId", "global");
      } else if (selectedUserId) {
        formData.append("userId", selectedUserId);
      }

      formData.append("folder", folder);
      if (title.trim()) formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());
      if (contentPreview.trim()) {
        formData.append("documentContentPreview", contentPreview.trim());
      }
      formData.append("requiresSignature", String(requiresSignature));

      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.msg || "Upload failed");
      }

      showToast(
        data.msg ||
          (isGlobalUpload
            ? "Document uploaded and shared globally!"
            : "Document uploaded and sent for signature!"),
        "success"
      );
      setFiles([]);
      setTitle("");
      setDescription("");
      setContentPreview("");
      onUploaded();
      onClose();
    } catch (err: any) {
      showToast(err?.message || "Failed to upload document", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Upload Document for Signature</h3>
              <p className="text-xs text-slate-400">
                Assign to a specific client or share globally with all clients
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Recipient Scope Selector (Staff must choose Specific Client or Global) */}
          {isStaff && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Share Document With <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShareScope("user");
                      if (selectedUserId === "__GLOBAL__") {
                        setSelectedUserId("");
                      }
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      shareScope === "user"
                        ? "border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/15"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        shareScope === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">
                        Specific Client
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Select a single user
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShareScope("global");
                      setSelectedUserId("__GLOBAL__");
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      shareScope === "global"
                        ? "border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/15"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        shareScope === "global"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">
                        Global (All Clients)
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Share with everyone
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {shareScope === "global" ? (
                <div className="rounded-xl bg-blue-50/80 border border-blue-200 p-3 flex items-start gap-2.5">
                  <Globe className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 leading-relaxed">
                    <strong>Global Sharing Selected:</strong> Every client will see
                    this document in their Document Gallery and can sign their own
                    individual certified copy.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Assign to Client <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__GLOBAL__") {
                        setShareScope("global");
                        setSelectedUserId("__GLOBAL__");
                      } else if (val) {
                        setShareScope("user");
                        setSelectedUserId(val);
                      } else {
                        setSelectedUserId("");
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      -- Select a Client or Global Sharing --
                    </option>
                    <option value="__GLOBAL__">
                      🌐 Global — Share with All Clients
                    </option>
                    {availableClients.length > 0 && (
                      <optgroup label="Specific Clients">
                        {availableClients.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.firstName} {c.lastName} ({c.email})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Folder & Document Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                Category Folder
              </label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FOLDERS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Service Agreement.pdf"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Drag & Drop File Upload Box */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 p-5 text-center transition-all"
            >
              <UploadCloud className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Click to select PDF, DOCX, or Image files
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Or leave empty to auto-generate a formatted PDF contract from the clauses below
              </p>
            </div>

            {files.length > 0 && (
              <div className="mt-2.5 space-y-1.5 max-h-32 overflow-y-auto">
                {files.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 text-xs"
                  >
                    <span className="font-medium text-slate-700 truncate">
                      {f.name}{" "}
                      <span className="text-slate-400">
                        ({(f.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Description & Preview Clauses */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Summary / Notes for Client
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief instructions or description for the signer..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document Clauses / Text Preview (Optional)
            </label>
            <textarea
              rows={3}
              value={contentPreview}
              onChange={(e) => setContentPreview(e.target.value)}
              placeholder="Paste custom agreement clauses here to display in the interactive reader and generated PDF..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2.5 pt-1 px-3.5 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80">
            <input
              type="checkbox"
              checked={true}
              readOnly
              className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-default"
            />
            <span className="text-xs font-semibold text-blue-900">
              Handwritten Client Signature is Compulsory on this document
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {uploading
                ? "Uploading..."
                : shareScope === "global"
                ? "Upload & Share Globally"
                : "Upload & Send for Signature"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

