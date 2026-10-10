import { isSampleSite, demoEmail, DEMO_PASSWORD } from "../../lib/site";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Button, Field, Input, PasswordInput } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export default function Login() {
  const { login } = useAuth();
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
      navigate(user.role === "admin" ? "/admin" : "/students", { replace: true });
    } catch {
      setError("Incorrect email or password, or your account is inactive.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your children's lunches"
      footer={
        <>
          New to the club?{" "}
          <Link to="/register" className="font-bold text-leaf-700 hover:underline">
            Create a parent account
          </Link>
        </>
      }
    >
      <p className="mb-4 text-center"><Link to="/" className="text-sm font-bold text-leaf-700 hover:underline">Back to home</Link></p>
      <form onSubmit={submit} className="space-y-4">
        {isSampleSite && <div className="rounded-xl border border-leaf-200 bg-leaf-50 p-4 text-sm">
          <p className="mb-3 text-ink-soft">Explore with sample data. Changes cannot be saved.</p>
          <Button type="button" variant="outline" className="w-full" onClick={() => { setEmail(demoEmail("parent")); setPassword(DEMO_PASSWORD); setError(""); }}>Try Parent Demo</Button>
        </div>}
        {error && (
          <div className="rounded-xl bg-tomato-50 px-4 py-3 text-sm font-semibold text-tomato-600">
            {error}
          </div>
        )}
        <Field label="Email" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <PasswordInput id="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
        <div className="text-center">
          <Link to="/forgot-password" className="text-sm font-bold text-leaf-700 hover:underline">
            Forgot your password?
          </Link>
        </div>
      </form>
      <p className="mt-5 text-center text-xs text-ink-faint">
        Are you a school administrator?{" "}
        <Link to="/admin/login" className="font-bold text-ink-soft hover:underline">
          Admin sign in
        </Link>
      </p>
    </AuthShell>
  );
}

