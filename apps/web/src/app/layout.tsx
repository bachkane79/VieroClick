import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { getLocale } from "@/lib/i18n/server";

// Roboto (static weights — plain Roboto has no variable axis in next/font).
// 400/500/700 loaded; the UI baseline sits at 500 (globals.css body weight).
// font-semibold (600) has no matching face and rounds up to 700 per CSS.
const roboto = Roboto({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VieroClick — AI Project Manager",
  description: "AI-powered project management with autonomous agents",
  icons: {
    icon: [{ url: "/logo_transparent.png", type: "image/png" }],
    shortcut: [{ url: "/logo_transparent.png", type: "image/png" }],
    apple: [{ url: "/logo_transparent.png", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={roboto.variable}>
      <body className={`${roboto.className} min-h-screen antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "rounded-xl border border-border bg-card text-card-foreground shadow-elevated",
            },
          }}
        />
      </body>
    </html>
  );
}
