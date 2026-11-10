"use client";

import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileText,
  FolderOpen,
  UserCheck,
  CheckCircle2,
  Trash2,
} from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedUserId, setSelectedUserId] = useState(preselectedUserId);
  const [folder, setFolder] = useState<string>("Agreements");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentPreview, setContentPreview] = useState("");
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (preselectedUserId) {
      setSelectedUserId(preselectedUserId);
    } else if (clients.length > 0 && !selectedUserId) {
      setSelectedUserId(clients[0]._id);
    }
  }, [preselectedUserId, clients, selectedUserId]);

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
      if (selectedUserId) {
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
        data.msg || "Document uploaded and sent for signature!",
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
                Assign PDF, Word, or Compliance Agreements to client portal
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
          {/* Client Selector (if multiple clients passed) */}
          {clients.length > 0 && !preselectedUserId && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                Assign to Client
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.firstName} {c.lastName} ({c.email})
                  </option>
                ))}
              </select>
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

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={requiresSignature}
              onChange={(e) => setRequiresSignature(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-slate-700">
              Require Client E-Signature on this document
            </span>
          </label>

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
              {uploading ? "Uploading..." : "Upload & Send for Signature"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
