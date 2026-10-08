# Laporan Audit Kesiapan Proyek (QA Audit) — Re-Audit

- **Proyek:** Gaming Rental Reservation System (`gaming-rental-system`)
- **Tanggal audit:** 8 Oktober 2026
- **Sifat:** **re-audit** (menimpa `docs/AUDIT_REPORT.md` hasil audit sebelumnya; kode sudah banyak diperbaiki)
- **Metode:** inspeksi kode + menjalankan aplikasi nyata (bukan menilai README)
- **Catatan lingkungan:** aplikasi dijalankan dengan **salinan** database. `prisma/dev.db` disalin ke `C:/Users/beatskit/AppData/Local/Temp/audit3.db` (114688 byte) dan `DATABASE_URL` diarahkan ke salinan itu, sehingga `prisma/dev.db` **tidak diubah**. Perubahan sandi uji hanya terjadi pada file salinan. Hanya berkas laporan ini yang ditulis.

---

## 1. Ringkasan

Proyek ini sekarang sepenuhnya **lokal**: Next.js 14 (App Router) + Prisma + SQLite + JWT (`jose` HS256) + `bcryptjs`, **tanpa Supabase** (grep `supabase` → `(none)` di seluruh kode aktif). `npx tsc --noEmit` **lulus (EXIT 0)**, `npm run build` **lulus (EXIT 0)**, dan dev server berjalan serta melayani endpoint nyata (Uji API di §3.2). Semua temuan audit sebelumnya sudah diperbaiki: status HTTP lock yang salah menjadi **200 pada sukses** (409 bentrok / 404 unit tidak ada / 400 validasi), slot tidak berurutan dicegah, transisi status reservasi diimplementasikan (`PATCH /api/reservations/[id]` + UI customer/admin), tautan mati admin dihapus, tipe lama diganti tipe tulis-tangan, validasi dibagikan ke klien dan server, dan kini ada **tes otomatis** yang lulus (`npm test`: 63 lulus; `npm run test:e2e`: 4 lulus). Satu-satunya kode yang tidak memblokir: **tidak ada berkas SRS/requirements** di repo sehingga REQ-1 tidak dapat dinilai, dan PRJ-1/UNQ-1 memang ranah mahasiswa.

**Jumlah vonis:**

| Vonis | Jumlah | Kode |
|-------|--------|------|
| PASS | 10 | PRJ-2, PRJ-3, ROL-1, FTR-1, FTR-2, FTR-3, RDY-3, RDY-4, RDY-5, RDY-6 |
| PARTIAL | 0 | — |
| FAIL | 0 | — |
| NEEDS-STUDENT | 3 | PRJ-1, UNQ-1, REQ-1 |
| UNVERIFIED | 0 | — |

---

## 2. Tabel Hasil

| Kode | Vonis | Alasan (satu baris) | Bukti | Perbaikan minimum |
|------|-------|---------------------|-------|-------------------|
| PRJ-1 | NEEDS-STUDENT | Kepemilikan/pemahaman kode tidak dapat dinilai dari kode | — | Mahasiswa harus dapat menjawab 10 pertanyaan di §6 |
| PRJ-2 | PASS | Berjalan lokal: tsc & build lulus, dev server + endpoint nyata 200 | `TSC_EXIT:0`; `BUILD_EXIT:0`; Uji API §3.2 (`/api/units` 200, login 200); `README.md` memuat `db:migrate`/`db:seed` | — |
| PRJ-3 | PASS | Ada pemrosesan nyata (tulis DB, transaksi, update status), bukan halaman statis | `app/api/reservations/route.ts:31-79`; `app/api/reservations/[id]/route.ts:37-97`; Uji #8/#9/#10 | — |
| ROL-1 | PASS | Fitur berpusat konsisten pada CUSTOMER; ADMIN dipakai untuk perubahan status | Rute per peran §3.3 | Deklarasikan "CUSTOMER" sebagai fokus uji di SRS |
| FTR-1 | PASS | 3 fitur auth berfungsi + ≥5 fitur tambahan berfungsi | Tabel fitur §3.3 (8 fitur customer + 2 admin) | — |
| FTR-2 | PASS | Login, Register, Forgot Password ada + backend nyata + jalur penuh tembus | Uji #4/#5 (login), #24-30 (forgot→reset→login baru) | — |
| FTR-3 | PASS | Setiap fitur tambahan punya fungsi jelas + skenario uji (tes otomatis lulus) | §3.3; `tests/e2e/booking.spec.ts`, `tests/api/booking.test.ts` | — |
| UNQ-1 | NEEDS-STUDENT | Keunikan produk antar mahasiswa/kelas tidak dapat dinilai dari repo | — | Buktikan perbedaan platform/produk di dokumen |
| RDY-3 | PASS | Variasi input + batas nyata melimpah untuk EP & BVA, dibagikan klien+server | `lib/validation.ts:21-67`; §4; Uji #32 audit lalu (7/8/72/73) | — |
| RDY-4 | PASS | Sumber TypeScript tersedia, fungsi bernama, 5 titik white-box teridentifikasi | §5 | — |
| RDY-5 | PASS | Ada tes otomatis yang berjalan dan lulus | `npm test` → `63 passed`; `npm run test:e2e` → `4 passed` | — |
| RDY-6 | PASS | CRUD + transisi status + workflow + business rule teruji | §7; `lib/reservation-status.ts:48-80`; `app/api/reservations/[id]/route.ts` | — |
| REQ-1 | NEEDS-STUDENT | Tidak ada berkas SRS/requirements di repo (SRS_PATH tidak diberikan) | `find *srs*/*requirement*` → `(none)` | Susun SRS + ID requirement sesuai Module 2 |

---

## 3. Detail per Kode

### 3.1 Phase 0 — Inventaris

- **Tree (2 level, tanpa node_modules/.next/.git/.kilo):** `app/` (admin, api, auth, customer, dev), `components/ui`, `hooks`, `lib` (`auth.ts`, `db.ts`, `reservation-status.ts`, `serialize.ts`, `utils.ts`, `validation.ts`), `prisma` (`schema.prisma`, `dev.db`, `test.db`, `migrations/`, `seed.ts`), `tests` (api, e2e, unit), `types/index.ts`, `docs`, `middleware.ts`, `vitest.config.ts`, `playwright.config.ts`.
- **package.json scripts:** `dev, build, start, lint, db:migrate, db:seed, db:reset, test, test:e2e`.
- **Alat tes:** `vitest ^1.6.1` dan `@playwright/test ^1.64.0` (devDependencies). **Ada.**
- **Referensi Supabase:** `grep -ril supabase` (tanpa `.kilo`) → **`(none)`**. Kode Supabase lama hanya tersisa pada git-worktree `/.kilo/worktrees/flat-number/` yang **tidak terlacak git** (`git ls-files | grep .kilo` → kosong).
- **git:** `git log --oneline` → `0448960e fifth commit`, `410cc4b7 fourth commit`, `5ec93dcf third commit`, `21099533 Remove node_modules from git tracking`, `137b66c8 first commint`, `8043f04f first commit`. `git shortlog -sn` → **kosong** (clone dangkal/tanpa author terdaftar).

### 3.2 Phase 1 — Apakah bisa dijalankan? (PRJ-2, PRJ-3)

| Perintah | Hasil | Bukti |
|----------|-------|-------|
| `npx tsc --noEmit` | **PASS** | `TSC_EXIT:0` |
| `npm run build` | **PASS** | `BUILD_EXIT:0`; "○ (Static) prerendered… λ (Dynamic) server-rendered on demand" |
| `npm run dev` + curl | **PASS** | `/api/units` → `HTTP 200`; login customer → `HTTP 200`; login salah → `HTTP 401`; `/api/admin/reservations` sebagai CUSTOMER → `HTTP 403` |

- Inisialisasi DB terdokumentasi di `README.md` (`npm run db:migrate`, `npm run db:seed`) dan `prisma/seed.ts` idempoten (2 akun + 8 unit; `prisma/seed.ts:19,25`).
- **Bukan Supabase.** Tidak ada dependensi Supabase; DB lokal SQLite via Prisma.

**Route handler yang memproses nyata (bukan statis):**

| Handler | file:line | Bukti nyata |
|---------|-----------|-------------|
| Login (tulis cookie JWT) | `app/api/auth/login/route.ts:5-35` | Uji #4 `200` |
| Register (tulis user) | `app/api/auth/register/route.ts:13-40` | Uji #11 audit lalu `200` |
| Forgot Password (token + outbox) | `app/api/auth/forgot-password/route.ts` | Uji §3.2 forgot → token len=64 |
| Reset Password (transaksi) | `app/api/auth/reset-password/route.ts` | Uji reset `200`, reuse token `400` |
| Availability (baca reservasi + lock) | `app/api/units/[id]/availability/route.ts:44-84` | Uji blokir slot PENDING |
| Acquire lock (transaksi) | `app/api/locks/route.ts:47-150` | Uji #7 `STATUS=200` |
| Create reservation (harga server) | `app/api/reservations/route.ts:31-79` | Uji #8 `amount=30000 hours=2` |
| **Ubah status reservasi (transaksi)** | `app/api/reservations/[id]/route.ts:37-97` | Uji #9 `403`, #10 `200` |
| Admin list reservations | `app/api/admin/reservations/route.ts:12-29` | Uji admin `200` (tanpa `password_hash`) |

### 3.3 Phase 2 — Peran & Fitur (ROL-1, FTR-1/2/3)

**Peran & rute:**

| Peran | Halaman/Rute | Catatan |
|-------|--------------|---------|
| Publik | `/`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/dev/mail` | `/dev/mail` 404 saat `NODE_ENV=production` |
| CUSTOMER | `/customer`, `/customer/book/[id]`, `/customer/reservations` | **Fokus uji paling masuk akal** |
| ADMIN | `/admin` | Dashboard baca + tombol transisi status |

Middleware melindungi `/customer` dan `/admin` (`middleware.ts:10`); `/admin` butuh `role==="ADMIN"` (`middleware.ts:54-55`); API admin memakai `requireAdmin()` (`app/api/admin/reservations/route.ts:12`, `lib/auth.ts:103-110`).

**Autentikasi (FTR-2):**

| Fitur | Halaman ada? | Panggil backend nyata? | Jalur penuh tembus? | Bukti |
|-------|--------------|------------------------|---------------------|-------|
| Login | Ya (`app/auth/login/page.tsx:23`) | Ya → `POST /api/auth/login` | **YA** | Uji #4 `200`; Uji #5 `401` |
| Register | Ya (`app/auth/register/page.tsx:33`) | Ya → `POST /api/auth/register` | **YA** | `role` selalu `CUSTOMER` (`app/api/auth/register/route.ts:36`) |
| Forgot Password | Ya (`app/auth/forgot-password/page.tsx:21`) | Ya → `POST /api/auth/forgot-password` | **YA (penuh)** | Uji forgot: dua email (ada/tidak ada) → respons **identik** `200`; token 64 hex di `/dev/mail`; reset `200`; login sandi baru `200`; pakai ulang token `400` |

**Fitur tambahan untuk peran CUSTOMER (FTR-3):**

| Fitur | Entry point (rute + file) | Skenario uji | E2E? | Bukti |
|-------|---------------------------|--------------|------|-------|
| Katalog unit + filter tipe | `/customer` — `app/customer/page.tsx` | Buka katalog, filter PC/PS5/VIP | **YES** | Uji `/api/units` `200` |
| Detail unit + spesifikasi | `/customer/book/[id]` | Buka detail, lihat spesifikasi | **YES** | `lib/serialize.ts` parse TEXT→objek |
| Ketersediaan slot per jam | `/customer/book/[id]`; API `availability/route.ts` | Pilih tanggal, lihat slot 08:00-23:00 WIB | **YES** | Uji availability (slot lampau & terblokir `false`) |
| Lock 15 menit | `hooks/useReservations.ts`; API `locks/route.ts` | Pilih slot, "Continue" → lock | **YES** | Uji #7 `STATUS=200 {"success":true,...}` |
| Buat reservasi (harga server) | `app/customer/book/[id]/page.tsx:404`; API `reservations/route.ts` | Konfirmasi → reservasi PENDING | **YES** | Uji #8 `200 status=PENDING amount=30000` |
| Lihat reservasi sendiri | `/customer/reservations`; API `reservations/mine` | Buka daftar reservasi | **YES** | E2E booking.spec |
| Batalkan reservasi PENDING | `app/customer/reservations/page.tsx:164-171`; API PATCH | Klik Cancel → konfirmasi | **YES** | Uji #10 `200 status=CANCELLED`; E2E booking.spec |
| Logout | semua header; `app/api/auth/logout/route.ts` | Klik logout | **YES** | `clearSessionCookie()` |
| Dashboard admin (baca) | `/admin`; API `admin/reservations` | Admin melihat statistik & daftar | **YES** | Uji admin `200` |
| Ubah status reservasi (admin) | `app/admin/page.tsx:25,48,304-318`; API PATCH | Confirm/Start/Complete/No-show/Cancel | **YES** | Uji #9/#10; CONFIRM set PAID |

**FTR-1: PASS** — 3 fitur autentikasi berfungsi + ≥5 fitur tambahan berfungsi.

### 3.4 Phase 3 — Input & Validasi (RDY-3)

Batas divalidasi bersama klien+server di `lib/validation.ts`:

| Field | Tipe | Divalidasi di | Batas nyata | Bukti (file:line) |
|-------|------|---------------|-------------|-------------------|
| `full_name` | text | **klien + server** | min 2, max 100 | `lib/validation.ts:21-22,31-35`; klien `app/auth/register/page.tsx:92` |
| `email` | email | **klien + server** | format email, max 254 | `lib/validation.ts:23,40-44`; klien `app/auth/login/page.tsx:77` |
| `phone_number` | tel | **klien + server** | max 20, opsional | `lib/validation.ts:24,49-52`; klien `app/auth/register/page.tsx:124` |
| `password` (register/reset) | password | **klien + server** | min 8, max 72, ≥1 huruf & ≥1 angka | `lib/validation.ts:25-26,61-66`; klien `app/auth/register/page.tsx:139` |
| `password` (login) | password | **klien + server** | min 1, max 72 | `lib/validation.ts:81` |
| `confirm_password` | password | **klien** (skema form) | harus sama dengan `password` | `lib/validation.ts:100-109`; `app/auth/reset-password/page.tsx:47` |
| `token` (reset) | text | **server** | min 1 | `lib/validation.ts:102` |
| `type` (query unit) | enum | **server** | `PC|PS5|VIP` | `app/api/units/route.ts:9` |
| `date` (query) | text | **server** | regex `^\d{4}-\d{2}-\d{2}$` | `app/api/units/[id]/availability/route.ts:9` |
| `start_time`/`end_time` (lock) | datetime | **server** | ISO ber-offset + jam penuh + jendela 08:00-24:00 WIB + start<end | `app/api/locks/route.ts:17-18,82-98` |
| `session_id` (reservasi) | text | **server** | min 1 | `app/api/reservations/route.ts:9` |
| `status` (PATCH) | enum | **server** | 6 nilai status | `app/api/reservations/[id]/route.ts:14-23` |

- **Ketidaksesuaian klien vs server:** tidak lagi ada untuk form auth (skema yang sama diimpor kedua sisi). Klien memakai atribut `maxLength`/`minLength` **dan** skema zod, sehingga aturan tidak berbeda.
- **Field tanpa validasi:** tidak ditemukan pada input kritis.

**EP & BVA (berbasis batas nyata kode):**

| # | Field | Partisi Ekuivalen | Nilai BVA | Sudah diuji? |
|---|-------|-------------------|-----------|--------------|
| 1 | password | valid; terlalu pendek; terlalu panjang; tanpa huruf; tanpa angka | **7, 8, 9, 71, 72, 73** | Ya (`tests/unit/validation.test.ts`) |
| 2 | full_name | valid; kosong/1; >100 | **1, 2, 100, 101** | Ya |
| 3 | email | valid; tanpa `@`; 254; 255 | **254, 255** | Ya |
| 4 | phone_number | kosong; 20; 21 | **0, 20, 21** | Ya |
| 5 | password login | kosong; 1; 72 | **0, 1, 72** | Ya (min 1) |
| 6 | `type` query | PC/PS5/VIP; lain | "PC","PS5","VIP","BOGUS" | Audit lalu (`400`) |
| 7 | `start/end_time` | jam penuh; di luar jam; start≥end | 07:00, 08:00, 23:00-24:00, 12:00-12:00 | Audit lalu (400/409) |
| 8 | `status` PATCH | transisi sah; tidak sah | mis. `PENDING->CONFIRMED`, `COMPLETED->ACTIVE` | Ya (`tests/unit/reservation-status.test.ts`) |

**Vonis RDY-3 = PASS** — variasi input & batas cukup untuk EP dan BVA.

### 3.5 Phase 4 — White-box & Otomasi (RDY-4, RDY-5)

**5 fungsi dengan cabang terbanyak (perkiraan decision point):**

| # | Fungsi | file:line | ± cabang | Cakupan white-box |
|---|--------|-----------|----------|-------------------|
| 1 | `POST` acquire lock | `app/api/locks/route.ts:47-150` | ~10 | unit tidak ada / maintenance / start≥end / bukan jam penuh / di luar jam / bentrok reservasi / bentrok lock pengguna lain / sukses |
| 2 | `handleConfirm` | `app/customer/book/[id]/page.tsx:126-190` | ~8 | belum login / tanpa session / 409 kedaluwarsa / gagal lain / tanpa data / sukses |
| 3 | `POST` forgot-password + `rateLimit` | `app/api/auth/forgot-password/route.ts` | ~6 | throttled IP/email / email ada / tidak ada / body invalid |
| 4 | `PATCH` reservation | `app/api/reservations/[id]/route.ts:37-97` | ~6 | tidak ditemukan / bukan pemilik / transisi tak ada / peran tak sah / sukses |
| 5 | `GET` availability | `app/api/units/[id]/availability/route.ts:27-84` | ~4 | belum login / date invalid / ada reservasi / ada lock lain / slot lewat |

**Tes yang ada:** `tests/unit/{utils,validation,reservation-status}.test.ts`, `tests/api/booking.test.ts`, `tests/e2e/{auth,booking}.spec.ts`; konfigurasi `vitest.config.ts` & `playwright.config.ts`.

**Hasil tes nyata:**

| Perintah | Hasil |
|----------|-------|
| `npm test` | `Test Files 4 passed (4)` / `Tests 63 passed (63)`; `TEST_EXIT:0` |
| `npm run test:e2e` | `4 passed (19.0s)`; `E2E_EXIT:0` (auth: wrong password, inline register errors, forgot+reset; booking: book 2 slot lalu cancel) |

**Selector:** `data-testid` dipakai hemat dan hanya bila teks/role ambigu: `cancel-reservation` (`app/customer/reservations/page.tsx:170`) dan `admin-action-${action.to}` (`app/admin/page.tsx:315`). Tombol lokasi memakai role/name (mis. `10:00`), form memakai label ↔ `htmlFor` (`app/auth/*`).

**Prasyarat otomasi:** seed (`npm run db:seed`) menyediakan `admin@gamerent.local`/`customer@gamerent.local`; DB uji `prisma/test.db` (migrasi+seed otomatis oleh `tests/api/global-setup.ts` dan `tests/e2e/global-setup.ts`); `AUTH_SECRET`/`APP_URL` di env; untuk alur reset, token dibaca dari tabel `email_outbox`. Tidak perlu "disable email confirmation" karena tidak ada konfirmasi email.

**Vonis: RDY-4 = PASS; RDY-5 = PASS.**

### 3.6 Phase 6 — Sumber Kebutuhan (REQ-1)

- **SRS_PATH tidak diberikan** dan **tidak ada berkas SRS/requirements** di repo (`find . -iname "*srs*" -o -iname "*requirement*" -o -iname "*kebutuhan*"` → kosong). Isi `docs/` hanya `docs/legacy-supabase/migrations/001_initial_schema.sql` (artefak SQL lama) dan laporan ini.
- Tidak ada ID requirement/status implementasi untuk dibandingkan.
- **Vonis REQ-1 = NEEDS-STUDENT.**

### 3.7 Phase 5 — CRUD, Perubahan Status, Business Rule (RDY-6)

| Item | Tipe | Lokasi | Cara menguji |
|------|------|--------|--------------|
| Siklus status reservasi | status change | `lib/reservation-status.ts:48-80`; `app/api/reservations/[id]/route.ts` | Uji #9 (`403`), #10 (`200`) |
| Transisi PENDING→CONFIRMED (payment PAID + verifier) | status change | `lib/reservation-status.ts:51-56`; route `effect` | Audit lalu: `payment=PAID verified_at=true` |
| Lock booking + kedaluwarsa 15 menit | workflow | `app/api/locks/route.ts` (`LOCK_MINUTES`); `app/api/reservations/route.ts:48` | Uji #8 (`409`); audit lalu lock kedaluwarsa `409` |
| Perhitungan harga | business rule | `app/api/reservations/route.ts:59-62` | Uji #8: 2 jam × 15000 = `30000`; klien kirim `total_amount:1` diabaikan |
| Pencegahan bentrok/double-booking | business rule | `app/api/locks/route.ts:100-126` | Uji #7b bentrok `409` |
| Back-to-back tidak dianggap bentrok | business rule | `app/api/locks/route.ts:100-108` | Uji back-to-back `200` |
| PENDING memblokir ketersediaan | business rule | `availability/route.ts:50,76`; `locks/route.ts:112` | Uji: slot 14:00 WIB `available:false` setelah ada PENDING |
| Jendela 08:00-24:00 WIB, jam penuh | business rule | `app/api/locks/route.ts:82-98` | Uji 400 (audit lalu) |
| Slot tidak berurutan ditolak | business rule | `lib/utils.ts:73-84`; `app/customer/book/[id]/page.tsx:95,100,325,341` | Tes unit `areSlotsContiguous`; tombol Continue disabled |
| Akses berbasis peran | business rule | `lib/auth.ts:103-110`; `middleware.ts:54-55` | Uji `403` API admin; `307` `/admin`→`/customer` (audit lalu) |
| Unit CRUD admin | CRUD | **tidak ada** (tautan dihapus; README menandai "Not implemented yet") | — |

**Huruf CRUD untuk CUSTOMER:** **Create ✅** (reservasi, akun), **Read ✅** (unit, reservasi), **Update ✅** (status reservasi, password), **Delete ⚠️** (hanya lock yang dapat dihapus; reservasi dibatalkan sebagai *status change*, bukan dihapus). Untuk ADMIN: Read ✅ (unit, reservasi), Update ✅ (status reservasi).

**Vonis RDY-6 = PASS** — sekaligus memenuhi daftar OR (CRUD, status changes, workflow, business rules).

---

## 4. Temuan Risiko (Phase 7)

| Kode | Risiko | Vonis | Bukti |
|------|--------|-------|-------|
| a | PENDING tidak memblokir ketersediaan | **FIXED** | `availability/route.ts:50` menyertakan `PENDING`; Uji: slot 14:00 WIB `available:false` setelah reservasi PENDING dibuat |
| b | Lock menutupi seluruh unit, bukan rentang waktu | **FIXED** | `ReservationLock` menyimpan `start_time`/`end_time` (`prisma/schema.prisma`); overlap per rentang `app/api/locks/route.ts:114-126` |
| c | Back-to-back salah dianggap bentrok | **FIXED** | Pertidaksamaan tegas `start < other.end && end > other.start` (`locks/route.ts:100-108`); Uji back-to-back `200` |
| d | Slot tak berurutan ditagih per slot (beda dengan server) | **FIXED** | `lib/utils.ts:73-84` `areSlotsContiguous`; `app/customer/book/[id]/page.tsx:95,99-101,325,341` — Continue diblokir bila tidak berurutan; `tests/unit/utils.test.ts` menguji gap |
| e | Pengguna dapat mengubah perannya menjadi ADMIN | **FIXED** | `role` tidak ada di `registerSchema`; `app/api/auth/register/route.ts:36` selalu `role: 'CUSTOMER'` |
| f | `/admin` dapat diakses tanpa peran ADMIN | **FIXED** | Uji `403` API admin sbg CUSTOMER; `middleware.ts:54-55` redirect; `lib/auth.ts:103-110` |
| g | Total reservasi dihitung klien & dipercaya server | **FIXED** | Body hanya `session_id` (`reservations/route.ts:8-9`); harga dihitung server (`:59-62`); Uji kirim `total_amount:1` → hasil `30000` |
| h | Reservasi dibuat tanpa lock valid | **FIXED** | Uji `{"session_id":"nope"}` → `409`; lock dikonsumsi (`reservations/route.ts:78`) |
| i | Tanggal pakai `toISOString()` (UTC) & slot lampau bisa dipilih | **FIXED** | Helper tanggal lokal (`app/customer/book/[id]/page.tsx:27-34`); `availability/route.ts:78` tandai `alreadyStarted`; Uji: slot sebelum sekarang `false` |
| j | Password/hash dikembalikan respons API | **FIXED** | Login membuang `password_hash`; respons login/admin tidak memuatnya (`grep password_hash` pada respons) |
| k | Galat login mengungkap keberadaan email | **FIXED** | Uji #5: email ada & tidak ada sama-sama `401 {"error":"Invalid email or password"}` (`app/api/auth/login/route.ts:12,30`) |
| l | `.env.local` dilacak git | **FIXED** | `git ls-files | grep -i env` → `.env.example`, `next-env.d.ts`; `git check-ignore .env.local` → `.gitignore:8:.env*` |

**Semua 12 risiko lama berstatus FIXED.**

**Catatan non-pemblokir (bukan risiko checklist):**

| # | Temuan | Bukti |
|---|--------|-------|
| 1 | Unit admin CRUD (tambah/edit unit) belum ada; sudah dihapus tautannya dan ditandai "Not implemented yet" | `README.md` §Not implemented yet |
| 2 | Rate limit forgot-password hanya in-memory (tidak berlaku multi-instance) | `app/api/auth/forgot-password/route.ts` (`Map` per-proses) |
| 3 | `/dev/mail` publik, hanya dilindungi `404` saat production | `app/dev/mail/page.tsx` |

---

## 5. Prioritas Perbaikan

**Tidak ada item yang memblokir kode checklist** — seluruh kode PRJ/FTR/RDY bernilai PASS, dan tiga kode tersisa (PRJ-1, UNQ-1, REQ-1) dinilai oleh mahasiswa, bukan oleh perbaikan kode.

Saran non-pemblokir (opsional, di luar syarat checklist):
1. **Susun SRS** (`docs/SRS.md` atau di luar repo) dengan ID requirement + status, untuk menutup REQ-1.
2. Deklarasikan **CUSTOMER** sebagai fokus pengujian di SRS untuk menguatkan ROL-1.
3. Bila ingin menambah cakupan admin: tambahkan endpoint CRUD unit (Create/Update/Delete) dengan `requireAdmin()`.

---

## 6. Pertanyaan untuk Mahasiswa (PRJ-1)

Pertanyaan berikut menunjuk kode nyata dan harus dapat dijawab mahasiswa:

1. Pada `app/api/locks/route.ts`, jelaskan urutan langkah dalam `prisma.$transaction` dan mengapa pembersihan lock kedaluwarsa dilakukan **sebelum** pengecekan bentrok.
2. Bagaimana cek di `app/api/locks/route.ts:100-126` menjamin dua pengguna tidak memperoleh slot yang sama? Mengapa perlu memeriksa `reservation` dan `reservationLock` secara terpisah?
3. Mengapa harga dihitung di server (`app/api/reservations/route.ts:59-62`) dan bukan dari data klien? Tunjukkan bahwa body hanya berisi `session_id`.
4. Apa yang terjadi saat lock kedaluwarsa — jelaskan perbedaan peran `expires_at` di `app/api/reservations/route.ts:48` dan pembersihan di `app/api/locks/route.ts`.
5. Mengapa peran ADMIN diverifikasi ulang dari database (`lib/auth.ts:103-110`) alih-alih hanya mempercayai `role` dari JWT?
6. Jelaskan isi tabel `TRANSITIONS` di `lib/reservation-status.ts:48-80` dan efek samping PENDING→CONFIRMED (payment PAID + verifier) serta CONFIRMED→CANCELLED (REFUNDED).
7. Mengapa `role` tidak ada di `registerSchema` (`lib/validation.ts:70-77`) dan apa hasilnya bila klien mengirim `role:"ADMIN"`?
8. Bagaimana alur reset password membuktikan token hanya sekali pakai — jelaskan peran `randomBytes`, penyimpanan sha256, dan `used_at` di `app/api/auth/forgot-password/route.ts` & `reset-password/route.ts`.
9. Mengapa perhitungan ketersediaan memakai helper tanggal lokal (`app/customer/book/[id]/page.tsx:27-34`) dan bukan `toISOString()`, serta bagaimana slot yang sudah lewat ditandai (`app/api/units/[id]/availability/route.ts:78`)?
10. Mengapa `areSlotsContiguous` (`lib/utils.ts:73-84`) penting agar durasi/harga yang ditampilkan sama dengan yang dibuat server, dan bagaimana UI mencegah pemilihan slot tidak berurutan?

---

### Lampiran — Referensi Perintah

- `npx tsc --noEmit` → `TSC_EXIT:0`
- `npm run build` → `BUILD_EXIT:0`
- `git ls-files | grep -i env` → `.env.example`, `next-env.d.ts`; `git check-ignore -v .env.local` → `.gitignore:8:.env*`
- `grep -ril supabase …` → `(none)` (kecuali worktree tak-terlacak `.kilo/`)
- `npm test` → `Tests 63 passed (63)`
- `npm run test:e2e` → `4 passed`
- Uji API (dev pada salinan DB, port 3300): `/api/units` 200; login customer 200; login salah 401; admin API sbg customer 403; lock sukses **200**; bentrok **409**; back-to-back **200**; reservasi tanpa lock **409**; reservasi `amount=30000 hours=2 status=PENDING`; PATCH customer CONFIRMED **403**; PATCH owner CANCELLED **200**; slot PENDING `available:false`; slot lampau `available:false`; forgot-password respons identik 200; reset 200; login sandi baru 200; reuse token 400.
