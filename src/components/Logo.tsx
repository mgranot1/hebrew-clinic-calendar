import { cn } from "@/lib/utils";

/** Etti wordmark – serif bronze type echoing the clinic's business card. */
export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center leading-none", className)}>
      <span dir="ltr" className="font-display text-5xl tracking-tight text-bronze">
        etti
      </span>
      {subtitle && <span className="mt-1 text-xs tracking-wide opacity-80">קליניקה לאסתטיקה מתקדמת</span>}
    </div>
  );
}
