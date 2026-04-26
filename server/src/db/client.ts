import mongoose from 'mongoose';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://mongo:password@localhost:27017/sports_partner?authSource=admin';

function redactUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return uri.replace(/:([^@/]+)@/, ':***@');
  }
}

export async function connectDB(): Promise<void> {
  const safeUri = redactUri(MONGODB_URI);
  console.log(`Connecting to MongoDB at ${safeUri} ...`);

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.error(`Failed to connect to MongoDB at ${safeUri}`);
    throw err;
  }

  const db = mongoose.connection.db!;
  await db.admin().ping();
  console.log('MongoDB connection verified (ping ok)');
}
