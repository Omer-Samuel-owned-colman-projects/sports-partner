import type { games, sports, venues, participants } from '../db/schema.js';

export type Game = Pick<
  typeof games.$inferSelect,
  'id' | 'scheduledAt' | 'maxPlayers' | 'description' | 'isOpen' | 'createdAt'
> & {
  sport: Pick<typeof sports.$inferSelect, 'id' | 'name'>;
  venue: Pick<typeof venues.$inferSelect, 'id' | 'name' | 'city'>;
  creator: { id: number };
  participantCount: number;
};

export type GameParticipant = Pick<
  typeof participants.$inferSelect,
  'userId' | 'joinedAt'
>;

export type GameDetail = Game & {
  participants: GameParticipant[];
};

export interface GamesResponse {
  games: Game[];
}

export interface GameDetailResponse {
  game: GameDetail;
}
