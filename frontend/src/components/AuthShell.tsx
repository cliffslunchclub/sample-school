import type { ReactNode } from "react";
import { Brand } from "./Brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        {/* Decorative backdrop */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-leaf-100 blur-3xl opacity-60" />
          <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sun-100 blur-3xl opacity-50" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <Brand size="lg" />
          </div>
          <div className="animate-fade-in-up rounded-2xl border border-line bg-surface p-6 shadow-[0_6px_30px_rgba(16,40,28,0.06)] sm:p-8">
            <h1 className="text-center text-2xl font-extrabold text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-center text-sm text-ink-soft">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
