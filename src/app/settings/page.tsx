import { SettingsScreen } from "@/components/settings-screen";
import { getConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsScreen initial={getConfig()} />;
}
