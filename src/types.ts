export const REGIONS = ['TERNATE', 'SOFIFI', 'TUAL'] as const;
export type Region = (typeof REGIONS)[number];

/** Baris SCADA_ALARM yang dibaca service. */
export interface ScadaAlarm {
  id: number;
  id_scada_alarm: number;
  type: number;
  description: string | null;
  event: string;
  processtime: Date;
  origin: string | null;
}

/** Baris VALIDATE_CB_OPEN: feeder yang sedang OPENED/TRIPPED dan belum CLOSED. */
export interface OpenBreaker {
  id_scada_alarm: number;
  gi: string;
  description: string | null;
  event: string;
  processtime: Date;
  gangguan: boolean;
  send_first: boolean;
  send_30_minutes: boolean;
  send_60_minutes: boolean;
  send_8_hours: boolean | null;
  origin: string | null;
}

export type EscalationFlag = 'send_30_minutes' | 'send_60_minutes' | 'send_8_hours';

export interface AmfCurrent {
  r: string;
  s: string;
  t: string;
  n: string;
}

export interface ParsedDescription {
  gi?: string;
  feeder?: string;
  device?: string;
  fault?: string;
  amf: AmfCurrent;
}

export interface WaPayload {
  phone: string;
  message: string;
  isGroup: boolean;
}
