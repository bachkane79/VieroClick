import { getTranslations } from "next-intl/server";
import { Preferences } from "./preferences";

export default async function PersonalPreferencesPage() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.personal.prefTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.personal.prefSubtitle")}</p>
      </header>
      <Preferences />
    </div>
  );
}
