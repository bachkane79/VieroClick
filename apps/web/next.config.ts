import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// WP-C5 — Content-Security-Policy. Next's App Router injects inline bootstrap
// scripts and styles (no nonce pipeline here), so script/style keep
// 'unsafe-inline'; dev additionally needs 'unsafe-eval' + ws: for HMR. Everything
// else is locked to 'self' plus the avatar CDNs already allowed for <img>.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://avatars.githubusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS only meaningful over HTTPS; browsers ignore it on plain-http dev.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // ─── Compiler ────────────────────────────────────────────────────────────
  // SWC minifier is on by default in Next 15, but we also want to remove
  // console.log in production while keeping errors/warns.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // ─── Experimental ────────────────────────────────────────────────────────
  experimental: {
    serverActions: {
      allowedOrigins: ["click.vieroc.com", "localhost:1988", "localhost:3000", "localhost:3001"],
    },
    // Optimise barrel-file imports: prevents Next from bundling the entire
    // Lucide/Radix/UI package when only a few icons/components are used.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },

  // ─── Images ──────────────────────────────────────────────────────────────
  images: {
    // Prefer AVIF → WebP → original for best compression ratio
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
