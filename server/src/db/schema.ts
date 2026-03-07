import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
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

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  games: many(games),
  participations: many(participants),
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
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  game: one(games, { fields: [participants.gameId], references: [games.id] }),
  user: one(users, { fields: [participants.userId], references: [users.id] }),
}));
