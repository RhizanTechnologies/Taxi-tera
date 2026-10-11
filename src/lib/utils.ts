import type { Station, Line } from '../types';

/** Haversine distance between two lat/lng points, in metres. */
export function distanceMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Validate fare is an integer between 1 and 500 */
export function isValidFare(v: string): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 500;
}

/** Validate lat/lng is inside the Addis Ababa bounding box */
export function isInsideAddis(lat: number, lng: number): boolean {
  return lat >= 8.8 && lat <= 9.2 && lng >= 38.6 && lng <= 38.95;
}

/** Pick the right locale string, falling back to the other language */
export function pickName(
  am: string | null | undefined,
  en: string | null | undefined,
  lang: string,
): string {
  if (lang === 'am') return am || en || '';
  return en || am || '';
}

/**
 * Phonetic dictionary mapping Ethiopian urban transit place names
 * from Ge'ez / Amharic to English phonetic variants and aliases.
 */
export const ADDIS_PHONETIC_SYNONYMS: Record<string, string[]> = {
  'መገናኛ': ['megenagna', 'megnagna', 'meganana', 'meganagna', 'lem', 'meg'],
  'ሜክሲኮ': ['mexico', 'meksiko', 'mex', 'lebu'],
  'ቦሌ': ['bole', 'bol', 'medhanialem', 'medhanealem', 'atlas', 'brass', 'bulbula', 'rwanda', 'mikael', 'michael'],
  'ፒያሳ': ['piassa', 'piasa', 'pia', 'giorgis', 'degaulle', 'de gaulle'],
  'አራት ኪሎ': ['arat kilo', '4 kilo', '4kilo', '4 kilo', '4k', 'aratkilo', 'ginfle', 'arat'],
  'ስድስት ኪሎ': ['sidist kilo', '6 kilo', '6kilo', '6k', 'sidistkilo', 'sidist'],
  'ሳሪስ': ['saris', 'sar', 'abo', 'total', 'adey', 'shoa', 'sarise'],
  'ቃሊቲ': ['kality', 'kaliti', 'alembank', 'maseltegna', 'gelan'],
  'አየር ጤና': ['ayer tena', 'ayertena', 'ayar tena', 'ayer'],
  'ካዛንቺስ': ['kazanchis', 'kasantshis', 'kasanchis', 'kazanches', 'kazan'],
  'መርካቶ': ['merkato', 'mercato', 'autobus tera', 'atobis tera', 'autobis', 'autobus'],
  'ጦር ኃይሎች': ['tor hailoch', 'torhailoch', 'tor', 'abenet', 'torhailoch'],
  'ሽሮሜዳ': ['shiromeda', 'shiro meda', 'shiro'],
  'ለቡ': ['lebu', 'haile garment', 'garment'],
  'ገርጂ': ['gerji', 'roba', 'sunshine', 'mebrat hayl'],
  'ሲኤምሲ': ['cmc', 'michael'],
  'አያት': ['ayat', 'derartu', 'zone'],
  'ጎሮ': ['goro'],
  'ሰሚት': ['semit', 'summit', 'safari'],
  'ሾላ': ['shola', 'gebeya'],
  'ጀሞ': ['jemo', 'jemo 1', 'jemo 3'],
  'በቅሎ ቤት': ['beklo bet', 'baqlo bet', 'beklobet', 'lomi meda'],
  'ተመንጃ ያዥ': ['temenja yazh', 'temenjayazh', 'temenja'],
  'ጎተራ': ['gotera', 'agona', 'oilibya'],
  'ላንቺያ': ['lancia', 'lanchiya'],
  'ሪቼ': ['riche', 'richi'],
  'ስታዲየም': ['stadium', 'estadiyom'],
  'ላምበረት': ['lamberet', 'lam bert', 'lamberat'],
  'አስኮ': ['asko'],
  'ዘነበወርቅ': ['zenebework', 'zenbwork', 'zenbework'],
  'ቤቴል': ['bethel', 'betel'],
  'ዓለም ባንክ': ['alem bank', 'alembank', 'alem'],
  'ፈረንሳይ': ['ferensay', 'ferensai', 'gurara'],
  'ብሔራዊ': ['beherawi', 'national', 'theatre', 'theater'],
  'ለገሃር': ['legehar', 'lagahar'],
  'ካዲስኮ': ['kadisco', 'kadisko'],
  'ማሰልጠኛ': ['maseltegna', 'maseltegna'],
  'አባዶ': ['abado'],
  'ገላን': ['gelan'],
  'ጨርቆስ': ['cherkos', 'kirkos'],
  'ቂርቆስ': ['kirkos', 'cherkos'],
  'ሳርቤት': ['sarbet', 'sar bet', 'bisrate gabriel'],
  'መካኒሳ': ['mekanisa', 'mikanisa', 'kore'],
  'ኮተቤ': ['kotebe', 'hana'],
  'ሎሚ ሜዳ': ['lomi meda', 'lomimeda'],
  'አጠና ተራ': ['atena tera', 'atenatera'],
  'ዮሴፍ': ['yoseph', 'joseph'],
  'ኢየሱስ': ['iyesus', 'eyesus', '41'],
  'ቅድስት ማርያም': ['kidiste mariam', 'kidste mariam', 'mariam'],
  'ቤላ': ['bella', 'bela'],
};

// Ge'ez character ranges to Latin phonetic representation
const GE_EZ_OFFSET_MAP: Record<number, [string, string[]]> = {
  0x1200: ['h', ['he', 'hu', 'hi', 'ha', 'hie', 'h', 'ho']],
  0x1208: ['l', ['le', 'lu', 'li', 'la', 'lie', 'l', 'lo']],
  0x1210: ['h', ['he', 'hu', 'hi', 'ha', 'hie', 'h', 'ho']],
  0x1218: ['m', ['me', 'mu', 'mi', 'ma', 'mie', 'm', 'mo']],
  0x1220: ['s', ['se', 'su', 'si', 'sa', 'sie', 's', 'so']],
  0x1228: ['r', ['re', 'ru', 'ri', 'ra', 'rie', 'r', 'ro']],
  0x1230: ['s', ['se', 'su', 'si', 'sa', 'sie', 's', 'so']],
  0x1238: ['sh', ['she', 'shu', 'shi', 'sha', 'shie', 'sh', 'sho']],
  0x1240: ['q', ['qe', 'qu', 'qi', 'qa', 'qie', 'q', 'qo']],
  0x1260: ['b', ['be', 'bu', 'bi', 'ba', 'bie', 'b', 'bo']],
  0x1270: ['t', ['te', 'tu', 'ti', 'ta', 'tie', 't', 'to']],
  0x1278: ['ch', ['che', 'chu', 'chi', 'cha', 'chie', 'ch', 'cho']],
  0x1280: ['h', ['he', 'hu', 'hi', 'ha', 'hie', 'h', 'ho']],
  0x1290: ['n', ['ne', 'nu', 'ni', 'na', 'nie', 'n', 'no']],
  0x1298: ['gn', ['gne', 'gnu', 'gni', 'gna', 'gnie', 'gn', 'gno']],
  0x12A0: ['a', ['a', 'u', 'i', 'a', 'e', 'e', 'o']],
  0x12A8: ['k', ['ke', 'ku', 'ki', 'ka', 'kie', 'k', 'ko']],
  0x12C8: ['w', ['we', 'wu', 'wi', 'wa', 'wie', 'w', 'wo']],
  0x12D0: ['a', ['a', 'u', 'i', 'a', 'e', 'e', 'o']],
  0x12D8: ['z', ['ze', 'zu', 'zi', 'za', 'zie', 'z', 'zo']],
  0x12E0: ['zh', ['zhe', 'zhu', 'zhi', 'zha', 'zhie', 'zh', 'zho']],
  0x12E8: ['y', ['ye', 'yu', 'yi', 'ya', 'yie', 'y', 'yo']],
  0x12F0: ['d', ['de', 'du', 'di', 'da', 'die', 'd', 'do']],
  0x12F8: ['j', ['je', 'ju', 'ji', 'ja', 'jie', 'j', 'jo']],
  0x1300: ['g', ['ge', 'gu', 'gi', 'ga', 'gie', 'g', 'go']],
  0x1320: ['t', ['te', 'tu', 'ti', 'ta', 'tie', 't', 'to']],
  0x1328: ['ch', ['che', 'chu', 'chi', 'cha', 'chie', 'ch', 'cho']],
  0x1330: ['p', ['pe', 'pu', 'pi', 'pa', 'pie', 'p', 'po']],
  0x1338: ['ts', ['tse', 'tsu', 'tsi', 'tsa', 'tsie', 'ts', 'tso']],
  0x1340: ['ts', ['tse', 'tsu', 'tsi', 'tsa', 'tsie', 'ts', 'tso']],
  0x1348: ['f', ['fe', 'fu', 'fi', 'fa', 'fie', 'f', 'fo']],
  0x1350: ['p', ['pe', 'pu', 'pi', 'pa', 'pie', 'p', 'po']],
};

/** Converts Ge'ez / Amharic text to phonetic Latin representation */
export function transliterateGeEz(text: string): string {
  if (!text) return '';
  const result: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let matched = false;
    for (const [baseStr, [, forms]] of Object.entries(GE_EZ_OFFSET_MAP)) {
      const base = Number(baseStr);
      if (code >= base && code < base + 8) {
        const offset = code - base;
        if (offset < forms.length) {
          result.push(forms[offset]);
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      result.push(text[i]);
    }
  }
  return result.join('').toLowerCase();
}

/**
 * Normalizes Amharic homophones (letters that sound identical but have different orthography):
 * - ሐ, ኀ, ኻ -> ሀ
 * - ሠ -> ሰ
 * - ዐ -> አ
 * - ፀ -> ጸ
 * This ensures "ዓለም ባንክ" matches "አለም ባንክ", "ኃይሌ" matches "ሀይሌ", "ሠላም" matches "ሰላም", etc.
 */
export function normalizeEthiopicHomophones(text: string): string {
  if (!text) return '';
  return text
    // ሐ series -> ሀ
    .replace(/[ሐሓ]/g, 'ሀ').replace(/ሑ/g, 'ሁ').replace(/ሒ/g, 'ሂ').replace(/ሔ/g, 'ሄ').replace(/ሕ/g, 'ህ').replace(/ሖ/g, 'ሆ')
    // ኀ/ኃ series -> ሀ
    .replace(/[ኀኃ]/g, 'ሀ').replace(/[ኁኂ]/g, 'ሁ').replace(/ኂ/g, 'ሂ').replace(/ኄ/g, 'ሄ').replace(/ኅ/g, 'ህ').replace(/ኆ/g, 'ሆ')
    // ሠ series -> ሰ
    .replace(/[ሠሣ]/g, 'ሰ').replace(/ሡ/g, 'ሱ').replace(/ሢ/g, 'ሲ').replace(/ሤ/g, 'ሴ').replace(/ሥ/g, 'ስ').replace(/ሦ/g, 'ሶ')
    // ዐ series -> አ
    .replace(/[ዐዓኣ]/g, 'አ').replace(/ዑ/g, 'ኡ').replace(/ዒ/g, 'ኢ').replace(/ዔ/g, 'ኤ').replace(/ዕ/g, 'እ').replace(/ዖ/g, 'ኦ')
    // ፀ series -> ጸ
    .replace(/[ፀፃ]/g, 'ጸ').replace(/ፁ/g, 'ጹ').replace(/ፂ/g, 'ጺ').replace(/ፄ/g, 'ጼ').replace(/ፅ/g, 'ጽ').replace(/ፆ/g, 'ጾ')
    // ጰ -> ጳ
    .replace(/ጰ/g, 'ጳ');
}

export interface StationSearchMatchResult {
  matched: boolean;
  score: number;
  matchedLine?: Line;
}

/**
 * Universal bilingual search matcher:
 * - Matches English queries against English fields (name_en, landmark_en, destination_en)
 * - Matches English queries against Amharic fields using phonetic transliteration and transit aliases
 * - Matches Amharic queries against Amharic fields with full homophone letter normalization (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ)
 * - Handles numbers & common abbreviations ("4 kilo", "4k", "6 kilo", "cmc", etc.)
 */
export function matchesStationBilingualSearch(
  st: Station,
  rawQuery: string,
  lines?: Line[]
): StationSearchMatchResult {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return { matched: true, score: 0 };

  const nameEn = (st.name_en || '').toLowerCase();
  const nameAm = (st.name_am || '').toLowerCase();
  const landmarkEn = (st.landmark_en || '').toLowerCase();
  const landmarkAm = (st.landmark_am || '').toLowerCase();

  // 1. Direct match on English or Amharic station name
  if (nameEn === query || nameAm === query) {
    return { matched: true, score: 100 };
  }
  if (nameEn.startsWith(query) || nameAm.startsWith(query)) {
    return { matched: true, score: 90 };
  }
  if (nameEn.includes(query) || nameAm.includes(query)) {
    return { matched: true, score: 80 };
  }

  // 2. Homophone-normalized Amharic match (e.g. "ዓለም ባንክ" <-> "አለም ባንክ", "ኃይሌ" <-> "ሀይሌ")
  const normQuery = normalizeEthiopicHomophones(query);
  const normNameAm = normalizeEthiopicHomophones(nameAm);
  const normLandmarkAm = normalizeEthiopicHomophones(landmarkAm);

  if (normNameAm === normQuery) {
    return { matched: true, score: 95 };
  }
  if (normNameAm.startsWith(normQuery)) {
    return { matched: true, score: 88 };
  }
  if (normNameAm.includes(normQuery) || (normQuery.length >= 3 && normQuery.includes(normNameAm))) {
    return { matched: true, score: 82 };
  }
  if (normLandmarkAm.includes(normQuery)) {
    return { matched: true, score: 68 };
  }

  // 3. Direct match on Landmark or Corridor
  if (landmarkEn.includes(query) || landmarkAm.includes(query)) {
    return { matched: true, score: 65 };
  }

  // 4. Match on connected lines (destination in English or Amharic)
  if (lines && lines.length > 0) {
    const stationLines = lines.filter((l) => l.station_id === st.id);
    for (const line of stationLines) {
      const destEn = (line.destination_en || '').toLowerCase();
      const destAm = (line.destination_am || '').toLowerCase();
      const normDestAm = normalizeEthiopicHomophones(destAm);

      if (destEn === query || destAm === query || normDestAm === normQuery) {
        return { matched: true, score: 75, matchedLine: line };
      }
      if (destEn.includes(query) || destAm.includes(query) || normDestAm.includes(normQuery)) {
        return { matched: true, score: 65, matchedLine: line };
      }
    }
  }

  // 4. Cross-language Phonetic & Alias Synonyms Match
  // E.g., user searches "mexico" -> matches "ሜክሲኮ"; searches "arat kilo" or "4 kilo" -> matches "አራት ኪሎ"
  for (const [amharicKey, latinSynonyms] of Object.entries(ADDIS_PHONETIC_SYNONYMS)) {
    const stationHasAmKey = nameAm.includes(amharicKey) || landmarkAm.includes(amharicKey);
    if (stationHasAmKey) {
      const matchesSynonym = latinSynonyms.some(
        (syn) => syn.includes(query) || query.includes(syn)
      );
      if (matchesSynonym) {
        return { matched: true, score: 70 };
      }
    }
  }

  // Also check phonetic synonyms against connected line destinations
  if (lines && lines.length > 0) {
    const stationLines = lines.filter((l) => l.station_id === st.id);
    for (const line of stationLines) {
      const destAm = (line.destination_am || '').toLowerCase();
      for (const [amharicKey, latinSynonyms] of Object.entries(ADDIS_PHONETIC_SYNONYMS)) {
        if (destAm.includes(amharicKey)) {
          if (latinSynonyms.some((syn) => syn.includes(query) || query.includes(syn))) {
            return { matched: true, score: 60, matchedLine: line };
          }
        }
      }
    }
  }

  // 5. Algorithmic Ge'ez Transliteration Match
  const translitName = transliterateGeEz(nameAm);
  if (translitName.includes(query) || query.includes(translitName)) {
    return { matched: true, score: 65 };
  }

  return { matched: false, score: 0 };
}

/** Format a date as relative ("2 days ago") */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Compress image file in-browser: resize to maxPx on longest side, quality 0.75 */
export async function compressImage(file: File, maxPx = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/webp',
        0.75,
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Generate a simple UUID (crypto-based) */
export const uuid = () => crypto.randomUUID();

/** Favorites persistence in localStorage */
export function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem('tt-favorites') ?? '[]');
  } catch {
    return [];
  }
}

export function isStationFavorite(id: string): boolean {
  return getFavorites().includes(id);
}

export function toggleStationFavorite(id: string): boolean {
  const current = getFavorites();
  const exists = current.includes(id);
  const next = exists ? current.filter(x => x !== id) : [...current, id];
  localStorage.setItem('tt-favorites', JSON.stringify(next));
  return !exists;
}

/**
 * Realistic urban pedestrian walking model for Addis Ababa:
 * - Walking speed: 4.5 km/h = 75 meters / min = 1.25 m/s.
 * - Urban circuity factor: ~1.25x for straight-line Euclidean distance to street walking distance.
 */
export const ADDIS_WALKING_SPEED_METERS_PER_MIN = 75;
export const ADDIS_WALKING_SPEED_MPS = 1.25;
export const URBAN_CIRCUITY_FACTOR = 1.25;

/**
 * Calculates realistic walking minutes from distance in meters.
 * @param distanceMeters Distance in meters.
 * @param isStraightLine If true, applies urban circuity factor (1.25x) to account for street detours.
 */
export function calculateWalkingMinutes(distanceMeters: number, isStraightLine = false): number {
  if (distanceMeters <= 0) return 1;
  const effectiveMeters = isStraightLine ? distanceMeters * URBAN_CIRCUITY_FACTOR : distanceMeters;
  return Math.max(1, Math.round(effectiveMeters / ADDIS_WALKING_SPEED_METERS_PER_MIN));
}

/**
 * Cleanly format distance:
 * - Below 1000m: e.g. "450 m"
 * - 1000m and above: e.g. "1.7 km"
 */
export function formatDistance(distanceMeters: number): string {
  const rounded = Math.round(distanceMeters);
  if (rounded < 1000) {
    return `${rounded} m`;
  }
  const km = rounded / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Formats walking duration with appropriate units:
 * - e.g. "23 min" or "1h 15m" (or Amharic "23 ደቂቃ", "1 ሰዓት 15 ደቂቃ")
 */
export function formatWalkingTime(minutes: number, lang = 'en'): string {
  if (minutes < 60) {
    return lang === 'am' ? `${minutes} ደቂቃ` : `${minutes} min`;
  }
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (lang === 'am') {
    return rem > 0 ? `${hrs} ሰዓት ከ ${rem} ደቂቃ` : `${hrs} ሰዓት`;
  }
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

