const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://doceeto.vercel.app").replace(/\/$/, "");

export type ApiOptions = RequestInit & { surface?: "patient" };

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { surface = "patient", headers, ...init } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Iyashi-Surface": surface, ...headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body as T;
}

export const api = {
  baseUrl: API_BASE_URL,
  me: () => request<MeResponse>("/api/auth/me"),
  login: (email: string, password: string) => request<{ ok: true; role: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  doctors: (cadre: "doctor" | "nurse") => request<Provider[]>(`/api/data?entity=doctors&cadre=${cadre}`),
  requests: () => request<RequestRow[]>("/api/data?entity=requests"),
  action: <T = unknown>(action: string, payload: Record<string, unknown>) => request<T>("/api/actions", { method: "POST", body: JSON.stringify({ action, payload }) }),
};

export interface Patient { id: string; name: string; email?: string; address?: string; lat?: number | null; lng?: number | null; avatarUrl?: string | null }
export interface MeResponse { user?: null | Patient; role?: string; patient?: Patient }
export interface Provider { id: string; name: string; fullName?: string; specialty?: string; title?: string; bio?: string; about?: string; status?: string; rating?: number; reviewCount?: number; consultFee?: number; homeVisitFee?: number; verified?: boolean; avatarUrl?: string | null; lat?: number; lng?: number; cadre?: string }
export interface RequestRow { id: string; doctorId?: string | null; doctorName?: string; type?: string; status?: string; mode?: string; fee?: number; address?: string; startCode?: string; createdAt?: string; scheduledAt?: string | null; symptoms?: string }
