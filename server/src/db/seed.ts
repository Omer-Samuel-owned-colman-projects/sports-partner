import 'dotenv/config';
import { db } from './client.js';
import { sports, venues } from './schema.js';

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

const seed = async () => {
  console.log('Seeding sports...');
  await db.insert(sports).values(SPORTS).onConflictDoNothing();

  console.log('Seeding venues...');
  await db.insert(venues).values(VENUES).onConflictDoNothing();

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
