import { REGIONS, type ParsedDescription, type Region } from '../types';

/**
 * Description: `<teks>, GI:FEEDER:DEVICE:FAULT:AMFR:AMFS:AMFT:AMFN`.
 * Urutan index tidak boleh diubah.
 */
export function parseDescription(description: string | null | undefined): ParsedDescription {
  const [gi, feeder, device, fault, r, s, t, n] = description?.split(', ')[1]?.split(':') ?? [];
  return { gi, feeder, device, fault, amf: { r: r ?? '-', s: s ?? '-', t: t ?? '-', n: n ?? '-' } };
}

/** Origin `TERNATE.xxx` -> `TERNATE`. Null jika prefix bukan salah satu region. */
export function parseRegion(origin: string | null | undefined): Region | null {
  const prefix = origin?.split('.')[0]?.trim().toUpperCase();
  return REGIONS.find((region) => region === prefix) ?? null;
}
