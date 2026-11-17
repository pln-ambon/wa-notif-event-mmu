# WA Notif Event MMU

Notifikasi WhatsApp (WABLAS) untuk event SCADA CB (trip, open, close) di UIW MMU. Satu service melayani tiga region: Ternate, Sofifi, Tual. Logikanya sama dengan `wa-service-new`, ditulis ulang dengan TypeScript.

## Perbedaan dari wa-service-new

- Nama event di DB: `CB TRIPPED`, `CB OPENED`, `CB CLOSED`.
- Kolom `origin` menentukan region dan group tujuan. Nilai sebelum titik pertama dibaca: `TERNATE.xxx`, `SOFIFI.xxx`, `TUAL.xxx`. Origin lain dilewati dan di-log.
- Judul pesan mengikuti region: `Scada Event - Sistem Ternate` / `Sofifi` / `Tual`. Isi pesan sama.
- `WA_TESTING=true` mengirim semua pesan ke `WA_PRIVATE_TESTING_ID` (private), bukan group.

## Perubahan DB yang diperlukan

```sql
ALTER TABLE VALIDATE_CB_OPEN ADD origin VARCHAR(100) NULL;  -- diisi service saat feeder masuk daftar open
```

`SCADA_ALARM` sudah punya kolom `origin` (diisi sumber data alarm), jadi tidak perlu diubah.

## Tabel yang dipakai

| Tabel | Operasi | Fungsi |
|---|---|---|
| `SCADA_ALARM` | Baca | Sumber alarm baru (kolom `id` dipakai sebagai `id_scada_alarm`) |
| `VALIDATE_ALARM_NEW` | Baca dan update | State: id alarm terakhir yang sudah diproses (baris `id = 1`) |
| `VALIDATE_CB_OPEN` | Baca, insert, update, delete | State: feeder yang sedang open atau trip dan belum close |

Baris `VALIDATE_CB_OPEN` yang sudah ada sebelum kolom ini ditambahkan harus diisi `origin`-nya (atau dihapus), kalau tidak eskalasi 30m/60m/8j dan penormalannya dilewati.

## Menjalankan

### Development

```bash
npm install
cp .env.example .env   # isi, dan set WA_TESTING=true selama uji coba
npm run dev
```

### Production (PM2)

PM2 menjalankan `dist/app.js`, dan `dist/` tidak ada di git, jadi **build dulu sebelum start**.

```bash
npm install                  # jangan --omit=dev, build butuh typescript
cp .env.example .env         # isi, dan pastikan WA_TESTING=false
npm run build
pm2 start ecosystem.config.js
pm2 save                     # otomatis jalan lagi setelah reboot
```

Update kode:

```bash
git pull && npm install && npm run build && pm2 restart wa-notif-event-mmu
```

`npm start` hanya menjalankan `node dist/app.js` di foreground (tanpa PM2), cocok untuk coba cepat setelah `npm run build`.

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
