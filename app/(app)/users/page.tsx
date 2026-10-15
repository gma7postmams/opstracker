"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Modal from "@/components/Modal";
import Avatar from "@/components/Avatar";
import ImageUpload from "@/components/ImageUpload";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Eye, EyeOff, Info, Mail, Search, ShieldCheck, UserRound, Users as UsersIcon } from "lucide-react";
import type { U } from "@/types/user";

export default function Users() {
  const { data: session, update } = useSession();
  const toast = useToast();
  const isAdmin = session?.user.role === "ADMIN";
  const [users, setUsers] = useState<U[]>([]);
  const [editing, setEditing] = useState<null | { user?: U }>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesSearch = !normalizedSearch || [user.name, user.email, user.username]
      .some((value) => value.toLowerCase().includes(normalizedSearch));
    return matchesSearch && (roleFilter === "ALL" || user.role === roleFilter);
  });
  const administratorCount = users.filter((user) => user.role === "ADMIN").length;
  const standardUserCount = users.filter((user) => user.role === "USER").length;
  const emailReportsCount = users.filter((user) => user.smtpEnabled).length;

  const load = useCallback(async () => {
    setUsers(await (await fetch("/api/users")).json());
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="filters" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "var(--panel)", boxShadow: "0 3px 12px rgba(18,38,63,.04)", display: "flex", flexWrap: "nowrap", alignItems: "end", gap: 12 }}>
        <label style={{ position: "relative", display: "flex", alignItems: "center", flex: "1 1 0", minWidth: 0 }}>
          <Search size={17} aria-hidden="true" style={{ position: "absolute", left: 12, color: "var(--muted)" }} />
          <input
            type="search"
            aria-label="Search users"
            placeholder="Search Users"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: "100%", paddingLeft: 38 }}
          />
        </label>
        <label className="flabel" style={{ width: 180, flex: "0 0 180px" }}>
          Role Filter
          <select
            aria-label="Filter users by role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            style={{ width: "100%" }}
          >
            <option value="ALL">All roles</option>
            <option value="ADMIN">Administrators</option>
            <option value="USER">Standard users</option>
          </select>
        </label>
        {isAdmin && (
          <button className="primary" onClick={() => setEditing({})} style={{ flex: "0 0 auto", alignSelf: "end" }}>
            <UsersIcon size={16} aria-hidden="true" /> Add User
          </button>
        )}
      </div>

      <section aria-label="User summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 16 }}>
        {[
          { label: "Total Users", value: users.length, icon: UsersIcon, accent: "#2563eb" },
          { label: "Administrators", value: administratorCount, icon: ShieldCheck, accent: "#7c3aed" },
          { label: "Standard Users", value: standardUserCount, icon: UserRound, accent: "#0891b2" },
          { label: "Email Reports Enabled", value: emailReportsCount, icon: Mail, accent: "#d97706" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="panel" style={{ padding: 16, borderTop: `3px solid ${accent}`, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{label}</span>
              <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, flex: "none", borderRadius: 7, color: accent, background: `color-mix(in srgb, ${accent} 15%, var(--panel))` }}>
                <Icon size={16} aria-hidden="true" />
              </span>
            </div>
            <div style={{ marginTop: 7, color: "var(--text)", fontSize: 27, fontWeight: 700, lineHeight: 1 }}>
              {value}
            </div>
          </div>
        ))}
      </section>

      <div className="panel spaced" role="note" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginTop: 16, background: "var(--hint-bg)", borderLeft: "3px solid var(--accent)", fontSize: 13, lineHeight: 1.4 }}>
        <Info size={17} aria-hidden="true" style={{ color: "var(--accent)", flex: "none" }} />
        <div>
          <b>Data ownership policy</b>{" "}
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
            {filteredUsers.map((u) => (
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
                <td>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 9px",
                    borderRadius: 999,
                    background: u.role === "ADMIN" ? "#ede9fe" : "#dbeafe",
                    color: u.role === "ADMIN" ? "#6d28d9" : "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}>
                    {u.role === "ADMIN" ? "Administrator" : "Standard User"}
                  </span>
                </td>
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
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const err = (k: string) => errors[k] && <span className="fielderr">{errors[k]}</span>;
  const sectionStyle = {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "14px 0 2px",
    padding: "11px 12px",
    border: "1px solid #e2e8f0",
    borderBottom: "2px solid #d7e0e8",
    borderRadius: "6px",
    background: "#f8fafc",
    color: "#243342",
    fontSize: "13px",
    fontWeight: 600,
  };
  
  


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

          <div className="sectionlabel" style={{ ...sectionStyle, marginTop: "0" }}>
            <UserRound size={17} strokeWidth={2} style={{ color: "#0f766e" }} />
            Profile Information
          </div>
          <div className="full">
            <ImageUpload kind="avatar" value={f.avatarUrl} round
              hint="PNG, JPG or WebP up to 2 MB. Square images look best."
              onChange={(url) => set("avatarUrl", url)} />
          </div>

          <label>First name<input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} required />{err("firstName")}</label>
          <label>Middle initial
            <input maxLength={1} className="upper" value={f.middleInitial ?? ""}
              onChange={(e) => set("middleInitial", e.target.value.toUpperCase())} />
          </label>
          <label className="full">Surname<input value={f.surname} onChange={(e) => set("surname", e.target.value)} required />{err("surname")}</label>

          <div className="sectionlabel" style={sectionStyle}>
            <ShieldCheck size={17} strokeWidth={2} style={{ color: "#2563eb" }} />
            Account Information
          </div>
          <label>Email address<input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />{err("email")}</label>
          <label>Username
            <input value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} required />
            {err("username")}
          </label>
          <label>Role
            <select value={f.role} disabled={isSelf} onChange={(e) => set("role", e.target.value)}>
              <option value="ADMIN">Administrator</option><option value="USER">Standard User</option>
            </select>

	<div className="muted" style={{minHeight: "20px", marginTop: "4px",}}>
	{isSelf ? "You cannot change your own role" : ""}
	</div>


            {err("role")}
          </label>


<label>
Password

<div style={{position: "relative", display: "flex", alignItems: "center",}}>
<input type={showPassword ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)}
	placeholder={user 
? "Leave blank to keep current"
: "At least 8 characters"
}
required={!user}
style={{ paddingRight: "40px" }}
/>

<button type="button" onClick={() => setShowPassword(!showPassword)} style={{position: "absolute", right: "10px", background: "none", border: "none", cursor: "pointer",}}>
{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
</button>
</div>

<div className="muted" style={{ minHeight: "20px", marginTop: "4px" }}>
&nbsp;
</div>

{err("password")}
</label>




<div className="sectionlabel" style={sectionStyle}>
  <Mail size={17} strokeWidth={2} style={{ color: "#b45309" }} />
  Email Reports
</div>


<label
  className="full"
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "4px 0 12px",
    borderBottom: "1px solid #e5e7eb",
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



{f.smtpEnabled && (
  <>
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
      <div style={{position: "relative", display: "flex", alignItems: "center",}}>
        <input
          type={showSmtpPassword ? "text" : "password"}
          value={f.smtpPassword}
          onChange={(e) => set("smtpPassword", e.target.value)}
          placeholder="Leave blank to keep current password"
          style={{ paddingRight: "40px" }}
        />
        <button type="button" onClick={() => setShowSmtpPassword(!showSmtpPassword)} style={{position: "absolute", right: "10px", background: "none", border: "none", cursor: "pointer",}}>
          {showSmtpPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
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
  </>
)}
	
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
