import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { games } from '../db/schema.js';
import { fetchVenueDayWeather } from './openMeteo.js';
import type { Game, GameDetail } from '../types/games.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const TWO_DAYS_MS = 2 * DAY_MS;

const WEATHER_STALE_MS = 12 * HOUR_MS;

export type GameRowWeatherFields = {
  id: number;
  scheduledAt: Date;
  venue: { id: number; name: string; city: string };
  weatherTempC: number | null;
  weatherRainMm: number | null;
  weatherFetchedAt: Date | null;
  weatherFinal: boolean;
};

function shouldCallOpenMeteo(row: GameRowWeatherFields, nowMs: number): boolean {
  const scheduled = row.scheduledAt.getTime();
  if (scheduled <= nowMs) return false;

  const untilMs = scheduled - nowMs;
  if (untilMs > SEVEN_DAYS_MS) return false;

  if (row.weatherFinal) return false;

  if (untilMs <= TWO_DAYS_MS) {
    return true;
  }

  if (row.weatherFetchedAt == null) return true;
  return nowMs - row.weatherFetchedAt.getTime() >= WEATHER_STALE_MS;
}

export async function refreshGameWeatherIfNeeded(row: GameRowWeatherFields): Promise<void> {
  const nowMs = Date.now();
  if (!shouldCallOpenMeteo(row, nowMs)) return;

  const scheduled = row.scheduledAt.getTime();
  const untilMs = scheduled - nowMs;
  const markFinal = untilMs <= TWO_DAYS_MS;

  const w = await fetchVenueDayWeather({
    venueName: row.venue.name,
    city: row.venue.city,
    scheduledAt: row.scheduledAt,
  });
  if (!w) return;

  const fetchedAt = new Date();
  await db
    .update(games)
    .set({
      weatherTempC: w.tempC,
      weatherRainMm: w.rainMm,
      weatherFetchedAt: fetchedAt,
      weatherFinal: markFinal,
    })
    .where(eq(games.id, row.id));

  row.weatherTempC = w.tempC;
  row.weatherRainMm = w.rainMm;
  row.weatherFetchedAt = fetchedAt;
  row.weatherFinal = markFinal;
}

export async function hydrateGameWeatherForRows(rows: GameRowWeatherFields[]): Promise<void> {
  await Promise.all(rows.map((r) => refreshGameWeatherIfNeeded(r)));
}

export function shapeGameRow(row: GameRowWeatherFields & Omit<Game, 'weather'>): Game {
  const weather =
    row.weatherFetchedAt != null && row.weatherTempC != null
      ? { tempC: row.weatherTempC, rainMm: row.weatherRainMm ?? 0 }
      : null;

  const {
    weatherTempC: _a,
    weatherRainMm: _b,
    weatherFetchedAt: _c,
    weatherFinal: _d,
    ...rest
  } = row;

  return { ...rest, weather };
}

export function shapeGameDetailRow(
  row: GameRowWeatherFields & Omit<Game, 'weather'>,
  participants: GameDetail['participants'],
): GameDetail {
  return { ...shapeGameRow(row), participants };
}
