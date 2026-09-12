import { GuestsScreen } from "@/components/guests-screen";
import { getConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function GuestsPage() {
  return <GuestsScreen timeZone={getConfig().timeZone} />;
}
