import { Preferences } from "./preferences";

export default function PersonalPreferencesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tùy chọn</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ngôn ngữ và giao diện của bạn.</p>
      </header>
      <Preferences />
    </div>
  );
}
