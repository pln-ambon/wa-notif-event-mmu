export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'] as const;

/** `dd/mm/yyyy HH:mm:ss.SSS` dari komponen UTC (DB menyimpan waktu lokal UTC+9 sebagai-is). */
export function formatDate(date: Date): string {
  const [day = '', time = ''] = date.toISOString().split('T');
  const [year, month, dd] = day.split('-');
  return `${dd}/${month}/${year} ${time.replace('Z', '')}`;
}

export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor((totalSeconds % 3600) % 60);
  return `${days} Hari ${hours} Jam ${minutes} Menit ${seconds} Detik`;
}
