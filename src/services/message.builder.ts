import type { AmfCurrent, Region } from '../types';
import { formatDate, formatDuration } from '../utils/date';

export interface MessageContext {
  region: Region;
  day: string;
  notifTime: string;
  alarmId: number;
  gi: string;
  feeder?: string;
  device?: string;
  fault?: string;
  event: string;
  time: Date;
  amf: AmfCurrent;
}

export interface NormalizationInfo {
  closeEvent: string;
  timeOff: Date;
  timeOn: Date;
  durationSeconds: number;
}

export type EscalationLevel = '30' | '60' | '8h';
export type EscalationAudience = 'group' | 'private';

const SEPARATOR = '========================';

// Label + tab dipertahankan persis seperti pesan service lama agar tampilan di WA tidak berubah.
const LABEL = {
  alarmId: 'Alarm Id\t\t: ',
  site: 'Site\t\t\t\t: ',
  feeder: 'Feeder\t\t:  ',
  device: 'Device\t\t:  ',
  event: 'Event\t\t\t:  ',
  fault: 'Fault\t\t\t:  ',
  time: 'Time\t\t\t:  ',
  amfr: 'AMFR\t\t\t:  ',
  amfs: 'AMFS\t\t\t:  ',
  amft: 'AMFT\t\t\t:  ',
  amfn: 'AMFN\t\t\t:  ',
  timeOff: 'Time Off\t\t:  ',
  timeOn: 'Time On\t\t:  ',
  duration: 'Duration\t\t:  ',
} as const;

const ESCALATION = {
  '30': {
    label: '*30 Menit*',
    group: { salutation: 'Yth. Manajer UP3', withAmf: true },
    private: { salutation: 'Yth. Amn dan Spv', withAmf: false },
  },
  '60': {
    label: '*60 Menit*',
    group: { salutation: 'Yth. Senior Manager UIW MMU', withAmf: true },
    private: { salutation: 'Yth. Mup3 dan Srm Tnd', withAmf: false },
  },
  '8h': {
    label: '*8 Jam*',
    group: { salutation: undefined, withAmf: true },
    private: { salutation: 'Yth. Srm, Tnd, Mup3, amn, spv', withAmf: false },
  },
} as const;

/** Judul pesan berbeda per region: "Sistem Ternate", "Sistem Sofifi", "Sistem Tual". */
function systemName(region: Region): string {
  return `Sistem ${region.charAt(0)}${region.slice(1).toLowerCase()}`;
}

function compose(ctx: MessageContext, heading: string[], rows: string[]): string {
  return [
    `*Scada Event - ${systemName(ctx.region)}*`,
    SEPARATOR,
    `*${ctx.day} ${ctx.notifTime}*`,
    SEPARATOR,
    ...heading,
    SEPARATOR,
    ...rows,
  ].join('\n');
}

function identityRows(ctx: MessageContext): string[] {
  return [
    LABEL.alarmId + ctx.alarmId,
    LABEL.site + ctx.gi,
    LABEL.feeder + ctx.feeder,
    LABEL.device + ctx.device,
  ];
}

function tripRows(ctx: MessageContext, withAmf: boolean): string[] {
  const rows = [
    ...identityRows(ctx),
    LABEL.event + ctx.event,
    LABEL.fault + ctx.fault,
    LABEL.time + formatDate(ctx.time),
  ];
  if (withAmf) {
    rows.push(
      LABEL.amfr + ctx.amf.r,
      LABEL.amfs + ctx.amf.s,
      LABEL.amft + ctx.amf.t,
      LABEL.amfn + ctx.amf.n,
    );
  }
  return rows;
}

export function buildTripInfo(ctx: MessageContext): string {
  return compose(ctx, ['Info Trip Gangguan'], tripRows(ctx, true));
}

export function buildOutageInfo(ctx: MessageContext): string {
  const rows = [...identityRows(ctx), LABEL.event + ctx.event, LABEL.time + formatDate(ctx.time)];
  return compose(ctx, ['Info Pemadaman/Manuver'], rows);
}

export function buildNormalization(ctx: MessageContext, info: NormalizationInfo): string {
  const rows = [
    ...identityRows(ctx),
    LABEL.event + info.closeEvent,
    LABEL.timeOff + formatDate(info.timeOff),
    LABEL.timeOn + formatDate(info.timeOn),
    `${LABEL.duration}*${formatDuration(info.durationSeconds)}*`,
  ];
  return compose(ctx, ['Info Penormalan'], rows);
}

export function buildEscalation(
  ctx: MessageContext,
  level: EscalationLevel,
  audience: EscalationAudience,
): string {
  const { label, [audience]: variant } = ESCALATION[level];
  const heading = [
    ...(variant.salutation ? [variant.salutation] : []),
    `Eskalasi gangguan ${label}`,
    'Info Trip Gangguan',
  ];
  return compose(ctx, heading, tripRows(ctx, variant.withAmf));
}
