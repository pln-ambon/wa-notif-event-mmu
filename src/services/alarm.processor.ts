import moment from 'moment';
import { DAYS, formatDate } from '../utils/date';
import * as repo from './alarm.repository';
import { parseDescription, parseRegion } from './alarm-parser';
import {
  buildEscalation,
  buildNormalization,
  buildOutageInfo,
  buildTripInfo,
  type EscalationLevel,
  type MessageContext,
} from './message.builder';
import { notify } from './wablas.service';
import type { EscalationFlag, OpenBreaker, Region, ScadaAlarm } from '../types';

// Nama event di DB.
const EVENT_TRIP = 'CB TRIPPED';
const EVENT_OPEN = 'CB OPENED';
const EVENT_CLOSE = 'CB CLOSED';

const ALARM_TYPE_CB = 3;
const DB_UTC_OFFSET_HOURS = 9;

interface Escalation {
  level: EscalationLevel;
  flag: EscalationFlag;
  afterSeconds: number;
}

const ESCALATIONS: Escalation[] = [
  { level: '30', flag: 'send_30_minutes', afterSeconds: 1800 },
  { level: '60', flag: 'send_60_minutes', afterSeconds: 3600 },
  { level: '8h', flag: 'send_8_hours', afterSeconds: 28800 },
];

type Clock = Pick<MessageContext, 'day' | 'notifTime'>;

function findClose(alarms: ScadaAlarm[], gi: string | undefined, feeder: string | undefined, afterId = 0): ScadaAlarm | undefined {
  return alarms.find((alarm) => {
    const parsed = parseDescription(alarm.description);
    return parsed.gi === gi && parsed.feeder === feeder && alarm.event.includes(EVENT_CLOSE) && alarm.id > afterId;
  });
}

function buildContext(region: Region, clock: Clock, alarm: Pick<ScadaAlarm, 'id_scada_alarm' | 'description' | 'event' | 'processtime'>, gi: string): MessageContext {
  const parsed = parseDescription(alarm.description);
  return {
    region,
    ...clock,
    alarmId: alarm.id_scada_alarm,
    gi,
    feeder: parsed.feeder,
    device: parsed.device,
    fault: parsed.fault,
    event: alarm.event,
    time: alarm.processtime,
    amf: parsed.amf,
  };
}

async function sendNormalization(ctx: MessageContext, openAt: Date, close: ScadaAlarm): Promise<void> {
  const durationSeconds = Math.trunc(moment(close.processtime).diff(moment(openAt), 'seconds', true));
  await notify(ctx.region, 'group', buildNormalization(ctx, {
    closeEvent: close.event,
    timeOff: openAt,
    timeOn: close.processtime,
    durationSeconds,
  }));
}

/** Pilih eskalasi yang jatuh tempo. Hanya satu per tick (30 -> 60 -> 8 jam), sama seperti service lama. */
function pickEscalation(row: OpenBreaker, elapsedSeconds: number): Escalation | undefined {
  return ESCALATIONS.find(({ level, flag, afterSeconds }) => {
    if (elapsedSeconds < afterSeconds || row[flag]) return false;
    return level === '8h' || row.gangguan;
  });
}

async function sendEscalation(row: OpenBreaker, ctx: MessageContext, { level, flag }: Escalation): Promise<void> {
  if (level === '8h') {
    if (row.gangguan) {
      await notify(ctx.region, 'group', buildEscalation(ctx, '8h', 'group'));
    } else {
      await notify(ctx.region, 'private8h', buildEscalation(ctx, '8h', 'private'));
    }
  } else {
    await notify(ctx.region, 'group', buildEscalation(ctx, level, 'group'));
    await notify(ctx.region, 'private', buildEscalation(ctx, level, 'private'));
  }
  await repo.markEscalationSent(row.id_scada_alarm, flag);
}

/** Proses satu feeder yang masih open. Mengembalikan alarm baru yang belum terpakai. */
async function handleOpenBreaker(row: OpenBreaker, pending: ScadaAlarm[], clock: Clock): Promise<ScadaAlarm[]> {
  const region = parseRegion(row.origin);
  if (!region) {
    console.warn(`[PROCESSOR] origin "${row.origin}" tidak dikenali, lewati open breaker alarm ${row.id_scada_alarm}`);
    return pending;
  }

  const ctx = buildContext(region, clock, row, row.gi);
  const elapsedSeconds = moment().diff(moment(row.processtime).subtract(DB_UTC_OFFSET_HOURS, 'hours'), 'seconds');

  const escalation = pickEscalation(row, elapsedSeconds);
  if (escalation) await sendEscalation(row, ctx, escalation);

  const close = findClose(pending, row.gi, ctx.feeder);
  if (!close) return pending;

  await sendNormalization(ctx, row.processtime, close);
  await repo.deleteOpenBreaker(row.id_scada_alarm);
  return pending.filter((alarm) => alarm.id !== close.id);
}

/** Proses alarm CB TRIPPED / CB OPENED baru. */
async function handleNewAlarm(alarm: ScadaAlarm, pending: ScadaAlarm[], clock: Clock): Promise<void> {
  const isTrip = alarm.event === EVENT_TRIP;
  if (alarm.type !== ALARM_TYPE_CB || (!isTrip && alarm.event !== EVENT_OPEN)) return;

  const region = parseRegion(alarm.origin);
  if (!region) {
    console.warn(`[PROCESSOR] origin "${alarm.origin}" tidak dikenali, lewati alarm ${alarm.id_scada_alarm}`);
    return;
  }

  const gi = parseDescription(alarm.description).gi ?? '';
  const ctx = buildContext(region, clock, alarm, gi);

  await notify(region, 'group', isTrip ? buildTripInfo(ctx) : buildOutageInfo(ctx));

  const close = findClose(pending, gi, ctx.feeder, alarm.id);
  if (close) {
    await sendNormalization(ctx, alarm.processtime, close);
  } else {
    await repo.insertOpenBreaker(alarm, gi, isTrip);
  }
}

export async function processTick(): Promise<void> {
  const lastAlarmId = await repo.getLastAlarmId();
  if (!lastAlarmId) return;

  const [alarms, openBreakers] = await Promise.all([repo.getAlarmsAfter(lastAlarmId), repo.getOpenBreakers()]);
  const clock: Clock = {
    day: DAYS[new Date().getDay()] ?? '',
    notifTime: formatDate(moment().add(DB_UTC_OFFSET_HOURS, 'hours').toDate()),
  };

  // Satu alarm/feeder yang gagal tidak boleh menghentikan yang lain.
  let pending = alarms;
  for (const row of openBreakers) {
    try {
      pending = await handleOpenBreaker(row, pending, clock);
    } catch (error) {
      console.error(`[PROCESSOR] gagal proses open breaker ${row.id_scada_alarm}:`, error);
    }
  }

  for (const alarm of pending) {
    try {
      await handleNewAlarm(alarm, pending, clock);
    } catch (error) {
      console.error(`[PROCESSOR] gagal proses alarm ${alarm.id_scada_alarm}:`, error);
    }
  }

  if (alarms.length) await repo.setLastAlarmId(Math.max(...alarms.map((alarm) => alarm.id)));
}
