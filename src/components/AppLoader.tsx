"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLoaderProps {
  message?: string;
  className?: string;
}

export default function AppLoader({ message = "読み込み中...", className }: AppLoaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-4",
        className
      )}
    >
      <Loader2 className="h-12 w-12 text-agrix-forest animate-spin" aria-hidden />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
