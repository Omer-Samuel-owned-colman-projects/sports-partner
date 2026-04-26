import { and, gt, ilike, lte, gte, eq } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db/client.js';
import { games, sports, venues } from '../db/schema.js';

type ParsedSearch = {
  sportType: string | null;
  city: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  detectedLanguage: string;
};

type GameSummary = {
  id: number;
  sport: string;
  venue: string;
  city: string;
  scheduledAt: string;
  maxPlayers: number;
  isOpen: boolean;
  description: string | null;
};

const DEFAULT_LANGUAGE = 'english';
const GENERIC_SPORT_TERMS = new Set([
  'sport',
  'sports',
  'game',
  'games',
]);

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
};

const getModelName = () => {
  return process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
};

const generateTextWithModelFallback = async (
  prompt: string | { text: string }[],
): Promise<string> => {
  const client = getClient();
  const model = client.getGenerativeModel({ model: getModelName() });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

const tryParseJsonObject = (text: string): ParsedSearch => {
  try {
    return JSON.parse(text) as ParsedSearch;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('AI parser did not return valid JSON');
    }
    return JSON.parse(match[0]) as ParsedSearch;
  }
};

const normalizeLanguage = (_input: string | null | undefined): string => {
  return DEFAULT_LANGUAGE;
};

const normalizeSportType = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (GENERIC_SPORT_TERMS.has(normalized)) return null;
  return value.trim();
};

const normalizeDateInput = (value: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const normalizeParsedSearch = (raw: ParsedSearch): ParsedSearch => {
  const normalized: ParsedSearch = {
    sportType: normalizeSportType(raw.sportType ?? null),
    city: raw.city?.trim() || null,
    dateFrom: normalizeDateInput(raw.dateFrom ?? null),
    dateTo: normalizeDateInput(raw.dateTo ?? null),
    detectedLanguage: normalizeLanguage(raw.detectedLanguage),
  };

  return normalized;
};

const ensureValidDateRange = (parsed: ParsedSearch): ParsedSearch => {
  if (!parsed.dateFrom || !parsed.dateTo) return parsed;
  const from = new Date(parsed.dateFrom);
  const to = new Date(parsed.dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return parsed;
  if (from <= to) return parsed;
  return { ...parsed, dateFrom: to.toISOString(), dateTo: from.toISOString() };
};

const normalizeCity = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  // handle common "tel aviv" formatting variations
  const lc = trimmed.toLowerCase();
  if (lc === 'tel-aviv' || lc === 'tel aviv-yafo' || lc === 'tel aviv yafo') return 'Tel Aviv';
  return trimmed;
};

const normalizeParsedForQuery = (raw: ParsedSearch): ParsedSearch => {
  const normalized = normalizeParsedSearch(raw);
  return {
    ...ensureValidDateRange(normalized),
    city: normalizeCity(normalized.city),
  };
};

const parseUserQuery = async (userQuery: string): Promise<ParsedSearch> => {
  const systemPrompt = [
    'You are an expert NLP parser for the "Sports-Partner" app.',
    `Current Date Context: ${new Date().toISOString()} (Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })})`,
    '',
    'Your Task:',
    '1) Detect the language of the user\'s query (e.g., "hebrew", "english", "russian").',
    '2) Extract structured search filters from the query.',
    '3) Normalize "sportType" to a standard lowercase singular noun (e.g., "basketball", "tennis", "football", "yoga").',
    '4) Resolve relative time phrases into absolute ISO-8601 UTC timestamps based on the Current Date Context.',
    '',
    'JSON Schema:',
    '{',
    '  "sportType": string | null,',
    '  "city": string | null,',
    '  "dateFrom": "ISO-8601-string" | null,',
    '  "dateTo": "ISO-8601-string" | null,',
    '  "detectedLanguage": string',
    '}',
    '',
    'Temporal Rules:',
    '- "today": From 00:00:00 of the current day to 23:59:59.',
    '- "tomorrow": From 00:00:00 of the next day to 23:59:59.',
    '- "evening": Set time range between 18:00 and 23:59.',
    '- "weekend": From Friday 14:00 to Saturday 23:59.',
    '- "this week": From now until the end of the current Saturday.',
    '',
    'Examples:',
    'User: "מחפש כדורסל בתל אביב מחר בערב"',
    `Output: {"sportType": "basketball", "city": "Tel Aviv", "dateFrom": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T18:00:00Z", "dateTo": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T23:59:59Z", "detectedLanguage": "hebrew"}`,
    '',
    'User: "any tennis games in Haifa next week?"',
    'Output: {"sportType": "tennis", "city": "Haifa", "dateFrom": "...", "dateTo": "...", "detectedLanguage": "english"}',
    '',
    'Strict Rules:',
    '- Return ONLY raw JSON. No markdown blocks, no conversational filler.',
    '- If a value is missing, use null.',
    '- Be aggressive in extracting the city even if it is mentioned with a prefix (e.g., "בחיפה" -> "Haifa").'
  ].join('\n');

  const text = await generateTextWithModelFallback([
    { text: systemPrompt },
    { text: `User query: ${userQuery}` },
  ]);
  return normalizeParsedForQuery(tryParseJsonObject(text));
};

const queryGames = async (parsed: ParsedSearch): Promise<GameSummary[]> => {
  const whereConditions = [
    eq(games.isOpen, true),
    gt(games.scheduledAt, new Date()),
  ];

  if (parsed.sportType) {
    whereConditions.push(ilike(sports.name, `%${parsed.sportType}%`));
  }
  if (parsed.city) {
    whereConditions.push(ilike(venues.city, `%${parsed.city}%`));
  }
  if (parsed.dateFrom) {
    const dateFrom = new Date(parsed.dateFrom);
    if (!Number.isNaN(dateFrom.getTime())) {
      whereConditions.push(gte(games.scheduledAt, dateFrom));
    }
  }
  if (parsed.dateTo) {
    const dateTo = new Date(parsed.dateTo);
    if (!Number.isNaN(dateTo.getTime())) {
      whereConditions.push(lte(games.scheduledAt, dateTo));
    }
  }

  const rows = await db
    .select({
      id: games.id,
      sport: sports.name,
      venue: venues.name,
      city: venues.city,
      scheduledAt: games.scheduledAt,
      maxPlayers: games.maxPlayers,
      isOpen: games.isOpen,
      description: games.description,
    })
    .from(games)
    .innerJoin(sports, eq(games.sportId, sports.id))
    .innerJoin(venues, eq(games.venueId, venues.id))
    .where(and(...whereConditions))
    .orderBy(games.scheduledAt)
    .limit(20);

  return rows.map((row) => ({
    ...row,
    scheduledAt: row.scheduledAt.toISOString(),
  }));
};

const buildNaturalLanguageResponse = async (params: {
  userQuery: string;
  parsed: ParsedSearch;
  games: GameSummary[];
}): Promise<string> => {
  const language = normalizeLanguage(params.parsed.detectedLanguage);
  const systemPrompt = [
    "You are the 'Sports-Partner' assistant.",
    `Based on these search results: ${JSON.stringify(params.games)}, respond to the user's original query: '${params.userQuery}'.`,
    'CRITICAL: Always respond in English.',
    `Detected language from parser: ${language}.`,
    'Be informative, friendly, and summarize games (Sport, Location, Time).',
    'If no games are found, explain that in the same language and encourage them to create the first game.',
  ].join('\n');

  return generateTextWithModelFallback(systemPrompt);
};

export const runGameSearchAssistant = async (userQuery: string) => {
  const parsed = await parseUserQuery(userQuery);
  const gamesFound = await queryGames(parsed);
  const answer = await buildNaturalLanguageResponse({
    userQuery,
    parsed,
    games: gamesFound,
  });

  return {
    detectedLanguage: normalizeLanguage(parsed.detectedLanguage),
    parsedSearch: parsed,
    games: gamesFound,
    answer,
  };
};

