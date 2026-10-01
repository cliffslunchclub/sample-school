import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Button, Field, Input, PasswordInput } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import pb from "../../lib/pocketbase";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    code: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${pb.baseURL}/api/register-parent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Registration failed. Please try again.");
        return;
      }
      const user = await login(form.email, form.password);
      navigate(user.role === "admin" ? "/admin" : "/students", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register with the code provided by your school"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-leaf-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-tomato-50 px-4 py-3 text-sm font-semibold text-tomato-600">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="fn" required>
            <Input id="fn" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
          </Field>
          <Field label="Last name" htmlFor="ln" required>
            <Input id="ln" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
          </Field>
        </div>
        <Field label="Email" htmlFor="em" required>
          <Input id="em" type="email" autoComplete="email" value={form.email}
            onChange={(e) => set("email", e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="pw" hint="At least 8 characters" required>
          <PasswordInput id="pw" autoComplete="new-password" value={form.password}
            onChange={(e) => set("password", e.target.value)} minLength={8} required />
        </Field>
        <Field label="School verification code" htmlFor="code" required>
          <Input id="code" value={form.code} onChange={(e) => set("code", e.target.value)}
            placeholder="Provided by your school" required />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
