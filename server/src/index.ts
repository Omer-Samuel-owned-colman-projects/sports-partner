import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
