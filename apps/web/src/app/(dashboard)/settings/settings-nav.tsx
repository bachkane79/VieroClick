"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@vieroc/ui";
import { useLocale } from "@/lib/i18n/client";
import { UserCircle, SlidersHorizontal, type LucideIcon } from "lucide-react";

type NavItem = { href: string; icon: LucideIcon; label: { vi: string; en: string }; exact?: boolean };
type NavGroup = { title: { vi: string; en: string }; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: { vi: "Tài khoản", en: "Account" },
    items: [
      { href: "/settings", icon: SlidersHorizontal, label: { vi: "Tùy chọn", en: "Preferences" }, exact: true },
      { href: "/profile", icon: UserCircle, label: { vi: "Hồ sơ", en: "Profile" } },
    ],
  },
];

/** Personal (account-level) settings rail — the counterpart to the workspace
 * "All settings" nav, reached from the user menu. */
export function PersonalSettingsNav() {
  const pathname = usePathname();
  const locale = useLocale();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <nav aria-label={locale === "vi" ? "Cài đặt cá nhân" : "Personal settings"} className="w-full shrink-0 md:w-56">
      <div className="mb-4 px-2">
        <h2 className="text-base font-semibold tracking-tight">
          {locale === "vi" ? "Cài đặt" : "Settings"}
        </h2>
        <p className="text-xs text-muted-foreground">{locale === "vi" ? "Tài khoản của bạn" : "Your account"}</p>
      </div>
      {GROUPS.map((group) => (
        <div key={group.title.en} className="mb-5">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title[locale]}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    {item.label[locale]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
