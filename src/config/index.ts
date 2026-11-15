import 'dotenv/config';
import type { config as SqlConfig } from 'mssql';
import type { Region } from '../types';

function optional(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function required(name: string): string {
  const value = optional(name);
  if (!value) throw new Error(`Environment variable ${name} wajib diisi`);
  return value;
}

const testing = ['true', '1'].includes(optional('WA_TESTING').toLowerCase());

// Saat testing, semua pesan ke private testing, jadi id group dan private produksi tidak wajib.
const target = (name: string): string => (testing ? optional(name) : required(name));

export const config = {
  port: Number(optional('PORT')) || 3000,
  sql: {
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    server: required('DB_SERVER'),
    port: Number(required('DB_PORT')),
    pool: { max: 10, min: 1, idleTimeoutMillis: 30000 },
    options: { encrypt: true, trustServerCertificate: true },
  } satisfies SqlConfig,
  wablas: {
    url: required('WABLAS_URL'),
    token: required('WABLAS_TOKEN'),
  },
  wa: {
    testing,
    testingPrivateId: testing ? required('WA_PRIVATE_TESTING_ID') : '',
    privateId: target('WA_PRIVATE_ID'),
    privateId8h: optional('WA_PRIVATE_ID_8H') || optional('WA_PRIVATE_ID'),
    groupIds: {
      TERNATE: target('WA_GROUP_ID_TERNATE'),
      SOFIFI: target('WA_GROUP_ID_SOFIFI'),
      TUAL: target('WA_GROUP_ID_TUAL'),
    } satisfies Record<Region, string>,
  },
};
