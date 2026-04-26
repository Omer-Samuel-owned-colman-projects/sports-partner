import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from './client.js';
import { Sport, Venue, User, Game, Participant } from './schema.js';
import { SPORTS, VENUES, SEED_USERS, SEED_PASSWORD } from './seed-data.js';

const seed = async () => {
  await connectDB();

  console.log('Seeding sports...');
  const insertedSports = await Promise.all(
    SPORTS.map((s) =>
      Sport.findOneAndUpdate({ name: s.name }, s, { upsert: true, new: true }),
    ),
  );

  console.log('Seeding venues...');
  const insertedVenues = await Promise.all(
    VENUES.map((v) =>
      Venue.findOneAndUpdate({ name: v.name, city: v.city }, v, { upsert: true, new: true }),
    ),
  );

  console.log('Seeding users...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const insertedUsers = await Promise.all(
    SEED_USERS.map((u) =>
      User.findOneAndUpdate(
        { email: u.email },
        { name: u.name, email: u.email, passwordHash },
        { upsert: true, new: true },
      ),
    ),
  );

  const gameCount = await Game.countDocuments();
  if (gameCount > 0) {
    console.log('Games already exist, skipping game seeding.');
    process.exit(0);
  }

  console.log('Seeding games...');
  const now = new Date();
  const dayMs = 86_400_000;
  const sampleGames = [
    { creatorId: insertedUsers[0]._id, sportId: insertedSports[0]._id, venueId: insertedVenues[0]._id, scheduledAt: new Date(now.getTime() + dayMs * 2), maxPlayers: 10, description: 'Friendly 5v5 football match' },
    { creatorId: insertedUsers[1]._id, sportId: insertedSports[1]._id, venueId: insertedVenues[1]._id, scheduledAt: new Date(now.getTime() + dayMs * 3), maxPlayers: 6, description: '3v3 basketball pickup game' },
    { creatorId: insertedUsers[0]._id, sportId: insertedSports[2]._id, venueId: insertedVenues[2]._id, scheduledAt: new Date(now.getTime() + dayMs * 5), maxPlayers: 4, description: 'Doubles tennis match' },
    { creatorId: insertedUsers[2]._id, sportId: insertedSports[4]._id, venueId: insertedVenues[5]._id, scheduledAt: new Date(now.getTime() + dayMs * 1), maxPlayers: 4, description: 'Padel match — all levels welcome' },
    { creatorId: insertedUsers[1]._id, sportId: insertedSports[3]._id, venueId: insertedVenues[3]._id, scheduledAt: new Date(now.getTime() + dayMs * 7), maxPlayers: 12, description: 'Volleyball tournament' },
  ];

  const insertedGames = await Game.insertMany(sampleGames);

  console.log('Seeding participants...');
  const sampleParticipants = [
    { gameId: insertedGames[0]._id, userId: insertedUsers[0]._id },
    { gameId: insertedGames[0]._id, userId: insertedUsers[1]._id },
    { gameId: insertedGames[1]._id, userId: insertedUsers[1]._id },
    { gameId: insertedGames[1]._id, userId: insertedUsers[2]._id },
    { gameId: insertedGames[2]._id, userId: insertedUsers[0]._id },
    { gameId: insertedGames[3]._id, userId: insertedUsers[2]._id },
    { gameId: insertedGames[3]._id, userId: insertedUsers[0]._id },
    { gameId: insertedGames[4]._id, userId: insertedUsers[1]._id },
  ];

  for (const p of sampleParticipants) {
    await Participant.updateOne(
      { gameId: p.gameId, userId: p.userId },
      { $setOnInsert: p },
      { upsert: true },
    );
  }

  console.log('Seed complete.');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
