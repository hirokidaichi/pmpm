import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "pmpm server console",
  description: "CLI-first project management server UI"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.variable} ${unbounded.variable} font-sans`}>
        <div className="relative min-h-screen overflow-hidden bg-navy-950">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="pointer-events-none absolute -top-40 left-10 h-96 w-96 rounded-full bg-teal-500/20 blur-[120px] animate-float-slow" />
          <div className="pointer-events-none absolute right-0 top-20 h-[420px] w-[420px] rounded-full bg-white/10 blur-[140px]" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-teal-400/10 blur-[120px]" />
          <div className="relative z-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
