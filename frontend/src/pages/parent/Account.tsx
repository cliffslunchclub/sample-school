import { useState } from "react";
import { UserCog, Mail, KeyRound } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { useToast, Button, Card, Field, Input, PasswordInput } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { formatDate } from "../../lib/format";

export default function Account() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await pb.collection("users").update(user!.id, { first_name: firstName, last_name: lastName });
      await refresh();
      toast("Profile updated");
    } catch {
      toast("Could not update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast("New passwords do not match", "error");
      return;
    }
    setSavingPw(true);
    try {
      await pb.collection("users").update(user!.id, {
        oldPassword: oldPw,
        password: newPw,
        passwordConfirm: confirmPw,
      });
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      toast("Password changed");
    } catch {
      toast("Could not change password. Check your current password.", "error");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Account" desc="Manage your profile and password" />

      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-2 font-extrabold text-ink">
          <UserCog className="h-5 w-5 text-leaf-600" /> Profile
        </div>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </Field>
            <Field label="Last name" required>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </Field>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-cream-deep px-4 py-3 text-sm text-ink-soft">
            <Mail className="h-4 w-4" /> {user?.email}
            <span className="ml-auto text-xs text-ink-faint">Joined {formatDate(user?.created)}</span>
          </div>
          <Button type="submit" loading={savingProfile}>
            Save profile
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 font-extrabold text-ink">
          <KeyRound className="h-5 w-5 text-leaf-600" /> Change password
        </div>
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="Current password" required>
            <PasswordInput value={oldPw} onChange={(e) => setOldPw(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" hint="At least 8 characters" required>
              <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required />
            </Field>
            <Field label="Confirm new password" required>
              <PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} minLength={8} required />
            </Field>
          </div>
          <Button type="submit" loading={savingPw}>
            Change password
          </Button>
        </form>
      </Card>
    </div>
  );
}
