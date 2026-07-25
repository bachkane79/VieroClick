"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@vieroc/ui";
import { useTranslations } from "next-intl";
import {
  SlidersHorizontal,
  Users,
  UsersRound,
  ShieldCheck,
  Plug,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** exact match instead of prefix (used for the index route) */
  exact?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

/**
 * The "All settings" secondary sidebar, modelled on ClickUp's grouped settings
 * rail (Admin / Features / … ). Each entry is a sub-route under
 * /workspace/[slug]/settings. Active state is derived from the pathname so the
 * whole thing stays a thin client shell around server-rendered pages.
 */
export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const t = useTranslations();
  const base = `/workspace/${slug}/settings`;

  const groups: NavGroup[] = [
    {
      title: t("settings.workspace.groupGeneral"),
      items: [
        {
          href: base,
          label: t("settings.workspace.overview"),
          desc: t("settings.workspace.overviewDesc"),
          icon: SlidersHorizontal,
          exact: true,
        },
      ],
    },
    {
      title: t("settings.workspace.groupAdmin"),
      items: [
        {
          href: `${base}/members`,
          label: t("settings.workspace.members"),
          desc: t("settings.workspace.membersDesc"),
          icon: Users,
        },
        {
          href: `${base}/teams`,
          label: t("settings.workspace.teams"),
          desc: t("settings.workspace.teamsDesc"),
          icon: UsersRound,
        },
        {
          href: `${base}/roles`,
          label: t("settings.workspace.roles"),
          desc: t("settings.workspace.rolesDesc"),
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: t("settings.workspace.groupIntegrations"),
      items: [
        {
          href: `${base}/integrations`,
          label: t("settings.workspace.integrations"),
          desc: t("settings.workspace.integrationsDesc"),
          icon: Plug,
        },
      ],
    },
  ];

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <nav aria-label={t("settings.workspace.navAria")} className="w-full shrink-0 md:w-60">
      <div className="mb-4 px-2">
        <h2 className="text-base font-semibold tracking-tight">{t("common.settings")}</h2>
        <p className="text-xs text-muted-foreground">{t("settings.workspace.subheading")}</p>
      </div>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
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
                        "flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block leading-tight">{item.label}</span>
                        <span className="block text-[11px] leading-tight text-muted-foreground">
                          {item.desc}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
