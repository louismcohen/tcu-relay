import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-sm border border-line bg-ink px-3 font-mono text-sm text-paper outline-none placeholder:text-mute focus:border-brass",
        className,
      )}
      {...props}
    />
  );
}
