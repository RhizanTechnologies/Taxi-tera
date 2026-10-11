import type { Station, Line, TransitJourney, TransitStep } from '../types';
import { distanceMetres, ADDIS_WALKING_SPEED_MPS, pickName } from './utils';

/** Average urban minibus speed in Addis Ababa traffic: 22 km/h = ~366 m/min = 6.1 m/s */
const ADDIS_TAXI_SPEED_MPS = 6.1;

/** Average waiting/queue time at a station */
const STATION_QUEUE_WAIT_SECONDS = 300; // 5 min

/** Average waiting time to hail passing taxi on street */
const STREET_HAIL_WAIT_SECONDS = 180; // 3 min

/** Maximum distance (meters) to consider user standing right along a taxi's corridor */
const CORRIDOR_INTERCEPT_THRESHOLD_METERS = 650;

/** Maximum walking distance to an initial boarding station */
const MAX_WALK_TO_STATION_METERS = 2000;

/** Maximum walking distance between transfer stations */
const MAX_TRANSFER_WALK_METERS = 600;

/**
 * Predicts the destination station from line destination text or return_station_id.
 */
export function predictDestinationStation(
  line: Line,
  allStations: Station[]
): Station | null {
  if (line.return_station_id) {
    const matched = allStations.find(s => s.id === line.return_station_id);
    if (matched) return matched;
  }

  const destEn = (line.destination_en || '').toLowerCase().trim();
  const destAm = (line.destination_am || '').trim();

  // Normalize keywords for known Addis hubs
  const normalizeHub = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes('shiro') || t.includes('ሽሮ')) return 'shiromeda';
    if (t.includes('arat') || t.includes('4 kilo') || t.includes('4 ኪሎ') || t.includes('ginfle') || t.includes('ጊንፍሌ')) return '4 kilo';
    if (t.includes('sidist') || t.includes('6 kilo') || t.includes('6 ኪሎ')) return '6 kilo';
    if (t.includes('mexico') || t.includes('ሜክሲኮ')) return 'mexico';
    if (t.includes('megenagna') || t.includes('መገናኛ')) return 'megenagna';
    if (t.includes('bole') || t.includes('ቦሌ')) return 'bole';
    if (t.includes('piassa') || t.includes('ፒያሳ') || t.includes('giorgis') || t.includes('ጊዮርጊስ')) return 'piassa';
    if (t.includes('merkato') || t.includes('መርካቶ')) return 'merkato';
    if (t.includes('saris') || t.includes('ሳሪስ')) return 'saris';
    if (t.includes('kality') || t.includes('ቃሊቲ')) return 'kality';
    if (t.includes('stadium') || t.includes('ስታዲየም')) return 'stadium';
    if (t.includes('tor') || t.includes('ጦር')) return 'tor hailoch';
    if (t.includes('jemo') || t.includes('ጀሞ')) return 'jemo';
    if (t.includes('gerji') || t.includes('ገርጂ')) return 'gerji';
    if (t.includes('goro') || t.includes('ጎሮ')) return 'goro';
    if (t.includes('ayer') || t.includes('አየር')) return 'ayer tena';
    if (t.includes('addisu') || t.includes('አዲሱ')) return 'addisu gebeya';
    return t;
  };

  const normEn = normalizeHub(destEn);
  const normAm = normalizeHub(destAm);

  // Exact or alias match
  for (const st of allStations) {
    const sNameEn = (st.name_en || '').toLowerCase();
    const sNameAm = (st.name_am || '');
    if (sNameEn.includes(normEn) || normEn.includes(sNameEn)) return st;
    if (sNameAm.includes(normAm) || (normAm && normAm.includes(sNameAm))) return st;
    if (normEn === '4 kilo' && (sNameEn.includes('arat') || sNameEn.includes('4 kilo'))) return st;
    if (normEn === '6 kilo' && (sNameEn.includes('sidist') || sNameEn.includes('6 kilo'))) return st;
  }

  return null;
}

/**
 * Projects point P onto segment AB.
 * Returns the nearest point on AB and the perpendicular distance in meters.
 */
function projectPointOnSegment(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): { point: [number, number]; distanceMeters: number; ratio: number } {
  const abDist = distanceMetres(aLat, aLng, bLat, bLng);
  if (abDist < 1) {
    return {
      point: [aLat, aLng],
      distanceMeters: distanceMetres(pLat, pLng, aLat, aLng),
      ratio: 0,
    };
  }

  // Linear projection in equirectangular projection
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));

  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;
  const dist = distanceMetres(pLat, pLng, projLat, projLng);

  return {
    point: [projLat, projLng],
    distanceMeters: dist,
    ratio: t,
  };
}

export interface TransitSearchQuery {
  originCoords: [number, number];
  originName?: string;
  destinationStation: Station;
  allStations: Station[];
  allLines: Line[];
  lang: string;
}

/**
 * Multi-Leg Transit Router (Dijkstra / Shortest Path with Mid-Route Interception)
 */
export function findTransitJourneys(query: TransitSearchQuery): TransitJourney[] {
  const { originCoords, destinationStation, allStations, allLines } = query;
  const [oLat, oLng] = originCoords;
  const destCoords: [number, number] = [destinationStation.lat, destinationStation.lng];

  // Group lines by station
  const stationLines = new Map<string, Line[]>();
  for (const l of allLines) {
    if (!stationLines.has(l.station_id)) stationLines.set(l.station_id, []);
    stationLines.get(l.station_id)!.push(l);
  }

  const candidateJourneys: TransitJourney[] = [];

  // 1. Direct Walking Check (if destination is very close)
  const directWalkDist = distanceMetres(oLat, oLng, destCoords[0], destCoords[1]);
  if (directWalkDist <= 900) {
    const walkMins = Math.max(1, Math.round(directWalkDist / (ADDIS_WALKING_SPEED_MPS * 60)));
    candidateJourneys.push({
      id: 'direct-walk',
      label: 'least_walking',
      totalDurationMinutes: walkMins,
      totalDistanceMeters: directWalkDist,
      totalFareBirr: 0,
      transfersCount: 0,
      summaryTitle_am: 'ቀጥታ በእግር',
      summaryTitle_en: 'Direct Walk',
      steps: [{
        kind: 'walk_to_station',
        title_am: `ወደ ${pickName(destinationStation.name_am, destinationStation.name_en, 'am')} በእግር ሂድ`,
        title_en: `Walk directly to ${pickName(destinationStation.name_am, destinationStation.name_en, 'en')}`,
        distanceMeters: directWalkDist,
        durationMinutes: walkMins,
        fromCoords: originCoords,
        toCoords: destCoords,
      }],
      geometrySegments: [{
        type: 'walk',
        coordinates: [originCoords, destCoords],
      }],
    });
  }

  // 2. Scan All Lines for:
  //    A) Direct taxi to destination (either boarded at station OR intercepted mid-route)
  //    B) 1-Transfer routes (Origin -> Transfer Hub -> Destination)

  for (const startStation of allStations) {
    const lines = stationLines.get(startStation.id) || [];

    for (const line of lines) {
      const endStation = predictDestinationStation(line, allStations);
      if (!endStation) continue;

      const corridorProj = projectPointOnSegment(
        oLat, oLng,
        startStation.lat, startStation.lng,
        endStation.lat, endStation.lng
      );

      const isAlongCorridor = corridorProj.distanceMeters <= CORRIDOR_INTERCEPT_THRESHOLD_METERS;
      const walkToStartDist = distanceMetres(oLat, oLng, startStation.lat, startStation.lng);

      // Can commuter catch this taxi?
      // Either standing along its road corridor, or walking to start station
      const canCatch = isAlongCorridor || walkToStartDist <= MAX_WALK_TO_STATION_METERS;
      if (!canCatch) continue;

      const boardPoint: [number, number] = isAlongCorridor
        ? corridorProj.point
        : [startStation.lat, startStation.lng];

      const initialWalkDist = isAlongCorridor ? corridorProj.distanceMeters : walkToStartDist;
      const initialWalkMins = Math.round(initialWalkDist / (ADDIS_WALKING_SPEED_MPS * 60));
      const waitMins = isAlongCorridor
        ? Math.round(STREET_HAIL_WAIT_SECONDS / 60)
        : Math.round(STATION_QUEUE_WAIT_SECONDS / 60);

      // --- CASE A: Direct taxi line to final destination! ---
      if (endStation.id === destinationStation.id) {
        const rideDist = distanceMetres(boardPoint[0], boardPoint[1], endStation.lat, endStation.lng);
        const rideMins = Math.max(3, Math.round(rideDist / (ADDIS_TAXI_SPEED_MPS * 60)));
        const totalDuration = initialWalkMins + waitMins + rideMins;

        const steps: TransitStep[] = [];
        if (isAlongCorridor) {
          steps.push({
            kind: 'intercept_taxi',
            title_am: `${pickName(line.destination_am, line.destination_en, 'am')} ታክሲ በመንገድህ ላይ ያዝ`,
            title_en: `Catch passing taxi to ${pickName(line.destination_am, line.destination_en, 'en')} right on your road`,
            desc_am: `ታክሲው በመንገድህ በኩል ያልፋል (${Math.round(initialWalkDist)} ሜትር ርቀት)። ወያላው "${pickName(line.destination_am, line.destination_en, 'am')}" ሲል አቁም`,
            desc_en: `This taxi line runs right along your road (${Math.round(initialWalkDist)}m away). Hail the woyala calling "${pickName(line.destination_am, line.destination_en, 'en')}"`,
            distanceMeters: initialWalkDist,
            durationMinutes: initialWalkMins + waitMins,
            fromCoords: originCoords,
            toCoords: boardPoint,
            station: startStation,
            line,
            woyalaCallout: line.destination_am || undefined,
          });
        } else {
          steps.push({
            kind: 'walk_to_station',
            title_am: `ወደ ${pickName(startStation.name_am, startStation.name_en, 'am')} በእግር ሂድ`,
            title_en: `Walk to ${pickName(startStation.name_am, startStation.name_en, 'en')}`,
            desc_am: startStation.landmark_am || undefined,
            desc_en: startStation.landmark_en || undefined,
            distanceMeters: initialWalkDist,
            durationMinutes: initialWalkMins,
            fromCoords: originCoords,
            toCoords: boardPoint,
            station: startStation,
          });
        }

        steps.push({
          kind: 'ride_taxi',
          title_am: `የታክሲ ጉዞ ወደ ${pickName(endStation.name_am, endStation.name_en, 'am')}`,
          title_en: `Taxi ride to ${pickName(endStation.name_am, endStation.name_en, 'en')}`,
          desc_am: line.direction ? `አቅጣጫ፡ ${line.direction}` : undefined,
          desc_en: line.direction ? `Direction: ${line.direction}` : undefined,
          distanceMeters: rideDist,
          durationMinutes: rideMins,
          fareBirr: line.fare_birr,
          fromCoords: boardPoint,
          toCoords: [endStation.lat, endStation.lng],
          station: endStation,
          line,
        });

        candidateJourneys.push({
          id: `direct-${line.id}-${isAlongCorridor ? 'intercept' : 'station'}`,
          label: 'direct',
          totalDurationMinutes: totalDuration,
          totalDistanceMeters: initialWalkDist + rideDist,
          totalFareBirr: line.fare_birr,
          transfersCount: 0,
          summaryTitle_am: `ቀጥታ ታክሲ ወደ ${pickName(endStation.name_am, endStation.name_en, 'am')}`,
          summaryTitle_en: `Direct Taxi to ${pickName(endStation.name_en, endStation.name_am, 'en')}`,
          steps,
          geometrySegments: [
            { type: 'walk', coordinates: [originCoords, boardPoint] },
            { type: 'taxi_leg1', coordinates: [boardPoint, [endStation.lat, endStation.lng]] },
          ],
        });
        continue;
      }

      // --- CASE B: 1-Transfer Journey (Leg 1 to Transfer Hub -> Leg 2 to Destination) ---
      // Check if the transfer hub (endStation) has a connecting taxi to destinationStation
      const transferHub = endStation;

      // Also check any other station within short transfer walk of transferHub
      const nearbyTransferStations = allStations.filter(s =>
        s.id !== startStation.id &&
        distanceMetres(transferHub.lat, transferHub.lng, s.lat, s.lng) <= MAX_TRANSFER_WALK_METERS
      );

      for (const tStation of nearbyTransferStations) {
        const candidateLeg2Lines = stationLines.get(tStation.id) || [];

        for (const line2 of candidateLeg2Lines) {
          const finalStation = predictDestinationStation(line2, allStations);
          if (!finalStation || finalStation.id !== destinationStation.id) continue;

          // Valid 2-leg transfer found!
          const leg1Dist = distanceMetres(boardPoint[0], boardPoint[1], transferHub.lat, transferHub.lng);
          const leg1Mins = Math.max(3, Math.round(leg1Dist / (ADDIS_TAXI_SPEED_MPS * 60)));

          const transferWalkDist = distanceMetres(transferHub.lat, transferHub.lng, tStation.lat, tStation.lng);
          const transferWalkMins = Math.max(1, Math.round(transferWalkDist / (ADDIS_WALKING_SPEED_MPS * 60)));
          const leg2WaitMins = Math.round(STATION_QUEUE_WAIT_SECONDS / 60);

          const leg2Dist = distanceMetres(tStation.lat, tStation.lng, finalStation.lat, finalStation.lng);
          const leg2Mins = Math.max(3, Math.round(leg2Dist / (ADDIS_TAXI_SPEED_MPS * 60)));

          const totalDuration = initialWalkMins + waitMins + leg1Mins + transferWalkMins + leg2WaitMins + leg2Mins;
          const totalFare = line.fare_birr + line2.fare_birr;

          const steps: TransitStep[] = [];

          // Leg 1 Boarding
          if (isAlongCorridor) {
            steps.push({
              kind: 'intercept_taxi',
              title_am: `1ኛ ታክሲ፡ ወደ ${pickName(transferHub.name_am, transferHub.name_en, 'am')} በመንገድህ ላይ ያዝ`,
              title_en: `Leg 1: Catch passing taxi to ${pickName(transferHub.name_en, transferHub.name_am, 'en')} on your road`,
              desc_am: `ታክሲው በመንገድህ አጠገብ ያልፋል (${Math.round(initialWalkDist)} ሜትር)። ወያላው "${pickName(line.destination_am, line.destination_en, 'am')}" ሲል ያዝ`,
              desc_en: `Taxi passes along your street (${Math.round(initialWalkDist)}m away). Hail the assistant shouting "${pickName(line.destination_en, line.destination_am, 'en')}"`,
              distanceMeters: initialWalkDist,
              durationMinutes: initialWalkMins + waitMins,
              fromCoords: originCoords,
              toCoords: boardPoint,
              station: startStation,
              line,
              woyalaCallout: line.destination_am || undefined,
            });
          } else {
            steps.push({
              kind: 'walk_to_station',
              title_am: `ወደ ${pickName(startStation.name_am, startStation.name_en, 'am')} በእግር ሂድ`,
              title_en: `Walk to ${pickName(startStation.name_en, startStation.name_am, 'en')}`,
              desc_am: startStation.landmark_am || undefined,
              desc_en: startStation.landmark_en || undefined,
              distanceMeters: initialWalkDist,
              durationMinutes: initialWalkMins,
              fromCoords: originCoords,
              toCoords: boardPoint,
              station: startStation,
            });
          }

          // Leg 1 Ride
          steps.push({
            kind: 'ride_taxi',
            title_am: `በታክሲ ወደ ${pickName(transferHub.name_am, transferHub.name_en, 'am')} ተጓዝ (${line.fare_birr} ብር)`,
            title_en: `Ride taxi to ${pickName(transferHub.name_en, transferHub.name_am, 'en')} (${line.fare_birr} Br)`,
            desc_am: `በ${transferHub.landmark_am || 'ዋናው ተራ'} ወርደህ ተቀይር`,
            desc_en: `Alight at ${transferHub.landmark_en || 'main terminal'} to transfer`,
            distanceMeters: leg1Dist,
            durationMinutes: leg1Mins,
            fareBirr: line.fare_birr,
            fromCoords: boardPoint,
            toCoords: [transferHub.lat, transferHub.lng],
            station: transferHub,
            line,
          });

          // Transfer Walk (if needed)
          if (transferWalkDist > 20) {
            steps.push({
              kind: 'transfer_walk',
              title_am: `ወደ ${pickName(tStation.name_am, tStation.name_en, 'am')} ታክሲ ተራ ተሻገር`,
              title_en: `Walk across to ${pickName(tStation.name_en, tStation.name_am, 'en')} queue`,
              desc_am: `${Math.round(transferWalkDist)} ሜትር በእግር ወደ ሽሮሜዳ መስመር መነሻ`,
              desc_en: `${Math.round(transferWalkDist)}m walk to destination line queue`,
              distanceMeters: transferWalkDist,
              durationMinutes: transferWalkMins,
              fromCoords: [transferHub.lat, transferHub.lng],
              toCoords: [tStation.lat, tStation.lng],
              station: tStation,
            });
          }

          // Leg 2 Ride to Destination
          steps.push({
            kind: 'ride_taxi',
            title_am: `2ኛ ታክሲ፡ ወደ ${pickName(finalStation.name_am, finalStation.name_en, 'am')} ተጓዝ (${line2.fare_birr} ብር)`,
            title_en: `Leg 2: Take taxi to ${pickName(finalStation.name_en, finalStation.name_am, 'en')} (${line2.fare_birr} Br)`,
            desc_am: line2.direction ? `አቅጣጫ፡ ${line2.direction}` : undefined,
            desc_en: line2.direction ? `Direction: ${line2.direction}` : undefined,
            distanceMeters: leg2Dist,
            durationMinutes: leg2Mins + leg2WaitMins,
            fareBirr: line2.fare_birr,
            fromCoords: [tStation.lat, tStation.lng],
            toCoords: [finalStation.lat, finalStation.lng],
            station: finalStation,
            line: line2,
            woyalaCallout: line2.destination_am || undefined,
          });

          // Arrive at destination
          steps.push({
            kind: 'arrive_destination',
            title_am: `መዳረሻህ ደርሰሃል፡ ${pickName(finalStation.name_am, finalStation.name_en, 'am')}`,
            title_en: `Arrived at destination: ${pickName(finalStation.name_en, finalStation.name_am, 'en')}`,
            desc_am: finalStation.landmark_am || undefined,
            desc_en: finalStation.landmark_en || undefined,
            distanceMeters: 0,
            durationMinutes: 0,
            fromCoords: [finalStation.lat, finalStation.lng],
            toCoords: [finalStation.lat, finalStation.lng],
            station: finalStation,
          });

          candidateJourneys.push({
            id: `transfer-${line.id}-${line2.id}-${isAlongCorridor ? 'intercept' : 'station'}`,
            label: 'fastest',
            totalDurationMinutes: totalDuration,
            totalDistanceMeters: initialWalkDist + leg1Dist + transferWalkDist + leg2Dist,
            totalFareBirr: totalFare,
            transfersCount: 1,
            summaryTitle_am: `በ${pickName(transferHub.name_am, transferHub.name_en, 'am')} ቅያሪ ወደ ${pickName(finalStation.name_am, finalStation.name_en, 'am')}`,
            summaryTitle_en: `Via ${pickName(transferHub.name_en, transferHub.name_am, 'en')} to ${pickName(finalStation.name_en, finalStation.name_am, 'en')}`,
            steps,
            geometrySegments: [
              { type: 'walk', coordinates: [originCoords, boardPoint] },
              { type: 'taxi_leg1', coordinates: [boardPoint, [transferHub.lat, transferHub.lng]] },
              ...(transferWalkDist > 20 ? [{ type: 'walk' as const, coordinates: [[transferHub.lat, transferHub.lng], [tStation.lat, tStation.lng]] as [number, number][] }] : []),
              { type: 'taxi_leg2', coordinates: [[tStation.lat, tStation.lng], [finalStation.lat, finalStation.lng]] },
            ],
          });
        }
      }
    }
  }

  // Deduplicate and rank journeys
  if (candidateJourneys.length === 0) return [];

  // Sort by weighted cost: Duration + Transfer penalty (8 min) + Walking penalty
  candidateJourneys.sort((a, b) => {
    const costA = a.totalDurationMinutes + (a.transfersCount * 8) + (a.totalDistanceMeters * 0.002);
    const costB = b.totalDurationMinutes + (b.transfersCount * 8) + (b.totalDistanceMeters * 0.002);
    return costA - costB;
  });

  // Assign distinct user labels
  const topJourneys: TransitJourney[] = [];
  const fastest = candidateJourneys[0];
  topJourneys.push({ ...fastest, label: fastest.transfersCount === 0 ? 'direct' : 'fastest' });

  // Find least walking option
  const leastWalking = [...candidateJourneys]
    .filter(j => j.id !== fastest.id)
    .sort((a, b) => {
      const walkA = a.steps.filter(s => s.kind === 'walk_to_station' || s.kind === 'intercept_taxi' || s.kind === 'transfer_walk')
        .reduce((sum, s) => sum + s.distanceMeters, 0);
      const walkB = b.steps.filter(s => s.kind === 'walk_to_station' || s.kind === 'intercept_taxi' || s.kind === 'transfer_walk')
        .reduce((sum, s) => sum + s.distanceMeters, 0);
      return walkA - walkB;
    })[0];

  if (leastWalking) {
    topJourneys.push({ ...leastWalking, label: 'least_walking' });
  }

  // Find cheapest option
  const cheapest = [...candidateJourneys]
    .filter(j => j.id !== fastest.id && (!leastWalking || j.id !== leastWalking.id))
    .sort((a, b) => a.totalFareBirr - b.totalFareBirr)[0];

  if (cheapest) {
    topJourneys.push({ ...cheapest, label: 'cheapest' });
  }

  return topJourneys.slice(0, 3);
}

const roadCache = new Map<string, [number, number][]>();

/**
 * Fetches real road coordinates using OSRM Driving / OpenStreetMap Foot routing
 * so that routes trace actual streets, curves, and highways (never straight lines across hills).
 */
export async function fetchRealRoadCoordinates(
  from: [number, number],
  to: [number, number],
  mode: 'driving' | 'walking'
): Promise<[number, number][]> {
  const cacheKey = `${mode}:${from[0].toFixed(5)},${from[1].toFixed(5)}->${to[0].toFixed(5)},${to[1].toFixed(5)}`;
  if (roadCache.has(cacheKey)) {
    return roadCache.get(cacheKey)!;
  }

  try {
    let url = '';
    if (mode === 'walking') {
      url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    } else {
      url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    }

    let res = await fetch(url).catch(() => null);
    if (!res || !res.ok) {
      if (mode === 'walking') {
        url = `https://router.project-osrm.org/route/v1/walking/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      } else {
        url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      }
      res = await fetch(url).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0 && data.routes[0].geometry?.coordinates) {
        // GeoJSON [lng, lat] -> Leaflet [lat, lng]
        const points: [number, number][] = data.routes[0].geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        if (points.length > 1) {
          roadCache.set(cacheKey, points);
          return points;
        }
      }
    }
  } catch (err) {
    console.warn('Real road geometry fetch failed, fallback', err);
  }

  return [from, to];
}

/**
 * Hydrates all segments in a journey with real street network polylines
 */
export async function hydrateJourneyWithRealRoads(journey: TransitJourney): Promise<TransitJourney> {
  const updatedSegments = await Promise.all(
    journey.geometrySegments.map(async (seg) => {
      if (seg.coordinates.length < 2) return seg;
      const start = seg.coordinates[0];
      const end = seg.coordinates[seg.coordinates.length - 1];
      const mode = seg.type === 'walk' ? 'walking' : 'driving';
      const realPoints = await fetchRealRoadCoordinates(start, end, mode);
      return {
        ...seg,
        coordinates: realPoints,
      };
    })
  );

  return {
    ...journey,
    geometrySegments: updatedSegments,
  };
}

