import type { ReactNode } from "react";

import {
  getCueColorClasses,
  getCueComponentOrder,
  getCueMixedColorStyle,
} from "@/lib/cue-presentation";
import type { CueComponentType, CueType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CueTypeBadgeProps {
  type: CueType;
  includedTypes?: readonly CueComponentType[];
  className?: string;
  children: ReactNode;
}

export function CueTypeBadge({
  type,
  includedTypes,
  className,
  children,
}: CueTypeBadgeProps) {
  const mixedStyle = getCueMixedColorStyle(type, includedTypes);
  const orderedTypes = mixedStyle ? getCueComponentOrder(includedTypes) : [];
  const mixedLabel = orderedTypes.length > 0
    ? `${typeof children === "string" ? children : type}, señales: ${orderedTypes.join(" + ")}`
    : undefined;

  return (
    <span
      role={mixedLabel ? "img" : undefined}
      aria-label={mixedLabel}
      title={mixedLabel}
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        getCueColorClasses(type),
        mixedStyle && "border-white/70",
        className,
      )}
      style={mixedStyle}
    >
      {children}
    </span>
  );
}
