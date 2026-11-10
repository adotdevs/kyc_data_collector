"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function triggerTopProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("signdocs:progress-start"));
  }
}

function TopProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const visibleRef = useRef(false);
  const progressRef = useRef(0);
  const activeFetchesRef = useRef(0);
  const isRoutePendingRef = useRef(false);

  const trickleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevRouteKeyRef = useRef<string>("");

  const updateProgress = (val: number) => {
    progressRef.current = val;
    setProgress(val);
  };

  const updateVisible = (val: boolean) => {
    visibleRef.current = val;
    setVisible(val);
  };

  const clearAllTimers = () => {
    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  };

  const startLoader = () => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }

    if (!visibleRef.current) {
      updateVisible(true);
      updateProgress(22);
    } else if (progressRef.current >= 92 || progressRef.current < 20) {
      updateProgress(28);
    }

    if (!trickleTimerRef.current) {
      trickleTimerRef.current = setInterval(() => {
        const current = progressRef.current;
        if (current >= 90) return;
        const step =
          current < 45 ? 12 : current < 70 ? 6 : current < 85 ? 2.5 : 0.8;
        updateProgress(Math.min(90, current + step));
      }, 140);
    }

    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => {
      isRoutePendingRef.current = false;
      activeFetchesRef.current = 0;
      completeLoader();
    }, 12000);
  };

  const completeLoader = () => {
    // Only finish if no route navigation is pending AND no fetch calls are in flight
    if (isRoutePendingRef.current || activeFetchesRef.current > 0) {
      return;
    }
    if (!visibleRef.current) return;

    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    updateProgress(100);

    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    finishTimerRef.current = setTimeout(() => {
      updateVisible(false);
      setTimeout(() => {
        if (!visibleRef.current) {
          updateProgress(0);
        }
      }, 180);
    }, 260);
  };

  // Detect route completion when pathname or searchParams changes
  useEffect(() => {
    const currentKey = `${pathname}?${searchParams?.toString() || ""}`;
    if (prevRouteKeyRef.current && prevRouteKeyRef.current !== currentKey) {
      isRoutePendingRef.current = false;
      // Allow a brief 120ms window for the new page's initial fetch() calls to register
      setTimeout(() => {
        completeLoader();
      }, 120);
    }
    prevRouteKeyRef.current = currentKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Global event listeners: Link clicks + window.fetch interceptor + custom events
  useEffect(() => {
    // 1. Intercept internal <a> clicks immediately on click
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");
      if (
        !href ||
        targetAttr === "_blank" ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        anchor.hasAttribute("download") ||
        href.includes("/download")
      ) {
        return;
      }

      try {
        const targetUrl = new URL(href, window.location.origin);
        if (targetUrl.origin !== window.location.origin) return;

        const currentFull =
          window.location.pathname + window.location.search;
        const targetFull = targetUrl.pathname + targetUrl.search;

        if (currentFull !== targetFull) {
          isRoutePendingRef.current = true;
          startLoader();
        } else {
          // Clicking link to current page: give a quick visual feedback pulse
          startLoader();
          setTimeout(() => {
            completeLoader();
          }, 250);
        }
      } catch {
        // ignore invalid URL
      }
    };

    // 2. Intercept all window.fetch requests so every API call shows the top loader
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      activeFetchesRef.current += 1;
      startLoader();
      try {
        return await originalFetch.apply(this, args);
      } finally {
        activeFetchesRef.current = Math.max(0, activeFetchesRef.current - 1);
        setTimeout(() => {
          completeLoader();
        }, 80);
      }
    };

    // 3. Custom manual trigger for in-page tab switches
    const handleManualTrigger = () => {
      startLoader();
      setTimeout(() => {
        completeLoader();
      }, 280);
    };

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("signdocs:progress-start", handleManualTrigger);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener(
        "signdocs:progress-start",
        handleManualTrigger
      );
      window.fetch = originalFetch;
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      {/* Top Glowing Line */}
      <div className="h-[3.5px] w-full bg-blue-100/50 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-150 ease-out relative"
          style={{
            width: `${progress}%`,
            opacity: visible ? 1 : 0,
            boxShadow:
              "0 0 14px rgba(37, 99, 235, 0.9), 0 0 5px rgba(59, 130, 246, 0.95)",
          }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-r from-transparent to-white/80" />
        </div>
      </div>

      {/* Top-Right Activity Spinner Pill */}
      {visible && progress < 100 && (
        <div className="fixed top-3.5 right-4 z-[9999] flex items-center gap-2 px-3 py-1 rounded-full bg-white/95 border border-blue-200 shadow-md backdrop-blur-md">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span className="text-[11px] font-bold text-blue-700 tracking-tight">
            Loading...
          </span>
        </div>
      )}
    </div>
  );
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  );
}
