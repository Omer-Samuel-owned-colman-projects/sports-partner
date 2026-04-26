import 'dotenv/config';
import { connectDB } from './db/client.js';
import { createApp } from './app.js';

async function main() {
  await connectDB();

  const app = createApp();
  const PORT = process.env.PORT ?? 3001;

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
