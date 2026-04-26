export type Game = {
  id: string;
  scheduledAt: Date;
  maxPlayers: number;
  description: string | null;
  isOpen: boolean;
  createdAt: Date;
  sport: { id: string; name: string };
  venue: { id: string; name: string; city: string };
  creator: { id: string };
  participantCount: number;
  likeCount: number;
  commentCount: number;
  currentUserLiked: boolean;
  currentUserJoined: boolean;
  weather: { tempC: number; rainMm: number } | null;
};

export type GameParticipant = {
  userId: string;
  joinedAt: Date;
};

export type GameDetail = Game & {
  participants: GameParticipant[];
};

export type GameComment = {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
};

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
  game: { id: string };
}
