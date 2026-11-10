import React from "react";

interface GoinLogoProps {
  className?: string;
  theme?: "light" | "dark" | "auto";
  height?: number;
  width?: number;
}

export default function GoinLogo({
  className = "",
  theme = "light",
  height = 36,
  width = 144,
}: GoinLogoProps) {
  // If theme is 'dark', text is white/light. If 'light', text is navy/dark slate.
  const isDark = theme === "dark";
  const textColor = isDark ? "#F5F8FD" : "#0C1A2E";
  const sasColor = isDark ? "#9CCBFA" : "#2563EB";
  const dividerColor = isDark ? "#2D8FEA" : "#93C5FD";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 176 44"
      role="img"
      aria-label="GOin SAS"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block", flex: "none" }}
    >
      <text
        x="1"
        y="32"
        fill={textColor}
        fontFamily="Sora, Manrope, Arial, sans-serif"
        fontSize="29"
        fontWeight="700"
        letterSpacing="-1.8"
      >
        GO
      </text>
      <g
        fill="none"
        stroke="#159BFA"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M66 13 C72 13 72 22 78 22 C84 22 84 31 90 31" />
        <path d="M66 31 C72 31 72 22 78 22" />
      </g>
      <g fill="#159BFA">
        <circle cx="66" cy="13" r="5.2" />
        <circle cx="66" cy="31" r="5.2" />
        <circle cx="90" cy="31" r="5.2" />
      </g>
      <text
        x="96"
        y="32"
        fill={textColor}
        fontFamily="Sora, Manrope, Arial, sans-serif"
        fontSize="29"
        fontWeight="700"
        letterSpacing="-1.8"
      >
        in
      </text>
      <path d="M126 8 V36" stroke={dividerColor} strokeWidth="1.5" />
      <text
        x="136"
        y="29"
        fill={sasColor}
        fontFamily="Manrope, Arial, sans-serif"
        fontSize="16"
        fontWeight="700"
        letterSpacing="2"
      >
        SAS
      </text>
    </svg>
  );
}

