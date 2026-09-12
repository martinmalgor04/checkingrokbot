import { CheckinScreen } from "@/components/checkin-screen";
import { getConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function CheckinPage() {
  const config = getConfig();
  return <CheckinScreen config={config} />;
}
