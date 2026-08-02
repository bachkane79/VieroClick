import { useTranslations } from "next-intl";
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingPricing } from "./landing-pricing";
import { LandingFooter } from "./landing-footer";
import { LandingAgentsDark } from "./landing-agents";
import { LandingAiControl } from "./landing-ai-control";
import { LandingLogos, LandingProblem } from "./landing-sections";
import { LandingSolutions } from "./landing-solutions";
import { LandingFaq } from "./landing-faq";
import { LandingCta } from "./landing-proof";

/**
 * The public marketing page, served at `/` to signed-out visitors.
 *
 * Section order follows one continuous argument: promise → the manager's
 * problem → the lifecycle that resolves it → human control over AI → the
 * team fit → price → common questions → one last ask.
 */
export function LandingPage() {
  const t = useTranslations("landing.nav");

  return (
    <div className="landing-theme min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>

      <LandingNav />

      <main id="main">
        <LandingHero />
        <LandingLogos />
        <LandingProblem />
        <LandingAgentsDark />
        <LandingAiControl />
        <LandingSolutions />
        <LandingPricing />
        <LandingFaq />
        <LandingCta />
      </main>

      <LandingFooter />
    </div>
  );
}
