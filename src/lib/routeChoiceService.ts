import { distanceMetres } from './utils';
import type { IntermediateStop, RouteChoice } from '../types';

// Prominent Addis transit hubs that act as corridor waypoints
const ADDIS_CORRIDOR_HUBS: { name_am: string; name_en: string; coords: [number, number] }[] = [
  { name_am: 'መገናኛ', name_en: 'Megenagna', coords: [9.0215, 38.8020] },
  { name_am: 'ቦሌ መድሃኒአለም', name_en: 'Bole Medhanialem', coords: [8.9950, 38.7885] },
  { name_am: 'መስቀል አደባባይ', name_en: 'Meskel Square', coords: [9.0105, 38.7610] },
  { name_am: 'ሜክሲኮ', name_en: 'Mexico', coords: [9.0110, 38.7450] },
  { name_am: 'ፒያሳ', name_en: 'Piassa', coords: [9.0345, 38.7525] },
  { name_am: '22 ማዞሪያ', name_en: '22 Mazoriya', coords: [9.0145, 38.7860] },
  { name_am: 'ካዛንቺስ', name_en: 'Kazanchis', coords: [9.0180, 38.7690] },
  { name_am: 'ጎተራ', name_en: 'Gotera', coords: [8.9850, 38.7550] },
  { name_am: 'ጦር ኃይሎች', name_en: 'Tor Hailoch', coords: [9.0090, 38.7240] },
  { name_am: 'አራት ኪሎ', name_en: 'Arat Kilo', coords: [9.0335, 38.7635] },
  { name_am: 'ሽሮ ሜዳ', name_en: 'Shiromeda', coords: [9.0600, 38.7620] },
  { name_am: 'ሳር ቤት', name_en: 'Sar Bet', coords: [8.9980, 38.7360] },
  { name_am: 'ገርጂ', name_en: 'Gerji', coords: [9.0010, 38.8150] },
  { name_am: 'አያት', name_en: 'Ayat', coords: [9.0220, 38.8550] },
];

/**
 * Fetch a vehicular driving route between an array of waypoints [lat, lng] from OSRM.
 */
async function fetchOsrmDrivingPath(
  waypoints: [number, number][]
): Promise<{ coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null> {
  if (waypoints.length < 2) return null;
  try {
    const coordsParam = waypoints.map(([lat, lng]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const json = await resp.json();
    if (json.code !== 'Ok' || !json.routes?.[0]?.geometry?.coordinates) return null;

    const r = json.routes[0];
    const coordinates: [number, number][] = r.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    return {
      coordinates,
      distanceMeters: Math.round(r.distance),
      durationSeconds: Math.round(r.duration),
    };
  } catch {
    return null;
  }
}

/**
 * Fallback straight line with realistic curve points when offline.
 */
function createCurvedFallback(
  waypoints: [number, number][]
): { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } {
  let totalDist = 0;
  const coordinates: [number, number][] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const d = distanceMetres(p1[0], p1[1], p2[0], p2[1]);
    totalDist += d;
    // generate intermediate interpolation
    const steps = Math.max(5, Math.min(25, Math.round(d / 150)));
    for (let s = 0; s <= steps; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / steps;
      const lat = p1[0] + (p2[0] - p1[0]) * t;
      const lng = p1[1] + (p2[1] - p1[1]) * t;
      coordinates.push([lat, lng]);
    }
  }

  return {
    coordinates,
    distanceMeters: Math.round(totalDist),
    durationSeconds: Math.round((totalDist / 6.5) * 1.3),
  };
}

/**
 * Find the best corridor waypoint between start and end to form an alternative route choice.
 */
function findAlternativeCorridorWaypoint(
  start: [number, number],
  end: [number, number]
): { name_am: string; name_en: string; coords: [number, number] } | null {
  const directDist = distanceMetres(start[0], start[1], end[0], end[1]);
  if (directDist < 1200) return null; // Too close for meaningful alternative

  let bestCandidate: { name_am: string; name_en: string; coords: [number, number] } | null = null;
  let bestScore = Infinity;

  for (const hub of ADDIS_CORRIDOR_HUBS) {
    const dStart = distanceMetres(start[0], start[1], hub.coords[0], hub.coords[1]);
    const dEnd = distanceMetres(hub.coords[0], hub.coords[1], end[0], end[1]);

    // Ensure it's not right at the start or end
    if (dStart < 600 || dEnd < 600) continue;

    const detourDist = dStart + dEnd;
    const ratio = detourDist / directDist;

    // Ideal alternative detour ratio is between 1.1x and 1.45x direct distance
    if (ratio >= 1.08 && ratio <= 1.45) {
      // Pick the candidate closest to midpoint balance
      const balance = Math.abs(dStart - dEnd);
      if (balance < bestScore) {
        bestScore = balance;
        bestCandidate = hub;
      }
    }
  }

  return bestCandidate;
}

/**
 * Generate candidate real-road route choices between start and end coordinates.
 */
export async function generateRouteChoices(
  start: [number, number],
  end: [number, number],
  customStops: IntermediateStop[] = []
): Promise<RouteChoice[]> {
  const choices: RouteChoice[] = [];

  // 1. Primary Direct Corridor
  const directResult = (await fetchOsrmDrivingPath([start, end])) ?? createCurvedFallback([start, end]);
  choices.push({
    id: 'route_direct',
    title_am: 'ቀጥተኛ አውራ ጎዳና',
    title_en: 'Primary Direct Corridor',
    corridorDescription: `${(directResult.distanceMeters / 1000).toFixed(1)} km · ~${Math.max(1, Math.round(directResult.durationSeconds / 60))} min drive`,
    distanceMeters: directResult.distanceMeters,
    durationSeconds: directResult.durationSeconds,
    coordinates: directResult.coordinates,
    viaStops: [],
  });

  // 2. Alternative Arterial Corridor
  const altHub = findAlternativeCorridorWaypoint(start, end);
  if (altHub) {
    const altResult =
      (await fetchOsrmDrivingPath([start, altHub.coords, end])) ??
      createCurvedFallback([start, altHub.coords, end]);

    choices.push({
      id: 'route_alternative',
      title_am: `በ ${altHub.name_am} በኩል`,
      title_en: `Via ${altHub.name_en} Corridor`,
      corridorDescription: `Alternative via ${altHub.name_en} (${(altResult.distanceMeters / 1000).toFixed(1)} km)`,
      distanceMeters: altResult.distanceMeters,
      durationSeconds: altResult.durationSeconds,
      coordinates: altResult.coordinates,
      viaStops: [
        {
          id: 'hub_stop',
          name: altHub.name_en,
          lat: altHub.coords[0],
          lng: altHub.coords[1],
        },
      ],
    });
  }

  // 3. Custom Intermediate Stops Route (if provided)
  if (customStops.length > 0) {
    const waypoints: [number, number][] = [
      start,
      ...customStops.map(s => [s.lat, s.lng] as [number, number]),
      end,
    ];
    const customResult = (await fetchOsrmDrivingPath(waypoints)) ?? createCurvedFallback(waypoints);

    choices.push({
      id: 'route_custom',
      title_am: `በተጠቃሚ የተመረጡ ማቆሚያዎች (${customStops.length})`,
      title_en: `Custom Waypoints Route (${customStops.length} stops)`,
      corridorDescription: `${customStops.map(s => s.name).join(' ➔ ')} (${(customResult.distanceMeters / 1000).toFixed(1)} km)`,
      distanceMeters: customResult.distanceMeters,
      durationSeconds: customResult.durationSeconds,
      coordinates: customResult.coordinates,
      viaStops: customStops,
    });
  }

  return choices;
}
