import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Facebook, Linkedin, Twitter, Youtube } from "lucide-react";
import { Container } from "./landing-ui";

const COLUMNS = [
  {
    title: "productTitle",
    links: [
      "productFeatures",
      "productAgents",
      "productIntegrations",
      "productPricing",
      "productChangelog",
    ],
  },
  {
    title: "solutionsTitle",
    links: ["solutionsSoftware", "solutionsMarketing", "solutionsAgency", "solutionsCustomers"],
  },
  {
    title: "resourcesTitle",
    links: [
      "resourcesDocs",
      "resourcesApi",
      "resourcesBlog",
      "resourcesCommunity",
      "resourcesSupport",
    ],
  },
  {
    title: "companyTitle",
    links: ["companyAbout", "companyCareers", "companyPartners", "companyContact"],
  },
] as const;

const SOCIAL = [
  { Icon: Facebook, label: "Facebook" },
  { Icon: Linkedin, label: "LinkedIn" },
  { Icon: Youtube, label: "YouTube" },
  { Icon: Twitter, label: "X" },
] as const;

export function LandingFooter() {
  const t = useTranslations("landing.footer");

  return (
    <footer className="border-t border-border bg-[hsl(var(--landing-card))] py-14">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="min-w-0">
            <Link href="/" className="flex min-h-[44px] items-center gap-2.5">
              <Image
                src="/logo_transparent.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="text-lg font-bold tracking-tight text-foreground">
                Viero<span className="text-primary">Click</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[38ch] text-xs font-normal leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
            <ul className="mt-5 flex gap-2">
              {SOCIAL.map(({ Icon, label }) => (
                <li key={label}>
                  <Link
                    href="#"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={t(col.title)} className="min-w-0">
              <h2 className="text-xs font-bold text-foreground">{t(col.title)}</h2>
              {/* Touch targets: 40px rows with no gap below `md`, reverting to
                  the compact 16px/10px rhythm once there is a pointer. */}
              <ul className="mt-2 space-y-0 md:mt-4 md:space-y-2.5">
                {col.links.map((k) => (
                  <li key={k}>
                    <Link
                      href="#"
                      className="flex min-h-[40px] items-center text-xs font-normal text-muted-foreground transition-colors hover:text-primary md:min-h-0"
                    >
                      {t(k)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">{t("copyright")}</p>
          <ul className="flex gap-6">
            {(["terms", "privacy", "cookie"] as const).map((k) => (
              <li key={k}>
                <Link
                  href="#"
                  className="flex min-h-[40px] items-center text-xs text-muted-foreground transition-colors hover:text-primary md:min-h-0"
                >
                  {t(k)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
