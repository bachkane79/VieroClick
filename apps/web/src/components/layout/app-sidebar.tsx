"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";

interface Props {
  user: User;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
];

export function AppSidebar({ user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col h-full shrink-0">
      <div className="px-4 py-4 border-b">
        <span className="font-bold text-lg">VieroClick</span>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t">
        <div className="flex items-center gap-2 mb-2">
          {user.image && (
            <img src={user.image} alt="" className="w-7 h-7 rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-left px-1"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
