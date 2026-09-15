"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Check-in" },
  { href: "/import", label: "Importar" },
  { href: "/guests", label: "Lista" },
  { href: "/settings", label: "Ajustes" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/grokbot-logo.png" alt="Grok Bot" className="h-7 w-auto dark:invert" />
          <span className="hidden sm:inline text-sm font-medium text-muted-foreground">Meetup · Recepción</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-muted",
                  active ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
