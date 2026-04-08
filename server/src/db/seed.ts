import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './client.js';
import { sports, venues, users, games, participants } from './schema.js';

const SPORTS = [
  { name: 'Football' },
  { name: 'Basketball' },
  { name: 'Tennis' },
  { name: 'Volleyball' },
  { name: 'Padel' },
  { name: 'Swimming' },
];

const VENUES = [
  { name: 'Bloomfield Stadium', city: 'Tel Aviv' },
  { name: 'Yarkon Park Courts', city: 'Tel Aviv' },
  { name: 'Gordon Beach Courts', city: 'Tel Aviv' },
  { name: 'Teddy Stadium', city: 'Jerusalem' },
  { name: 'Ramat Gan Stadium', city: 'Ramat Gan' },
  { name: 'HaPoel Sports Center', city: 'Haifa' },
  { name: 'Kiryat Eliezer Stadium', city: 'Haifa' },
  { name: 'Leonardo Arena', city: 'Beer Sheva' },
];

const SEED_USERS = [
  { name: 'Alice Cohen', email: 'alice@example.com', password: 'password123' },
  { name: 'Bob Levi', email: 'bob@example.com', password: 'password123' },
  { name: 'Charlie Mizrahi', email: 'charlie@example.com', password: 'password123' },
];

const seed = async () => {
  console.log('Seeding sports...');
  const insertedSports = await db.insert(sports).values(SPORTS).onConflictDoNothing().returning();

  console.log('Seeding venues...');
  const insertedVenues = await db.insert(venues).values(VENUES).onConflictDoNothing().returning();

  console.log('Seeding users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const insertedUsers = await db
    .insert(users)
    .values(SEED_USERS.map((u) => ({ name: u.name, email: u.email, passwordHash })))
    .onConflictDoNothing()
    .returning();

  if (insertedUsers.length === 0 || insertedSports.length === 0 || insertedVenues.length === 0) {
    console.log('Seed data already exists, skipping games.');
    process.exit(0);
  }

  console.log('Seeding games...');
  const now = new Date();
  const dayMs = 86_400_000;
  const sampleGames = [
    { creatorId: insertedUsers[0].id, sportId: insertedSports[0].id, venueId: insertedVenues[0].id, scheduledAt: new Date(now.getTime() + dayMs * 2), maxPlayers: 10, description: 'Friendly 5v5 football match' },
    { creatorId: insertedUsers[1].id, sportId: insertedSports[1].id, venueId: insertedVenues[1].id, scheduledAt: new Date(now.getTime() + dayMs * 3), maxPlayers: 6, description: '3v3 basketball pickup game' },
    { creatorId: insertedUsers[0].id, sportId: insertedSports[2].id, venueId: insertedVenues[2].id, scheduledAt: new Date(now.getTime() + dayMs * 5), maxPlayers: 4, description: 'Doubles tennis match' },
    { creatorId: insertedUsers[2].id, sportId: insertedSports[4].id, venueId: insertedVenues[5].id, scheduledAt: new Date(now.getTime() + dayMs * 1), maxPlayers: 4, description: 'Padel match — all levels welcome' },
    { creatorId: insertedUsers[1].id, sportId: insertedSports[3].id, venueId: insertedVenues[3].id, scheduledAt: new Date(now.getTime() + dayMs * 7), maxPlayers: 12, description: 'Volleyball tournament' },
  ];

  const insertedGames = await db.insert(games).values(sampleGames).returning();

  console.log('Seeding participants...');
  const sampleParticipants = [
    { gameId: insertedGames[0].id, userId: insertedUsers[0].id },
    { gameId: insertedGames[0].id, userId: insertedUsers[1].id },
    { gameId: insertedGames[1].id, userId: insertedUsers[1].id },
    { gameId: insertedGames[1].id, userId: insertedUsers[2].id },
    { gameId: insertedGames[2].id, userId: insertedUsers[0].id },
    { gameId: insertedGames[3].id, userId: insertedUsers[2].id },
    { gameId: insertedGames[3].id, userId: insertedUsers[0].id },
    { gameId: insertedGames[4].id, userId: insertedUsers[1].id },
  ];

  await db.insert(participants).values(sampleParticipants).onConflictDoNothing();

  console.log('Seed complete.');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
