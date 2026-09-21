import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const MEDIA_URL = API_URL; // evidence frame URLs are relative to the backend

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("safecity_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("safecity_token");
      localStorage.removeItem("safecity_user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function frameUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${MEDIA_URL}${path}`;
}

/**
 * Download a file from an authenticated endpoint. A plain <a href> can't send
 * the login token, so fetch the bytes with axios and hand them to the browser.
 */
export async function downloadFile(
  path: string,
  params: Record<string, string | undefined>,
  filename: string
): Promise<void> {
  const res = await api.get(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
