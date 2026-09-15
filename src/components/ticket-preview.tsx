import { cn } from "@/lib/utils";

export function TicketPreview({ text, className }: { text: string; className?: string }) {
  const body = text.replace(/\n?\[logo grokbot\]\n?/g, "\n");
  return (
    <div
      className={cn(
        "w-fit min-w-[19rem] overflow-x-auto rounded-sm border border-dashed bg-white px-3 py-4 text-neutral-900 shadow-sm dark:bg-neutral-100",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/grokbot-logo.png" alt="Grok Bot" className="mx-auto mb-3 h-8 w-auto" />
      <pre className="whitespace-pre font-mono text-[12px] leading-[1.15rem]">{body}</pre>
    </div>
  );
}
