export interface LocationValue {
  address: string;
  lat: number;
  lng: number;
}
export function isValidLocation(
  value: LocationValue | null,
): value is LocationValue {
  return (
    !!value &&
    typeof value.address === "string" &&
    !!value.address.trim() &&
    Number.isFinite(value.lat) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    Number.isFinite(value.lng) &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}
