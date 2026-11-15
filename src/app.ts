import express from 'express';
import { config } from './config';
import { startScheduler } from './services/scheduler';

const app = express();

if (config.wa.testing) console.warn('[APP] WA_TESTING aktif: semua pesan dikirim ke private testing');

startScheduler();

app.listen(config.port, () => {
  console.log(`App is running on port ${config.port}`);
});
