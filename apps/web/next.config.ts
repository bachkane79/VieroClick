import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
      allowedOrigins: ["localhost:3000", "localhost:3001"],
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
