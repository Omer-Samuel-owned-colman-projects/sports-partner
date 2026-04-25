const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export type VenueDayWeather = {
  tempC: number;
  rainMm: number;
};

type GeocodeHit = { latitude: number; longitude: number; timezone: string };

function dateKeyInTimeZone(iso: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(iso);
}

async function geocodeVenue(venueName: string, city: string): Promise<GeocodeHit | null> {
  const trySearch = async (q: string) => {
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { latitude: number; longitude: number; timezone: string }[];
    };
    const first = data.results?.[0];
    if (!first?.timezone) return null;
    return {
      latitude: first.latitude,
      longitude: first.longitude,
      timezone: first.timezone,
    };
  };

  let hit = await trySearch(`${venueName}, ${city}`);
  if (!hit) {
    hit = await trySearch(city);
  }
  return hit;
}

/** Geocode + daily forecast. Callers should gate traffic (e.g. DB + stale/final rules in gameWeather). */
export async function fetchVenueDayWeather(params: {
  venueName: string;
  city: string;
  scheduledAt: string | Date;
}): Promise<VenueDayWeather | null> {
  const coords = await geocodeVenue(params.venueName, params.city);
  if (!coords) return null;

  const when = new Date(params.scheduledAt);
  const dateKey = dateKeyInTimeZone(when, coords.timezone);

  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(coords.latitude));
  url.searchParams.set('longitude', String(coords.longitude));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('start_date', dateKey);
  url.searchParams.set('end_date', dateKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = (await res.json()) as {
    daily?: {
      time: string[];
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
      precipitation_sum?: (number | null)[];
    };
  };

  const idx = data.daily?.time?.indexOf(dateKey) ?? -1;
  if (idx < 0 || !data.daily) return null;

  const max = data.daily.temperature_2m_max?.[idx];
  const min = data.daily.temperature_2m_min?.[idx];
  const rain = data.daily.precipitation_sum?.[idx];

  if (max == null && min == null) return null;

  const tempC =
    max != null && min != null
      ? Math.round((max + min) / 2)
      : Math.round((max ?? min) as number);

  const rainMm = rain != null ? Math.round(rain * 10) / 10 : 0;

  return { tempC, rainMm };
}
