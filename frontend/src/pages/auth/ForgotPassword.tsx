import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { Button, Field, Input } from "../../components/ui";
import pb from "../../lib/pocketbase";

export default function ForgotPassword() {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await pb.collection("users").requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      // Always show success to prevent email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        footer={
          <Link to="/login" className="inline-flex items-center gap-1 font-bold text-leaf-700 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-ink-soft">
            If <strong className="text-ink">{email}</strong> is registered, you'll receive a reset link shortly.
            Check your inbox and follow the instructions.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link"
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
        <Field label="Email address" htmlFor="email" required>
          <Input
            id="email" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          <Mail className="h-4 w-4" /> Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
