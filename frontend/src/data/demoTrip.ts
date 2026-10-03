import type { TripInput } from "../types/trip";
export const defaultInput: TripInput = {
  currentLocation: {
    address: "Atlanta, GA, USA",
    lat: 33.749,
    lng: -84.388,
  },
  pickupLocation: {
    address: "Nashville, TN, USA",
    lat: 36.1627,
    lng: -86.7816,
  },
  dropoffLocation: {
    address: "Dallas, TX, USA",
    lat: 32.7767,
    lng: -96.797,
  },
  currentCycleUsed: 18,
};
export const dutyLabels = {
  off_duty: "Off Duty",
  sleeper: "Sleeper Berth",
  driving: "Driving",
  on_duty: "On Duty",
};
