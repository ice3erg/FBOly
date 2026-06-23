import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline" | "destructive";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        variant === "default" &&
          "border-primary/30 bg-primary/20 text-purple-100",
        variant === "secondary" &&
          "border-secondary/30 bg-secondary/20 text-purple-100",
        variant === "outline" && "border-white/10 bg-white/[0.04] text-muted-foreground",
        variant === "destructive" &&
          "border-transparent bg-destructive text-destructive-foreground",
        className,
      )}
      {...props}
    />
  );
}
