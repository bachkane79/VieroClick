import { useTranslations } from "next-intl";
import { Container, CtaDark, CtaGhost } from "./landing-ui";
import { HeroAppMock } from "./mocks/hero-app-mock";

/**
 * Hero — copy column left, product mock cropped by the right viewport edge.
 *
 * The crop is load-bearing, not decoration: a mock that fits inside the
 * container reads as a screenshot, one that runs off the edge reads as a
 * window onto a running app. It is achieved by absolutely positioning the mock
 * from the container's left edge at a fixed width wider than the space left
 * over, so the viewport does the cutting. Below `lg` there is no room for that,
 * so the mock returns to the flow and is cropped by its own wrapper instead.
 *
 * The copy is four elements and stops there. It previously ran badge → heading
 * → three checkmark bullets → CTA → split fine print → a stat label → twelve
 * feature chips, which is a table of contents, not an argument: the chips
 * restated the nav, the bullets restated `lead`, and both are covered in depth
 * by the Solutions and Agents sections below. `lead` says the same thing in one
 * sentence and ends on the payoff, so it carries the section alone.
 *
 * No `Reveal` here on purpose. Every block in this section is above the fold,
 * where `Reveal` bails out before it animates anything — the wrappers were
 * shipping an IntersectionObserver per block to do nothing. Below-the-fold
 * sections still use it.
 */
export function LandingHero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative overflow-hidden bg-canvas pb-12 pt-28 lg:pb-0 lg:pt-32">
      {/* Warm bloom behind the product — Grainient "Spectral Gradient (Lights)".
          Source art is 3840×2400 / 7.3 MB; what ships is a cropped, mirrored,
          1200px re-encode at 75 KB (AVIF, with a 131 KB WebP fallback). Format
          negotiation lives in the `.bg-hero-gradient` utility in `globals.css`.

          Three things were done to the source and each is load-bearing:
          · mirrored, because the art runs bloom-left → light-right and this hero
            needs the reverse — clean canvas under the copy, warmth around the mock;
          · cropped off the top 700px, which removes a blue corner that reads as
            a second, off-brand accent next to `--primary` orange;
          · masked from the left, which is what disposes of the dark brown band
            the art carries at that edge. Do not remove the mask to "show more of
            the gradient" — it is the only thing keeping that band off the copy,
            and it is also what protects text contrast.

          No `feTurbulence` layer any more: this asset carries its own grain, and
          stacking ours on top double-grained it. `globals.css` keeps app
          *surfaces* flat on purpose; this is marketing chrome behind the
          content, the same latitude the agents section already takes.

          Sizing is `inset-0`, never a fixed height, and the vertical fade must
          finish inside the section. A fixed `h-[820px]` in a ~748px section put
          the fade's tail *past* the section's `overflow-hidden` boundary, so it
          was clipped mid-ramp at ~65% opacity and drew a hard colour edge
          straight across the page above the logos strip. Tying the layer to the
          section and landing `transparent` at 78% keeps the last ~20% of the
          hero clean canvas, so it meets the next section on the same colour
          instead of ending on a seam. */}
      <div
        aria-hidden
        className="bg-hero-gradient pointer-events-none absolute inset-0 bg-cover bg-top bg-no-repeat opacity-[0.48] dark:opacity-40"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 38%, #000 62%), linear-gradient(to bottom, #000 30%, transparent 78%)",
          maskComposite: "intersect",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 38%, #000 62%), linear-gradient(to bottom, #000 30%, transparent 78%)",
          WebkitMaskComposite: "source-in",
        }}
      />

      <Container className="relative">
        <div className="relative lg:flex lg:min-h-[620px] lg:items-center">
          {/* Copy column. Capped well short of the mock so the two never meet.
              Centered against the mock's full height at `lg` — the mock is the
              tall element here, so aligning to its optical middle is what keeps
              the short copy from stranding itself at the top of the band. */}
          <div className="relative z-10 max-w-[600px] pb-14 lg:pb-0">
            <h1 className="text-balance text-[38px] font-bold leading-[1.06] tracking-[-0.03em] text-foreground sm:text-[46px] lg:text-[52px]">
              <span className="block">{t("titleBefore")}</span>
              <span className="block">
                <span className="text-primary">{t("titleAccent")}</span> {t("titleAfter")}
              </span>
            </h1>

            <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.6] text-muted-foreground">
              {t("lead")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <CtaDark href="/register">{t("ctaPrimary")}</CtaDark>
              <CtaGhost href="#views">{t("ctaSecondary")}</CtaGhost>
            </div>

            <p className="mt-5 text-[13px] text-text-secondary">
              {t("finePrint1")} · {t("finePrint2")}
            </p>
          </div>

          {/* Mock: absolute and overwide at `lg` so the viewport crops its right
              side; an in-flow, self-cropping block below that. */}
          <div className="relative -mx-4 overflow-hidden pl-4 md:-mx-6 md:pl-6 lg:absolute lg:inset-y-0 lg:left-[636px] lg:mx-0 lg:overflow-visible lg:pl-0">
            <HeroAppMock className="w-[1020px] shadow-[0_18px_40px_-12px_rgba(16,20,32,0.14),0_60px_100px_-40px_rgba(16,20,32,0.22)] lg:mt-6" />

            {/* Only the `lg` crop needs this. The section's bottom edge slices
                the mock mid-row, which reads as a rendering bug; dissolving the
                last 7rem into the canvas turns the same cut into the app
                continuing past the fold. LandingLogos below is `bg-canvas` too,
                so the seam is invisible.

                Written as an explicit gradient rather than `from-canvas/0`:
                the theme defines `canvas: "hsl(var(--canvas))"` with no
                `<alpha-value>` placeholder, so Tailwind cannot thread an
                opacity modifier through it and the utility would resolve to
                opaque canvas — a solid grey band across the mock instead of a
                fade. Ramping the var's own alpha also keeps the midpoint in the
                canvas hue rather than running it through grey the way
                `transparent` does. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-28 bg-[linear-gradient(to_bottom,hsl(var(--canvas)/0),hsl(var(--canvas)))] lg:block"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
