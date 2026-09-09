"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Modal from "@/components/Modal";
import Avatar from "@/components/Avatar";
import ImageUpload from "@/components/ImageUpload";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface U {
  id: number; name: string; firstName: string; middleInitial: string | null; surname: string;
  email: string; username: string; role: "ADMIN" | "USER"; avatarUrl: string | null;
  lastLogin: string | null; recordCount: number; smtpEmail?: string | null; smtpPassword?: string | null; smtpRecipients?: string | null; smtpEnabled?: boolean;
}

export default function Users() {
  const { data: session, update } = useSession();
  const toast = useToast();
  const isAdmin = session?.user.role === "ADMIN";
  const [users, setUsers] = useState<U[]>([]);
  const [editing, setEditing] = useState<null | { user?: U }>(null);

  const load = useCallback(async () => {
    setUsers(await (await fetch("/api/users")).json());
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      {isAdmin && (
        <div className="toolbar">
          <button className="primary" onClick={() => setEditing({})}>＋ Add user</button>
        </div>
      )}

      <div className="panel spaced">
        <b>Data ownership policy</b>
        <div className="muted spacedtop-sm">
          Users can edit only records they entered. Admins can edit any record, lock records,
          and manage user accounts. Deleting a user keeps their records, attributed to them.
        </div>
      </div>

      <section className="panel table">
        <table>
          <thead><tr>
            <th>User</th><th>Email</th><th>Username</th><th>Role</th>
            <th>Records</th><th>Last login</th>{isAdmin && <th>Action</th>}
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="usercell">
                    <Avatar url={u.avatarUrl} name={u.name} size={34} />
                    <div>
                      <b>{u.name}</b>
                      <small>{u.surname}, {u.firstName}{u.middleInitial ? ` ${u.middleInitial}.` : ""}</small>
                    </div>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>{u.recordCount}</td>
                <td>{u.lastLogin ? String(u.lastLogin).slice(0, 10) : "—"}</td>
                {isAdmin && (
                  <td>
                    <button className="secondary small" onClick={() => setEditing({ user: u })}>Edit</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editing && (
        <UserForm
          user={editing.user}
          selfId={session!.user.id}
          onClose={() => setEditing(null)}
          onSaved={async (wasSelf) => {
            setEditing(null);
            await load();
            if (wasSelf) await update();  // refresh the name/avatar in the sidebar
            toast(editing.user ? "User updated" : "User created");
          }}
          onDeleted={async () => { setEditing(null); await load(); toast("User deleted"); }}
        />
      )}
    </div>
  );
}

function UserForm({ user, selfId, onClose, onSaved, onDeleted }: {
  user?: U; selfId: number;
  onClose: () => void; onSaved: (wasSelf: boolean) => void; onDeleted: () => void;
}) {
  const toast = useToast();
  const isSelf = user?.id === selfId;
  const [f, setF] = useState({
    firstName: user?.firstName ?? "", middleInitial: user?.middleInitial ?? "",
    surname: user?.surname ?? "", email: user?.email ?? "", username: user?.username ?? "",
    role: user?.role ?? "USER", password: "", avatarUrl: user?.avatarUrl ?? null as string | null, smtpEmail: user?.smtpEmail ?? "", smtpPassword: user?.smtpPassword ?? "", smtpRecipients: user?.smtpRecipients ?? "", smtpEnabled: user?.smtpEnabled ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const err = (k: string) => errors[k] && <span className="fielderr">{errors[k]}</span>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErrors({});
    const payload: any = { ...f, middleInitial: f.middleInitial || null };
    if (isSelf) delete payload.role;      // guarded server-side too
    if (user && !f.password) delete payload.password;

    const res = await fetch(user ? `/api/users/${user.id}` : "/api/users", {
      method: user ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) return onSaved(!!isSelf);
    const out = await res.json();
    setErrors(out.fields ?? { _: out.error ?? "Could not save" });
  }

  async function remove() {
    const res = await fetch(`/api/users/${user!.id}`, { method: "DELETE" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { toast(out.error ?? "Could not delete"); setConfirm(false); return; }
    onDeleted();
  }

  return (
    <>
      <Modal title={user ? "Edit user" : "Add user"} subtitle={user?.username ?? "Create a new account"}
        onClose={onClose} width={620}
        footer={<>
          {user && !isSelf && (
            <button type="button" className="secondary destructive-text pushleft" onClick={() => setConfirm(true)}>
              Delete user
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" form="userform" disabled={saving}>
            {saving ? "Saving…" : user ? "Save changes" : "Create user"}
          </button>
        </>}>
        <form id="userform" onSubmit={submit} className="form">
          {errors._ && <div className="err">{errors._}</div>}

          <div className="sectionlabel">Profile photo</div>
          <div className="full">
            <ImageUpload kind="avatar" value={f.avatarUrl} round
              hint="PNG, JPG or WebP up to 2 MB. Square images look best."
              onChange={(url) => set("avatarUrl", url)} />
          </div>

          <div className="sectionlabel">Name</div>
          <label>First name<input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} required />{err("firstName")}</label>
          <label>Middle initial
            <input maxLength={1} className="upper" value={f.middleInitial ?? ""}
              onChange={(e) => set("middleInitial", e.target.value.toUpperCase())} />
          </label>
          <label className="full">Surname<input value={f.surname} onChange={(e) => set("surname", e.target.value)} required />{err("surname")}</label>

          <div className="sectionlabel">Account</div>
          <label>Email address<input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />{err("email")}</label>
          <label>Username
            <input value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} required />
            {err("username")}
          </label>
          <label>Role
            <select value={f.role} disabled={isSelf} onChange={(e) => set("role", e.target.value)}>
              <option value="ADMIN">ADMIN</option><option value="USER">USER</option>
            </select>

	<div className="muted" style={{minHeight: "20px", marginTop: "4px",}}>
	{isSelf ? "You cannot change your own role" : ""}
	</div>


            {err("role")}
          </label>

<label>
  Password
  <input type="password" value={f.password} onChange={(e) => set("password", e.target.value)}
    placeholder={user ? "Leave blank to keep current" : "At least 8 characters"}
    required={!user}
  />

  <div className="muted" style={{minHeight: "20px", marginTop: "4px",}}>
    &nbsp;
  </div>

  {err("password")}
</label>



<div className="sectionlabel">Email Reports</div>


<label
  className="full"
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
  }}
>
  <input
    type="checkbox"
    checked={f.smtpEnabled}
    onChange={(e) => set("smtpEnabled", e.target.checked)}
    style={{
      width: "18px",
      height: "18px",
      margin: 0,
    }}
  />

  <span>Enable Email Reports</span>
</label>


<label className="full">
  Gmail Sender
  <input
    type="email"
    value={f.smtpEmail}
    onChange={(e) => set("smtpEmail", e.target.value)}
    placeholder="gma7postmams@gmail.com"
  />
</label>

<label className="full">
  Gmail App Password
  <input
    type="password"
    value={f.smtpPassword}
    onChange={(e) => set("smtpPassword", e.target.value)}
    placeholder="Google App Password"
  />
</label>

<label className="full">
  Recipients
  <input
    value={f.smtpRecipients}
    onChange={(e) => set("smtpRecipients", e.target.value)}
    placeholder="manager@gmail.com,noel@gmail.com"
  />
  <span className="muted">
    Separate multiple email addresses with commas.
  </span>
</label>
	
        </form>
      </Modal>

      {confirm && (
        <ConfirmDialog
          title={`Delete ${user!.name}?`}
          body={user!.recordCount
            ? `Their ${user!.recordCount} record(s) stay in the system.`
            : "This cannot be undone."}
          onCancel={() => setConfirm(false)} onYes={remove} />
      )}
    </>
  );
}
