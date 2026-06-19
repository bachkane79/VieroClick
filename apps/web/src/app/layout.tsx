import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VieroClick — AI Project Manager",
  description: "AI-powered project management with autonomous agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={`${inter.className} min-h-screen antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast:
                "rounded-xl border border-border bg-card text-card-foreground shadow-elevated",
            },
          }}
        />
      </body>
    </html>
  );
}
