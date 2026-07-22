import { PersonalSettingsNav } from "./settings-nav";

export default function PersonalSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <PersonalSettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
