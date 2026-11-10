import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import TopProgressBar from "@/components/TopProgressBar";

export const metadata: Metadata = {
  title: "GOin SAS — Crypto investing, held securely",
  description:
  "Institutional safekeeping, execution, digital asset recovery, and discretionary portfolio management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <body className="min-h-screen antialiased selection:bg-blue-600 selection:text-white">
          <TopProgressBar />
          <AuthProvider>{children}</AuthProvider>
        </body>
    </html>
  );
}

