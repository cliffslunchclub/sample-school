import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { Button, Field, PasswordInput } from "../../components/ui";
import pb from "../../lib/pocketbase";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const token     = params.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This reset link is missing a token.">
        <div className="text-center">
          <Link to="/forgot-password" className="font-bold text-leaf-700 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await pb.collection("users").confirmPasswordReset(token, password, confirm);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch {
      setError("This reset link is invalid or has expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-ink-soft">Redirecting you to sign in…</p>
          <Link to="/login" className="font-bold text-leaf-700 hover:underline text-sm">
            Sign in now
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something secure and memorable"
      footer={
        <Link to="/login" className="inline-flex items-center gap-1 font-bold text-leaf-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-tomato-50 px-4 py-3 text-sm font-semibold text-tomato-600">{error}</div>
        )}
        <Field label="New password" htmlFor="password" required>
          <PasswordInput
            id="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters" required minLength={8}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" required>
          <PasswordInput
            id="confirm" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your new password" required minLength={8}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          <KeyRound className="h-4 w-4" /> Set new password
        </Button>
      </form>
    </AuthShell>
  );
}
