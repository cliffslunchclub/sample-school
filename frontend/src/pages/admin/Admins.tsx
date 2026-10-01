import { useEffect, useState } from "react";
import pb from "../../lib/pocketbase";
import type { UserRecord } from "../../lib/types";
import { Button, Card, Field, Input, PasswordInput, Modal, Spinner, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";

export default function Admins() {
  const toast = useToast();
  const [admins, setAdmins] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    try { setAdmins(await pb.collection("users").getFullList<UserRecord>({filter:'role = "admin"',sort:"first_name", requestKey:null})); }
    catch { setError("Could not load admin accounts. Please try again."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) { setError("Passwords do not match."); return; }
    setSaving(true); setError("");
    try {
      await pb.send("/api/admin/accounts", {method:"POST",body:Object.fromEntries(form)});
      setOpen(false); toast("Admin account created"); await load();
    } catch (err: unknown) {
      setError((err as {response?:{message?:string}}).response?.message || "Could not create the admin account.");
    } finally { setSaving(false); }
  };
  return <div>
    <PageHeader title="Administrators" desc="Create accounts for staff who manage this school's lunches" action={<Button onClick={() => {setError(""); setOpen(true);}}>Create admin</Button>} />
    {loading ? <Spinner /> : <Card className="divide-y divide-line">{admins.map(a => <div key={a.id} className="p-4"><p className="font-bold">{a.first_name} {a.last_name}</p><p className="text-sm text-ink-soft">{a.email} · {a.active ? "Active" : "Inactive"}</p></div>)}</Card>}
    {!open && error && <p role="alert" className="mt-3 text-tomato-600">{error}</p>}
    <Modal open={open} onClose={() => {if (!saving) setOpen(false);}} title="Create admin">
      <form onSubmit={submit} className="space-y-4">
        <Field label="First name" htmlFor="admin-first" required><Input id="admin-first" name="first_name" required maxLength={100} /></Field>
        <Field label="Last name" htmlFor="admin-last" required><Input id="admin-last" name="last_name" required maxLength={100} /></Field>
        <Field label="Email" htmlFor="admin-email" required><Input id="admin-email" name="email" type="email" required /></Field>
        <Field label="Password" htmlFor="admin-password" hint="At least 12 characters. Share it directly with the new admin." required><PasswordInput id="admin-password" name="password" minLength={12} autoComplete="new-password" required /></Field>
        <Field label="Confirm password" htmlFor="admin-confirm" required><PasswordInput id="admin-confirm" name="confirm" minLength={12} autoComplete="new-password" required /></Field>
        {error && <p role="alert" className="text-sm text-tomato-600">{error}</p>}
        <Button type="submit" loading={saving}>Create account</Button>
      </form>
    </Modal>
  </div>;
}
