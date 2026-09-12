import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Check-in · Grok Bot Meetup",
  description: "Recepción y tickets 58mm para el Grok Bot Meetup",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Nav />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:px-6">{children}</main>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
