import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Upload, ShieldCheck, Check } from "lucide-react";
import { useWorkspace } from "../context/WorkspaceContext";
import { Brand } from "../components/ui/Brand";
import { PasswordField } from "../components/ui/PasswordField";
import { authService } from "../services/workspace";
export function SettingsPage() {
  const {
    branding,
    user,
    updateProfile,
    path,
    navigate,
    updateSettings,
    uploadLogo,
    resetLogo,
    notify,
  } = useWorkspace();
  const tab = path.split("/")[2] || "general";
  const [displayName, setDisplayName] = useState(user?.name || "");
  useEffect(() => {
    setDisplayName(user?.name || "");
  }, [user?.name]);
  const [draft, setDraft] = useState(branding);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    setDraft(branding);
    setError("");
    setSuccess(false);
    setCurrent("");
    setNext("");
    setConfirm("");
  }, [tab, branding]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!draft.appName.trim() || !draft.workspaceName.trim())
        throw new Error("Application and workspace names are required.");
      if (tab === "general" && !displayName.trim())
        throw new Error("Display name is required.");
      await updateSettings({
        ...draft,
        appName: draft.appName.trim(),
        workspaceName: draft.workspaceName.trim(),
        workspaceSubtitle: draft.workspaceSubtitle.trim(),
      });
      if (tab === "general" && displayName.trim() !== user?.name)
        await updateProfile(displayName.trim());
      notify(
        tab === "branding" ? "Branding updated" : "Workspace settings saved",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPG or WEBP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be no larger than 2 MB.");
      return;
    }
    try {
      setBusy(true);
      await uploadLogo(file);
      notify("Logo uploaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload image.");
    } finally {
      setBusy(false);
    }
  }
  async function change(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (next.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation must match.");
      return;
    }
    setBusy(true);
    try {
      await authService.changePassword(current, next, confirm);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSuccess(true);
      notify("Password updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }
  const input = (
    label: string,
    key: "appName" | "workspaceName" | "workspaceSubtitle",
  ) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        maxLength={60}
        required={key !== "workspaceSubtitle"}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-intro">
        <div>
          <div className="eyebrow">MAKE IT YOUR WORKSPACE</div>
          <h1>Settings</h1>
          <p>Manage your workspace, branding and account security.</p>
        </div>
        <span className="rules-pill">
          <ShieldCheck size={15} />
          Administrator
        </span>
      </div>
      <nav className="settings-tabs" aria-label="Settings sections">
        {["general", "branding", "security"].map((item) => (
          <a
            key={item}
            href={`/settings/${item}`}
            aria-current={tab === item ? "page" : undefined}
            className={tab === item ? "selected" : ""}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/settings/${item}`);
            }}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </a>
        ))}
      </nav>
      <section className="settings-card">
        <div className="settings-card-heading">
          <h2>
            {tab === "general"
              ? "Workspace details"
              : tab === "branding"
                ? "Brand identity"
                : "Change password"}
          </h2>
          <p>
            {tab === "general"
              ? "The details that make this workspace yours."
              : tab === "branding"
                ? "A familiar identity, wherever your team signs in."
                : "Keep your workspace access up to date."}
          </p>
        </div>
        {tab === "security" ? (
          <form onSubmit={change}>
            <PasswordField
              label="Current Password"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
            <PasswordField
              label="New Password"
              value={next}
              onChange={setNext}
            />
            <p className="field-hint">
              Password must contain at least 8 characters.
            </p>
            <PasswordField
              label="Confirm New Password"
              value={confirm}
              onChange={setConfirm}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="form-success" role="status">
                <Check size={16} />
                Password updated successfully.
              </p>
            )}
            <div className="settings-actions">
              <button className="primary-action" disabled={busy}>
                {busy ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={save}>
            {tab === "general" ? (
              <>
                {input("Workspace Name", "workspaceName")}
                {input("Application Name", "appName")}
                {input("Workspace subtitle", "workspaceSubtitle")}
                <div className="field">
                  <label htmlFor="displayName">Display Name</label>
                  <input
                    id="displayName"
                    maxLength={150}
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="accountEmail">Email</label>
                  <input
                    id="accountEmail"
                    type="email"
                    value={user?.email || ""}
                    readOnly
                  />
                </div>
                <p className="field-hint">Role: {user?.role}</p>
              </>
            ) : (
              <>
                <label className="logo-label" htmlFor="logo-upload">
                  Logo
                </label>
                <div className="logo-upload">
                  <div className="logo-preview">
                    <Brand logo={draft.logo} name="" />
                  </div>
                  <div>
                    <label
                      className="secondary-action upload-button"
                      htmlFor="logo-upload"
                    >
                      <Upload size={16} />
                      Choose image
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <p className="field-hint">
                      PNG, JPG or WEBP · Maximum 2 MB
                    </p>
                  </div>
                </div>
                {input("Application Name", "appName")}
                <div className="branding-preview">
                  <span className="login-kicker">PREVIEW</span>
                  <div className="brand">
                    <Brand logo={draft.logo} name={draft.appName} />
                  </div>
                  <p>{draft.workspaceName}</p>
                </div>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="settings-actions">
              {tab === "branding" && (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await resetLogo();
                      setDraft((value) => ({ ...value, logo: "" }));
                      notify("Default logo restored");
                    } catch {
                      setError("Unable to reset logo.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Reset to default logo
                </button>
              )}
              <button className="primary-action" disabled={busy}>
                {tab === "branding" ? "Save Branding" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </section>
      <p className="settings-demo-note">
        Demo workspace · Settings are saved to your workspace.
      </p>
    </motion.main>
  );
}
