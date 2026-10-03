import { apiRequest } from "./api";
export const defaults = {
  appName: "RouteLog HOS",
  workspaceName: "Demo Transport",
  workspaceSubtitle: "Fleet workspace",
  logo: "",
};
export type Branding = typeof defaults;
export type User = {
  id: number;
  email: string;
  name: string;
  role: string;
  is_admin: boolean;
};
type Settings = {
  app_name: string;
  workspace_name: string;
  workspace_subtitle: string;
  logo_url: string | null;
};
const branding = (value: Settings): Branding => ({
  appName: value.app_name,
  workspaceName: value.workspace_name,
  workspaceSubtitle: value.workspace_subtitle,
  logo: value.logo_url || "",
});
export const authService = {
  me: () => apiRequest<{ user: User | null; csrf_token: string }>("/auth/me/"),
  login: (email: string, password: string, remember = true) =>
    apiRequest<{ user: User; csrf_token: string }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    }),
  profile: (name: string) =>
    apiRequest<{ user: User }>("/auth/profile/", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  logout: () => apiRequest("/auth/logout/", { method: "POST" }),
  async changePassword(current: string, next: string, confirmation: string) {
    if (next.length < 8)
      throw new Error("Password must contain at least 8 characters.");
    if (next !== confirmation)
      throw new Error("New password and confirmation must match.");
    return apiRequest("/auth/change-password/", {
      method: "POST",
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
  },
};
export const settingsService = {
  async read() {
    return branding(await apiRequest<Settings>("/settings/"));
  },
  async save(value: Partial<Branding>) {
    return branding(
      await apiRequest<Settings>("/settings/", {
        method: "PATCH",
        body: JSON.stringify({
          app_name: value.appName,
          workspace_name: value.workspaceName,
          workspace_subtitle: value.workspaceSubtitle,
        }),
      }),
    );
  },
  async upload(file: File) {
    const data = new FormData();
    data.append("logo", file);
    return branding(
      await apiRequest<Settings>("/settings/logo/", {
        method: "POST",
        body: data,
      }),
    );
  },
  async reset() {
    return branding(
      await apiRequest<Settings>("/settings/logo/", { method: "DELETE" }),
    );
  },
};
