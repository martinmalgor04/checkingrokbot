import { cn } from "@/lib/utils";

export function TicketPreview({ text, className }: { text: string; className?: string }) {
  return (
    <pre
      className={cn(
        "w-fit min-w-[19rem] whitespace-pre overflow-x-auto rounded-sm border border-dashed bg-white px-3 py-4 font-mono text-[12px] leading-[1.15rem] text-neutral-900 shadow-sm dark:bg-neutral-100",
        className,
      )}
    >
      {text}
    </pre>
  );
}
