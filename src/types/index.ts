// Shared TypeScript types for the entire application

export type Role = 'contributor' | 'trusted' | 'admin';

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  blocked: boolean;
  created_at: string;
}

export type StationStatus = 'active' | 'closed' | 'hidden';

export interface Station {
  id: string;
  name_am: string | null;
  name_en: string | null;
  lat: number;
  lng: number;
  landmark_am: string | null;
  landmark_en: string | null;
  status: StationStatus;
  last_verified_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Line {
  id: string;
  station_id: string;
  destination_am: string | null;
  destination_en: string | null;
  fare_birr: number;
  fare_checked_at: string | null;
  direction: string | null;
  return_station_id: string | null;
  sort_order: number;
}

export interface StationPhoto {
  id: string;
  station_id: string;
  path: string;
  kind: 'wide' | 'close';
  created_at: string;
}

export type SubmissionType = 'new_station' | 'edit_station' | 'report';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  type: SubmissionType;
  station_id: string | null;
  payload: Record<string, unknown>;
  photo_paths: string[];
  submitter_id: string | null;
  submitter_lat: number | null;
  submitter_lng: number | null;
  status: SubmissionStatus;
  reviewer_id: string | null;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// Add-station draft stored in localStorage
export interface AddStationDraft {
  step: number;
  lat: number | null;
  lng: number | null;
  submitter_lat: number | null;
  submitter_lng: number | null;
  gps_accuracy: number | null;
  photo_paths: string[];
  name_am: string;
  name_en: string;
  landmark_am: string;
  landmark_en: string;
  lines: DraftLine[];
}

export interface IntermediateStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface RouteChoice {
  id: string;
  title_am: string;
  title_en: string;
  corridorDescription: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  viaStops: IntermediateStop[];
}

export interface DraftLine {
  id: string; // local only, for list key
  destination_am: string;
  destination_en: string;
  fare_birr: string;
  direction: string;
  return_station_id: string | null;
  start_station_id?: string | null;
  end_station_id?: string | null;
  start_coords?: [number, number] | null;
  end_coords?: [number, number] | null;
  via_corridor?: string;
  selected_route_id?: string;
  route_geometry?: [number, number][];
  route_distance_meters?: number;
  route_duration_seconds?: number;
  intermediate_stops?: IntermediateStop[];
}

export interface TransitStep {
  kind: 'walk_to_station' | 'intercept_taxi' | 'ride_taxi' | 'transfer_walk' | 'arrive_destination';
  title_am: string;
  title_en: string;
  desc_am?: string;
  desc_en?: string;
  distanceMeters: number;
  durationMinutes: number;
  fareBirr?: number;
  fromCoords: [number, number];
  toCoords: [number, number];
  station?: Station;
  line?: Line;
  woyalaCallout?: string;
  laneTip?: string;
}

export interface TransitJourney {
  id: string;
  label: 'fastest' | 'least_walking' | 'cheapest' | 'direct';
  totalDurationMinutes: number;
  totalDistanceMeters: number;
  totalFareBirr: number;
  transfersCount: number;
  summaryTitle_am: string;
  summaryTitle_en: string;
  steps: TransitStep[];
  geometrySegments: {
    type: 'walk' | 'taxi_leg1' | 'taxi_leg2';
    coordinates: [number, number][];
  }[];
}
