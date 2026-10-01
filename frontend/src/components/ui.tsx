import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { X, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-leaf-600 text-white hover:bg-leaf-700 focus-visible:ring-leaf-600/40 shadow-sm",
  accent:
    "bg-tomato-500 text-white hover:bg-tomato-600 focus-visible:ring-tomato-500/40 shadow-sm",
  outline:
    "bg-white text-ink border border-line hover:border-leaf-400 hover:bg-leaf-50 focus-visible:ring-leaf-400/30",
  ghost: "bg-transparent text-ink-soft hover:bg-leaf-50 hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90 focus-visible:ring-danger/40",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-[15px] rounded-xl gap-2",
  lg: "h-13 px-6 text-base rounded-xl gap-2 py-3",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center font-bold transition-all focus:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  required,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-ink">
        {label}
        {required && <span className="text-tomato-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

const fieldBase =
  "w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:outline-none focus:border-leaf-500 focus:ring-4 focus:ring-leaf-500/15 disabled:bg-cream-deep disabled:text-ink-faint";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} h-11 ${className}`} {...props} />;
}

export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`${fieldBase} h-11 pr-12 ${className}`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-faint transition-colors hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBase} h-11 cursor-pointer appearance-none bg-[length:1.1em] bg-[right_0.75rem_center] bg-no-repeat pr-10 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234b6b58' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} py-3 min-h-[90px] ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,40,28,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "sun";
  className?: string;
}) {
  const tones = {
    neutral: "bg-cream-deep text-ink-soft",
    green: "bg-leaf-100 text-leaf-700",
    red: "bg-tomato-100 text-tomato-600",
    amber: "bg-sun-100 text-[oklch(0.45_0.1_70)]",
    sun: "bg-sun-100 text-[oklch(0.45_0.1_70)]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`animate-pop-in max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-cream/95 px-5 py-4 backdrop-blur">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-600">
        {icon}
      </div>
      <p className="text-lg font-extrabold text-ink">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-sm text-ink-soft">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-soft">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label && <span className="text-sm font-semibold">{label}</span>}
    </div>
  );
}

/* ---------------- Toast ---------------- */
type Toast = { id: number; message: string; kind: "success" | "error" };
const ToastCtx = createContext<(message: string, kind?: "success" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-in-up pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg ${
              t.kind === "success" ? "bg-leaf-600" : "bg-danger"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
