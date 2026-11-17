import sql from 'mssql';
import { config } from '../config';
import type { EscalationFlag, OpenBreaker, ScadaAlarm } from '../types';

let pool: sql.ConnectionPool | undefined;

async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  await pool?.close().catch(() => undefined);
  pool = await new sql.ConnectionPool(config.sql).connect();
  return pool;
}

async function query<T>(text: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const request = (await getPool()).request();
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  const result = await request.query<T>(text);
  return result.recordset;
}

/** Id alarm terakhir yang sudah diproses (VALIDATE_ALARM_NEW id = 1). */
export async function getLastAlarmId(): Promise<number | undefined> {
  const [row] = await query<{ AlarmId: number }>('select AlarmId from VALIDATE_ALARM_NEW where id = 1');
  return row?.AlarmId;
}

export async function setLastAlarmId(alarmId: number): Promise<void> {
  await query('update VALIDATE_ALARM_NEW set AlarmId = @alarmId where id = 1', { alarmId });
}

export function getAlarmsAfter(alarmId: number): Promise<ScadaAlarm[]> {
  return query<ScadaAlarm>(
    // SCADA_ALARM tidak punya kolom id_scada_alarm; id alarm = kolom id (pid adalah id titik, bukan alarm).
    `select id, id as id_scada_alarm, type, description, event, processtime, origin
       from SCADA_ALARM where id > @alarmId order by id`,
    { alarmId },
  );
}

export function getOpenBreakers(): Promise<OpenBreaker[]> {
  return query<OpenBreaker>('select * from VALIDATE_CB_OPEN');
}

export async function insertOpenBreaker(alarm: ScadaAlarm, gi: string, gangguan: boolean): Promise<void> {
  await query(
    `insert into VALIDATE_CB_OPEN
       (id_scada_alarm, gi, description, event, send_first, send_30_minutes, send_60_minutes, processtime, gangguan, origin)
     values (@idAlarm, @gi, @description, @event, 1, 0, 0, @processtime, @gangguan, @origin)`,
    {
      idAlarm: alarm.id_scada_alarm,
      gi,
      description: alarm.description,
      event: alarm.event,
      processtime: alarm.processtime,
      gangguan: gangguan ? 1 : 0,
      origin: alarm.origin,
    },
  );
}

export async function markEscalationSent(idAlarm: number, flag: EscalationFlag): Promise<void> {
  // `flag` berasal dari union literal, bukan input luar, jadi aman di-interpolasi.
  await query(`update VALIDATE_CB_OPEN set ${flag} = 1 where id_scada_alarm = @idAlarm`, { idAlarm });
}

export async function deleteOpenBreaker(idAlarm: number): Promise<void> {
  await query('delete from VALIDATE_CB_OPEN where id_scada_alarm = @idAlarm', { idAlarm });
}
