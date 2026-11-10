"use client";

import React from "react";

interface FileTypeIconProps {
  type?: "pdf" | "doc" | "image" | string;
  fileName?: string;
  size?: "sm" | "md" | "lg";
}

export default function FileTypeIcon({
  type = "pdf",
  fileName = "",
  size = "md",
}: FileTypeIconProps) {
  const lower = (fileName || "").toLowerCase();
  const resolvedType =
    type === "doc" || lower.endsWith(".doc") || lower.endsWith(".docx")
      ? "doc"
      : type === "image" ||
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg")
      ? "image"
      : "pdf";

  const dimensions =
    size === "sm"
      ? "w-9 h-11"
      : size === "lg"
      ? "w-16 h-20"
      : "w-12 h-14";

  const badgeTextSize =
    size === "sm"
      ? "text-[9px] py-0.5"
      : size === "lg"
      ? "text-xs py-1"
      : "text-[10px] py-0.5";

  const theme =
    resolvedType === "doc"
      ? {
          border: "border-blue-200",
          bg: "bg-blue-50/70",
          fold: "bg-blue-200",
          badge: "bg-blue-600 text-white",
          lines: "bg-blue-300",
          label: "DOC",
        }
      : resolvedType === "image"
      ? {
          border: "border-emerald-200",
          bg: "bg-emerald-50/70",
          fold: "bg-emerald-200",
          badge: "bg-emerald-600 text-white",
          lines: "bg-emerald-300",
          label: "IMG",
        }
      : {
          border: "border-red-200",
          bg: "bg-red-50/70",
          fold: "bg-red-200",
          badge: "bg-red-500 text-white",
          lines: "bg-red-300",
          label: "PDF",
        };

  return (
    <div
      className={`relative ${dimensions} rounded-lg border ${theme.border} ${theme.bg} flex flex-col justify-between p-1.5 select-none shadow-sm`}
    >
      {/* Folded top-right corner accent */}
      <div
        className={`absolute top-0 right-0 w-3 h-3 ${theme.fold} rounded-bl-md`}
        style={{
          clipPath: "polygon(0 0, 0% 100%, 100% 100%)",
        }}
      />

      {/* Decorative miniature document lines */}
      <div className="space-y-1 mt-1.5 px-1">
        <div className={`h-0.5 w-3/5 rounded-full ${theme.lines}`} />
        <div className={`h-0.5 w-4/5 rounded-full ${theme.lines}`} />
      </div>

      {/* Crisp Pill Label (PDF / DOC / IMG) */}
      <div
        className={`w-full rounded ${theme.badge} ${badgeTextSize} font-bold tracking-wider text-center leading-none shadow-sm`}
      >
        {theme.label}
      </div>
    </div>
  );
}
