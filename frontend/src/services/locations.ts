import { apiRequest, ApiError } from "./api";
import { isValidLocation, type LocationValue } from "../types/location";
export interface LocationSuggestion extends LocationValue {
  type: string;
  importance: number;
}
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  try {
    const data = await apiRequest<{ results: LocationSuggestion[] }>(
      `/locations/search/?${new URLSearchParams({ q: trimmed })}`,
      { signal },
    );
    if (!Array.isArray(data.results))
      throw new Error("Address search returned an invalid response.");
    return data.results.filter(isValidLocation).slice(0, 5);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.details &&
      typeof error.details === "object" &&
      "detail" in error.details
    )
      throw new Error(String(error.details.detail));
    throw new Error(
      "Address search is unavailable. Check the connection and try again.",
    );
  }
}
