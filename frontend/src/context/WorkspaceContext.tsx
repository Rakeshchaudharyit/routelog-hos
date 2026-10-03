import {
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  authService,
  settingsService,
  defaults,
  type Branding,
  type User,
} from "../services/workspace";
import { Context } from "./WorkspaceState";
export function useWorkspaceState() {
  const [branding, setBranding] = useState(defaults);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState("");
  const authenticated = !!user;
  const [path, setPath] = useState(location.pathname);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const handler = () => setPath(location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.title = branding.appName;
  }, [branding.appName]);
  const navigate = useCallback((next: string, replace = false) => {
    history[replace ? "replaceState" : "pushState"]({}, "", next);
    setPath(next);
  }, []);
  async function bootstrap() {
    setLoading(true);
    setBootstrapError("");
    try {
      const { user: current } = await authService.me();
      const settings = current?.is_admin
        ? await settingsService.read()
        : defaults;
      setBranding(settings);
      setUser(current);
    } catch (error) {
      setBootstrapError(
        error instanceof Error ? error.message : "Unable to load workspace.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void bootstrap();
    const expired = () => {
      setUser(null);
      setBranding(defaults);
      navigate("/login", true);
    };
    window.addEventListener("routelog:session-expired", expired);
    return () =>
      window.removeEventListener("routelog:session-expired", expired);
  }, [navigate]);
  async function updateSettings(value: Partial<Branding>) {
    setBranding(await settingsService.save(value));
  }
  async function updateProfile(name: string) {
    setUser((await authService.profile(name)).user);
  }
  async function uploadLogo(file: File) {
    setBranding(await settingsService.upload(file));
  }
  async function resetLogo() {
    setBranding(await settingsService.reset());
  }
  async function login(email: string, password: string, remember = true) {
    const result = await authService.login(email, password, remember);
    setBranding(result.user.is_admin ? await settingsService.read() : defaults);
    setUser(result.user);
    navigate("/trip-planner");
  }
  async function logout() {
    try {
      await authService.logout();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to sign out.");
      return;
    }
    setUser(null);
    setBranding(defaults);
    navigate("/login");
  }
  return {
    branding,
    user,
    loading,
    bootstrapError,
    bootstrap,
    uploadLogo,
    resetLogo,
    authenticated,
    path,
    navigate,
    updateSettings,
    updateProfile,
    login,
    logout,
    toast,
    notify: setToast,
  };
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}
