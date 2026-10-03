const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
let csrfToken = "";
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(options.method || "GET") &&
      csrfToken
    )
      headers.set("X-CSRFToken", csrfToken);
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (
      body &&
      typeof body === "object" &&
      "csrf_token" in body &&
      typeof body.csrf_token === "string"
    )
      csrfToken = body.csrf_token;
    if (!response.ok) {
      if (
        (response.status === 401 || response.status === 403) &&
        body &&
        typeof body === "object" &&
        "detail" in body &&
        body.detail === "Authentication credentials were not provided."
      )
        window.dispatchEvent(new Event("routelog:session-expired"));
      throw new ApiError(
        body &&
          typeof body === "object" &&
          "detail" in body &&
          typeof body.detail === "string"
          ? body.detail
          : response.status === 400
            ? body && typeof body === "object"
              ? Object.values(body)
                  .flat()
                  .filter((value) => typeof value === "string")
                  .join(" ") || "Please check the supplied values."
              : "Please check the supplied values."
            : `The trip service could not complete your request (${response.status}). Please try again.`,
        response.status,
        body,
      );
    }
    if (!body)
      throw new ApiError(
        "The trip service returned an invalid response. Please try again.",
      );
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "The trip request timed out. Please try again."
        : "Unable to reach the trip service. Check that Django is running and try again.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
