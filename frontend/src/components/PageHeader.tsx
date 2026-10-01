import type { ReactNode } from "react";

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-ink-soft">{desc}</p>}
      </div>
      {action}
    </div>
  );
}
