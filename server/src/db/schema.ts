import mongoose, { Schema, type Document, type Types } from 'mongoose';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                        */
/* ------------------------------------------------------------------ */

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  profileImageUrl: string | null;
  passwordHash: string | null;
  provider: string;
  providerId: string | null;
  createdAt: Date;
}

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface ISport extends Document {
  _id: Types.ObjectId;
  name: string;
}

export interface IVenue extends Document {
  _id: Types.ObjectId;
  name: string;
  city: string;
}

export interface IGame extends Document {
  _id: Types.ObjectId;
  creatorId: Types.ObjectId;
  sportId: Types.ObjectId;
  venueId: Types.ObjectId;
  scheduledAt: Date;
  maxPlayers: number;
  description: string | null;
  isOpen: boolean;
  createdAt: Date;
  weatherTempC: number | null;
  weatherRainMm: number | null;
  weatherFetchedAt: Date | null;
  weatherFinal: boolean;
}

export interface IParticipant extends Document {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  joinedAt: Date;
}

export interface IGameLike extends Document {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

export interface IGameComment extends Document {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  createdAt: Date;
}

/* ------------------------------------------------------------------ */
/*  Schemas                                                           */
/* ------------------------------------------------------------------ */

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, maxlength: 255 },
    profileImageUrl: { type: String, default: null },
    passwordHash: { type: String, default: null },
    provider: { type: String, default: 'local', required: true, maxlength: 50 },
    providerId: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

userSchema.index({ provider: 1, providerId: 1 }, {
  unique: true,
  partialFilterExpression: { provider: { $ne: 'local' } },
});

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

const sportSchema = new Schema<ISport>({
  name: { type: String, required: true, unique: true, maxlength: 100 },
});

const venueSchema = new Schema<IVenue>({
  name: { type: String, required: true, maxlength: 255 },
  city: { type: String, required: true, maxlength: 100 },
});

const gameSchema = new Schema<IGame>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sportId: { type: Schema.Types.ObjectId, ref: 'Sport', required: true },
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    scheduledAt: { type: Date, required: true },
    maxPlayers: { type: Number, required: true },
    description: { type: String, default: null },
    isOpen: { type: Boolean, default: true },
    weatherTempC: { type: Number, default: null },
    weatherRainMm: { type: Number, default: null },
    weatherFetchedAt: { type: Date, default: null },
    weatherFinal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

const participantSchema = new Schema<IParticipant>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'joinedAt', updatedAt: false } },
);

participantSchema.index({ gameId: 1, userId: 1 }, { unique: true });

const gameLikeSchema = new Schema<IGameLike>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

gameLikeSchema.index({ gameId: 1, userId: 1 }, { unique: true });

const gameCommentSchema = new Schema<IGameComment>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

/* ------------------------------------------------------------------ */
/*  Models                                                            */
/* ------------------------------------------------------------------ */

export const User = mongoose.model<IUser>('User', userSchema);
export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
export const Sport = mongoose.model<ISport>('Sport', sportSchema);
export const Venue = mongoose.model<IVenue>('Venue', venueSchema);
export const Game = mongoose.model<IGame>('Game', gameSchema);
export const Participant = mongoose.model<IParticipant>('Participant', participantSchema);
export const GameLike = mongoose.model<IGameLike>('GameLike', gameLikeSchema);
export const GameComment = mongoose.model<IGameComment>('GameComment', gameCommentSchema);
