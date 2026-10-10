import { isSampleSite, demoEmail, DEMO_PASSWORD } from "../../lib/site";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { Button, Field, Input, PasswordInput } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export default function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role !== "admin") {
        logout();
        setError("This is not an administrator account.");
        return;
      }
      navigate("/admin", { replace: true });
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Administrator sign in"
      subtitle="Manage menus, orders and school settings"
      footer={
        <Link to="/" className="font-bold text-leaf-700 hover:underline">
          Back to home
        </Link>
      }
    >
      <p className="mb-4 text-center"><Link to="/" className="text-sm font-bold text-leaf-700 hover:underline">Back to home</Link></p>
      <form onSubmit={submit} className="space-y-4">
        {isSampleSite && <div className="rounded-xl border border-leaf-200 bg-leaf-50 p-4 text-sm">
          <p className="mb-3 text-ink-soft">Explore with sample data. Changes cannot be saved.</p>
          <Button type="button" variant="outline" className="w-full" onClick={() => { setEmail(demoEmail("admin")); setPassword(DEMO_PASSWORD); setError(""); }}>Try Admin Demo</Button>
        </div>}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-leaf-50 px-4 py-2.5 text-sm font-bold text-leaf-700">
          <ShieldCheck className="h-4 w-4" /> {isSampleSite ? "Administrator demo" : "Staff access only"}
        </div>
        {error && (
          <div className="rounded-xl bg-tomato-50 px-4 py-3 text-sm font-semibold text-tomato-600">
            {error}
          </div>
        )}
        <Field label="Email" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <PasswordInput id="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

