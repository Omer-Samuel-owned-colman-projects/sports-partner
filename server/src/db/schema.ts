import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  primaryKey,
  real,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  profileImageUrl: varchar('profile_image_url', { length: 512 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sports = pgTable('sports', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
});

export const venues = pgTable('venues', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
});

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => users.id),
  sportId: integer('sport_id')
    .notNull()
    .references(() => sports.id),
  venueId: integer('venue_id')
    .notNull()
    .references(() => venues.id),
  scheduledAt: timestamp('scheduled_at').notNull(),
  maxPlayers: integer('max_players').notNull(),
  description: text('description'),
  isOpen: boolean('is_open').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  weatherTempC: integer('weather_temp_c'),
  weatherRainMm: real('weather_rain_mm'),
  weatherFetchedAt: timestamp('weather_fetched_at'),
  weatherFinal: boolean('weather_final').default(false).notNull(),
});

export const participants = pgTable(
  'participants',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.userId] })],
);

export const gameLikes = pgTable(
  'game_likes',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.userId] })],
);

export const gameComments = pgTable('game_comments', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  games: many(games),
  participations: many(participants),
  gameLikes: many(gameLikes),
  gameComments: many(gameComments),
}));

export const sportsRelations = relations(sports, ({ many }) => ({
  games: many(games),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  games: many(games),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  creator: one(users, { fields: [games.creatorId], references: [users.id] }),
  sport: one(sports, { fields: [games.sportId], references: [sports.id] }),
  venue: one(venues, { fields: [games.venueId], references: [venues.id] }),
  participants: many(participants),
  likes: many(gameLikes),
  comments: many(gameComments),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  game: one(games, { fields: [participants.gameId], references: [games.id] }),
  user: one(users, { fields: [participants.userId], references: [users.id] }),
}));

export const gameLikesRelations = relations(gameLikes, ({ one }) => ({
  game: one(games, { fields: [gameLikes.gameId], references: [games.id] }),
  user: one(users, { fields: [gameLikes.userId], references: [users.id] }),
}));

export const gameCommentsRelations = relations(gameComments, ({ one }) => ({
  game: one(games, { fields: [gameComments.gameId], references: [games.id] }),
  user: one(users, { fields: [gameComments.userId], references: [users.id] }),
}));
