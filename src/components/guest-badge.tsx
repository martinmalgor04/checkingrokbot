import { Badge } from "@/components/ui/badge";
import type { Guest } from "@/lib/types";

export function GuestBadge({ guest }: { guest: Guest }) {
  if (guest.checkedIn && guest.isWalkIn) {
    return <Badge className="bg-violet-600 text-white hover:bg-violet-600">Walk-in</Badge>;
  }
  if (guest.checkedIn) {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Adentro</Badge>;
  }
  if (guest.cancelledInLuma) {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Cancelado en Luma</Badge>;
  }
  return <Badge variant="outline">Pendiente</Badge>;
}

export function maskEmail(email?: string): string {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, Math.min(4, user.length - 2)))}@${domain}`;
}
