# WA Notif Event MMU

Notifikasi WhatsApp (WABLAS) untuk event SCADA CB (trip, open, close) di UIW MMU. Satu service melayani tiga region: Ternate, Sofifi, Tual. Logikanya sama dengan `wa-service-new`, ditulis ulang dengan TypeScript.

## Perbedaan dari wa-service-new

- Nama event di DB: `CB TRIPPED`, `CB OPENED`, `CB CLOSED`.
- Kolom `origin` menentukan region dan group tujuan. Nilai sebelum titik pertama dibaca: `TERNATE.xxx`, `SOFIFI.xxx`, `TUAL.xxx`. Origin lain dilewati dan di-log.
- Judul pesan mengikuti region: `Scada Event - Sistem Ternate` / `Sofifi` / `Tual`. Isi pesan sama.
- `WA_TESTING=true` mengirim semua pesan ke `WA_PRIVATE_TESTING_ID` (private), bukan group.

## Perubahan DB yang diperlukan

```sql
ALTER TABLE VALIDATE_SCADA_ALARM ADD origin VARCHAR(100) NULL;  -- diisi oleh sumber data alarm
ALTER TABLE VALIDATE_CB_OPEN     ADD origin VARCHAR(100) NULL;  -- diisi service saat feeder masuk daftar open
```

Baris `VALIDATE_CB_OPEN` yang sudah ada sebelum kolom ini ditambahkan harus diisi `origin`-nya (atau dihapus), kalau tidak eskalasi 30m/60m/8j dan penormalannya dilewati.

## Menjalankan

```bash
npm install
cp .env.example .env
npm run dev          # development
npm run build && npm start
pm2 start ecosystem.config.js
```

Selama uji coba, set `WA_TESTING=true`.

## Struktur

| File | Peran |
|---|---|
| `src/app.ts` | Start scheduler dan Express (hanya untuk PORT) |
| `src/config/index.ts` | Baca dan validasi `.env` |
| `src/services/scheduler.ts` | Cron 60 detik, dengan guard agar tick tidak tumpang tindih |
| `src/services/alarm.processor.ts` | Logika utama: eskalasi, penormalan, alarm baru |
| `src/services/alarm.repository.ts` | Semua query SQL |
| `src/services/alarm-parser.ts` | Parse `description` dan `origin` |
| `src/services/message.builder.ts` | Template pesan |
| `src/services/wablas.service.ts` | Routing penerima (group/private/testing) dan kirim ke WABLAS |
