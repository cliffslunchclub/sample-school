import { Utensils } from "lucide-react";

export function Brand({ size = "md", light = false }: { size?: "sm" | "md" | "lg"; light?: boolean }) {
  const dims = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const title = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex ${dims} items-center justify-center rounded-xl bg-leaf-600 text-white shadow-sm`}>
        <Utensils className={icon} strokeWidth={2.5} />
      </div>
      <div className="leading-none">
        <span className={`block font-extrabold tracking-tight ${title} ${light ? "text-white" : "text-ink"}`}>
          {import.meta.env.VITE_BRAND_NAME || "Cliffs Lunch Club"}
        </span>
      </div>
    </div>
  );
}
