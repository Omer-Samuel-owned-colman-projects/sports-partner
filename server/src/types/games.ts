import type { games, sports, venues, participants, gameComments } from '../db/schema.js';

export type Game = Pick<
  typeof games.$inferSelect,
  'id' | 'scheduledAt' | 'maxPlayers' | 'description' | 'isOpen' | 'createdAt'
> & {
  sport: Pick<typeof sports.$inferSelect, 'id' | 'name'>;
  venue: Pick<typeof venues.$inferSelect, 'id' | 'name' | 'city'>;
  creator: { id: number };
  participantCount: number;
  likeCount: number;
  commentCount: number;
  currentUserLiked: boolean;
  currentUserJoined: boolean;
};

export type GameParticipant = Pick<
  typeof participants.$inferSelect,
  'userId' | 'joinedAt'
>;

export type GameDetail = Game & {
  participants: GameParticipant[];
};

export type GameComment = Pick<typeof gameComments.$inferSelect, 'id' | 'userId' | 'content' | 'createdAt'>;

export interface GamesResponse {
  games: Game[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface GameDetailResponse {
  game: GameDetail;
}

export interface GameCommentsResponse {
  comments: GameComment[];
}

export interface GameMutationResponse {
  game: { id: number };
}
