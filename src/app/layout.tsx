import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "SalesAI Pro — AI-Powered Sales Agent Platform",
  description: "Automate your sales with AI. WhatsApp integration, lead qualification, order management, and intelligent customer follow-up.",
  keywords: "AI sales agent, WhatsApp automation, sales CRM, lead qualification, customer management",
  openGraph: {
    title: "SalesAI Pro — AI-Powered Sales Agent Platform",
    description: "Automate your sales with AI on WhatsApp",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "rgb(22, 27, 42)",
              color: "rgb(248, 250, 252)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "500",
            },
            success: {
              iconTheme: { primary: "#22c55e", secondary: "white" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "white" },
            },
          }}
        />
      </body>
    </html>
  );
}
