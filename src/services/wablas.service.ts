import axios from 'axios';
import { config } from '../config';
import type { Region, WaPayload } from '../types';

export type Audience = 'group' | 'private' | 'private8h';

export function resolveRecipient(region: Region, audience: Audience): Pick<WaPayload, 'phone' | 'isGroup'> {
  if (config.wa.testing) return { phone: config.wa.testingPrivateId, isGroup: false };

  switch (audience) {
    case 'group':
      return { phone: config.wa.groupIds[region], isGroup: true };
    case 'private':
      return { phone: config.wa.privateId, isGroup: false };
    case 'private8h':
      return { phone: config.wa.privateId8h, isGroup: false };
  }
}

/** Kirim ke WABLAS. Error hanya di-log (belum ada retry/log DB), sama seperti service lama. */
export async function notify(region: Region, audience: Audience, message: string): Promise<void> {
  const payload: WaPayload = { ...resolveRecipient(region, audience), message };
  try {
    await axios.post(config.wablas.url, payload, {
      headers: { Authorization: config.wablas.token, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[WABLAS] gagal kirim ${region}/${audience}:`, error);
  }
}
