import type { ComponentProps } from "react";
import { cn, humanize } from "@/lib/utils";
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("badge", className)} {...props} />;
}
export function StatusBadge({ status }: { status: string }) {
  const tone = ["confirmed", "approved", "refunded"].includes(status)
    ? "badge-success"
    : ["rejected"].includes(status)
      ? "badge-red"
      : "badge-amber";
  return <Badge className={tone}>{humanize(status)}</Badge>;
}
