import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm shadow-slate-950/20",
        className,
      )}
    />
  );
}
