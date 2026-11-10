"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  X,
  PenTool,
  Type,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  FileSignature,
} from "lucide-react";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  defaultSignerName: string;
  defaultSignerEmail: string;
  savedSignature?: string | null;
  onConfirmSign: (payload: {
    signatureDataUrl: string;
    signatureMode: "draw" | "type";
    typedText: string;
    fontFamily: string;
    signerName: string;
    signerTitle: string;
    saveForFuture: boolean;
  }) => Promise<void>;
}

const PEN_COLORS = [
  { name: "Royal Blue", value: "#1d4ed8" },
  { name: "Midnight Ink", value: "#0f172a" },
  { name: "Deep Navy", value: "#1e3a8a" },
];

const SIGNATURE_FONTS = [
  {
    id: "Dancing Script",
    label: "Executive Script",
    className: "font-sig-dancing",
  },
  {
    id: "Great Vibes",
    label: "Classic Calligraphy",
    className: "font-sig-vibes",
  },
  {
    id: "Alex Brush",
    label: "Modern Cursive",
    className: "font-sig-alex",
  },
];

export default function SignatureModal({
  isOpen,
  onClose,
  documentTitle,
  defaultSignerName,
  defaultSignerEmail,
  savedSignature,
  onConfirmSign,
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [penColor, setPenColor] = useState("#1d4ed8");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);

  const [typedText, setTypedText] = useState(defaultSignerName || "");
  const [selectedFont, setSelectedFont] = useState("Dancing Script");
  const [signerName, setSignerName] = useState(defaultSignerName || "");
  const [signerTitle, setSignerTitle] = useState("");
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (defaultSignerName) {
      setSignerName(defaultSignerName);
      setTypedText(defaultSignerName);
    }
  }, [defaultSignerName]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 2;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 520) * dpr;
    canvas.height = (rect.height || 200) * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = penColor;
  }, [penColor]);

  useEffect(() => {
    if (isOpen && mode === "draw") {
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode, initCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = penColor;
    }
  }, [penColor]);

  if (!isOpen) return null;

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawnStroke(true);
    setErrorMsg("");
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.closePath();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnStroke(false);
  };

  const loadSavedSignatureToCanvas = () => {
    if (!savedSignature || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 40, 20, rect.width - 80, rect.height - 40);
      setHasDrawnStroke(true);
    };
    img.src = savedSignature;
  };

  const renderTypedSignatureToDataUrl = (text: string, font: string, color: string) => {
    const offscreen = document.createElement("canvas");
    offscreen.width = 640;
    offscreen.height = 200;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return "";
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.fillStyle = color;
    ctx.font = `italic 64px "${font}", "Brush Script MT", cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, offscreen.width / 2, offscreen.height / 2);
    return offscreen.toDataURL("image/png");
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!signerName.trim()) {
      setErrorMsg("Please enter your full legal name.");
      return;
    }

    if (!agreedToTerms) {
      setErrorMsg("Please confirm the electronic signature consent checkbox.");
      return;
    }

    let finalDataUrl = "";
    if (mode === "draw") {
      if (!hasDrawnStroke || !canvasRef.current) {
        setErrorMsg("Please draw your signature in the signature pad above.");
        return;
      }
      finalDataUrl = canvasRef.current.toDataURL("image/png");
    } else {
      if (!typedText.trim()) {
        setErrorMsg("Please type your signature name.");
        return;
      }
      finalDataUrl = renderTypedSignatureToDataUrl(
        typedText.trim(),
        selectedFont,
        penColor
      );
    }

    try {
      setSubmitting(true);
      await onConfirmSign({
        signatureDataUrl: finalDataUrl,
        signatureMode: mode,
        typedText: typedText.trim(),
        fontFamily: selectedFont,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        saveForFuture,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to execute signature");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">
                Sign Document Online
              </h3>
              <p className="text-xs text-blue-100 truncate max-w-xs sm:max-w-sm">
                {documentTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          {/* Mode Switcher Tabs + Color Picker */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("draw")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  mode === "draw"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setMode("type")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  mode === "type"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                Type Signature
              </button>
            </div>

            {/* Pen Color Choice */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Ink:</span>
              {PEN_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  onClick={() => setPenColor(c.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    penColor === c.value
                      ? "border-blue-500 scale-110 ring-2 ring-blue-200"
                      : "border-white shadow-sm"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Signature Pad or Type Area */}
          {mode === "draw" ? (
            <div className="space-y-2">
              <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 overflow-hidden hover:border-blue-400 transition-colors">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 cursor-crosshair touch-none block"
                />

                {/* Baseline guide */}
                <div className="pointer-events-none absolute bottom-9 left-8 right-8 border-b border-slate-300/90 flex items-end justify-between pb-1">
                  <span className="text-[11px] font-serif italic text-slate-400">
                    Sign here ×
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    eIDAS / ESIGN Compliant Pad
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Use your mouse, trackpad, or finger to sign smoothly.
                </span>
                <div className="flex items-center gap-3">
                  {savedSignature && (
                    <button
                      type="button"
                      onClick={loadSavedSignatureToCanvas}
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Use Saved Signature
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-rose-600"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear Pad
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Type Your Signature Text
                </label>
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder="Olivia Laurent"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SIGNATURE_FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFont(f.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedFont === f.id
                        ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      {f.label}
                    </div>
                    <div
                      className={`text-2xl truncate py-1 ${f.className}`}
                      style={{ color: penColor }}
                    >
                      {typedText || "Olivia Laurent"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Signer Full Name & Optional Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Title / Role (Optional)
              </label>
              <input
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="e.g., Client / Director"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Legal Consent & Save Checkbox */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                I agree that my electronic signature above is the legal equivalent of my manual handwritten signature on{" "}
                <strong className="text-slate-800">{documentTitle}</strong> ({defaultSignerEmail}).
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={saveForFuture}
                onChange={(e) => setSaveForFuture(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600">
                Save this signature to my profile for 1-click signing on future documents
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>256-bit Audit Trail Certified</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm shadow-blue-600/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? "Applying Signature..." : "Adopt & Sign Document"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
