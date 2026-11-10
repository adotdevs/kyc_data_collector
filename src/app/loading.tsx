import React from "react";

export default function GlobalLoading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] pointer-events-none">
      <div className="h-[3px] w-full bg-blue-100 overflow-hidden">
        <div
          className="h-full w-2/3 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400 animate-pulse"
          style={{
            boxShadow: "0 0 12px rgba(37, 99, 235, 0.85)",
          }}
        />
      </div>
    </div>
  );
}

