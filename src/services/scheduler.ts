import cron from 'node-cron';
import { processTick } from './alarm.processor';

// Tiap 60 detik (field detik `*/60` = detik ke-0, jadi sekali per menit).
const SCHEDULE = '*/60 * * * * *';

let running = false;

export function startScheduler(): void {
  cron.schedule(SCHEDULE, async () => {
    if (running) {
      console.warn('[SCHEDULER] tick sebelumnya belum selesai, lewati');
      return;
    }
    running = true;
    try {
      console.log('[SCHEDULER] run');
      await processTick();
    } catch (error) {
      console.error('[SCHEDULER] error:', error);
    } finally {
      running = false;
    }
  });
}
