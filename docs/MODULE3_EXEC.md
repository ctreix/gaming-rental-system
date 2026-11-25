# MODULE 3 — Eksekusi Uji Form Register

| Item | Nilai |
|---|---|
| Tanggal eksekusi | 2026-11-11 19:07:29–19:07:32 UTC (2026-11-12 lokal) |
| Commit | `c7906b72` (`git rev-parse --short HEAD`) |
| Branch | `main` |
| Versi aplikasi | `1.0.0` (`package.json:3`) |
| Endpoint | `POST /api/auth/register` (`app/api/auth/register/route.ts:11`) |
| Field body | `full_name`, `email`, `phone_number`, `password` (`app/api/auth/register/route.ts:20`) |
| DB | `prisma/verify_m3c.db` — salinan **baru & kosong** (`prisma migrate deploy`, tanpa `db:seed`), `users=0` sebelum run |
| Server | `next dev -p 3247`, `AUTH_SECRET` uji, `APP_URL=http://localhost:3247` |
| Runner | `docs/m3/m3_run.mjs` (dibuat khusus, dihapus setelah run) |
| Hasil | **26 kasus: 25 SESUAI, 1 BEDA (TC-EP-13)** |

## Catatan eksekusi (apa adanya)

1. `docs/m3/m3_run.mjs` **tidak ada** di repo saat tugas dimulai (begitu juga folder `docs/m3/`), sehingga skrip dibuat dari nol. Konstanta yang dipakai: `REGISTER_PATH = '/api/auth/register'`, field body `full_name / email / phone_number / password`. Tidak ada penyesuaian nama field yang diperlukan karena sudah sama dengan `route.ts:20`.
2. **Percobaan invoke #1 gagal di harness, bukan di aplikasi.** Git Bash (MSYS) mengubah nilai env `REGISTER_PATH=/api/auth/register` menjadi `C:/Program Files/Git/api/auth/register`, sehingga `fetch` melempar `ERR_INVALID_URL` **sebelum request pertama terkirim**. Tidak ada baris DB yang tertulis (`users=0` diverifikasi ulang). Eksekusi kasus kemudian dijalankan sekali dengan `MSYS_NO_PATHCONV=1`; itulah run yang dilaporkan di bawah. Tidak ada data/kasus yang diubah setelah melihat hasil.
3. Tidak ada file sumber yang diubah. `prisma/dev.db` (mtime `2026-10-09 09:58`) dan `prisma/test.db` (mtime `2026-10-08 17:13`) tidak disentuh.
4. Semua permintaan dikirim sebagai HTTP JSON langsung (bukan lewat browser), tanpa cookie jar.

---

## (a) Hasil 26 kasus

`User terbentuk`, `Role`, dan `Phone di DB` adalah hasil query langsung ke DB salinan (`prisma.user.findUnique({ where: { email } })`) **setelah** request.

| ID | HTTP aktual | Diharapkan | Sesuai | User terbentuk | Role | Phone di DB | Respons persis |
|---|---|---|---|---|---|---|---|
| TC-BVA-01 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqyah0000e1ncvuambv0p","email":"bva01-name-2@example.com","full_name":"AA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-02 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqyd90001e1ncrtallio2","email":"bva02-name-3@example.com","full_name":"AAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-03 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqyfo0002e1nceqtzlikc","email":"bva03-name-99@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-04 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqyi10003e1nctkfaeqsg","email":"bva04-name-100@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-05 | 200 | 200 | ya | ya | CUSTOMER | `NULL` | `{"user":{"id":"cmwchqyke0004e1ncslv3k28h","email":"bva05-phone-0@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":null,"role":"CUSTOMER"}}` |
| TC-BVA-06 | 200 | 200 | ya | ya | CUSTOMER | `8` | `{"user":{"id":"cmwchqynm0005e1ncgpimetsz","email":"bva06-phone-1@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8","role":"CUSTOMER"}}` |
| TC-BVA-07 | 200 | 200 | ya | ya | CUSTOMER | `8888888888888888888` | `{"user":{"id":"cmwchqyq40006e1ncl5voran2","email":"bva07-phone-19@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888888888888","role":"CUSTOMER"}}` |
| TC-BVA-08 | 200 | 200 | ya | ya | CUSTOMER | `88888888888888888888` | `{"user":{"id":"cmwchqysf0007e1nc2tf8poq3","email":"bva08-phone-20@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"88888888888888888888","role":"CUSTOMER"}}` |
| TC-BVA-09 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqyur0008e1nc8f73tkbe","email":"bva09-pass-8@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-10 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqyxl0009e1ncnllyeg6y","email":"bva10-pass-9@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-11 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqz03000ae1nczkgeo8qx","email":"bva11-pass-71@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-12 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqz2f000be1ncrz4hmsi7","email":"bva12-pass-72@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-BVA-13 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqz4o000ce1ncavf32j28","email":"bva13-nominal@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-EP-01 | 200 | 200 | ya | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqz70000de1ncvy3zvod0","email":"ep01-phone-10@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| TC-EP-02 | 200 | 200 | ya | ya | CUSTOMER | `NULL` | `{"user":{"id":"cmwchqz9a000ee1nc7wyzc8pa","email":"ep02-phone-empty@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":null,"role":"CUSTOMER"}}` |
| TC-EP-03 | 400 | 400 | ya | tidak | - | – | `{"error":"Full name must be at least 2 characters"}` |
| TC-EP-04 | 400 | 400 | ya | tidak | - | – | `{"error":"Full name must be at most 100 characters"}` |
| TC-EP-05 | 400 | 400 | ya | tidak | - | – | `{"error":"Invalid email address"}` |
| TC-EP-06 | 400 | 400 | ya | tidak | - | – | `{"error":"Email must be at most 254 characters"}` |
| TC-EP-07 | 409 | 409 | ya | ya¹ | CUSTOMER | `8888888888` | `{"error":"An account with this email already exists"}` |
| TC-EP-08 | 400 | 400 | ya | tidak | - | – | `{"error":"Phone number must be at most 20 characters"}` |
| TC-EP-09 | 400 | 400 | ya | tidak | - | – | `{"error":"Password must be at least 8 characters"}` |
| TC-EP-10 | 400 | 400 | ya | tidak | - | – | `{"error":"Password must be at most 72 characters"}` |
| TC-EP-11 | 400 | 400 | ya | tidak | - | – | `{"error":"Password must contain at least one digit"}` |
| TC-EP-12 | 400 | 400 | ya | tidak | - | – | `{"error":"Password must contain at least one letter"}` |
| TC-EP-13 | 200 | 409 | BEDA | ya | CUSTOMER | `8888888888` | `{"user":{"id":"cmwchqzk5000he1ncoanyit64","email":"EP01@Example.COM","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |

¹ TC-EP-07: baris `users` untuk `ep07-dup@example.com` dibuat oleh langkah **SETUP** sebelum kasus (register pertama, HTTP 200), bukan oleh request 409. Respons 409 tidak membuat baris baru.

- Distribusi status: **200 ×16, 400 ×9, 409 ×1**. Tidak ada 5xx.
- `users` di DB: 0 sebelum run → **18** setelah run (13 BVA + 2 EP valid + 2 setup + 1 TC-EP-13), `email_outbox` 0 → 4, `password_reset_tokens` 0 → 2.
- Semua respons 200 menyertakan `Set-Cookie: session=…` (auto-login). Semua 400/409 tidak menyetel cookie.
- Untuk BVA-05/EP-02 (`phone_number: ""`), DB menyimpan `NULL` (`app/api/auth/register/route.ts:35`, `phone_number || null`), bukan string kosong.

---

## (b) TC-EP-13 — email `EP01@Example.COM` setelah `ep01@example.com` terdaftar

**Prasyarat (SETUP):** `POST /api/auth/register` dengan `ep01@example.com` → **HTTP 200**, `id=cmwchqzhv000ge1nc4zaalshh`, `role=CUSTOMER`, `phone_number="8888888888"`.

### 4a. Status HTTP dan respons kasus

| Item | Nilai |
|---|---|
| Request | `{"full_name":"A"×50,"email":"EP01@Example.COM","phone_number":"8888888888","password":"<40 chars>"}` |
| Status | **HTTP 200** (diharapkan 409 → **BEDA**) |
| Cookie | `session` **disetel** |
| Respons persis | `{"user":{"id":"cmwchqzk5000he1ncoanyit64","email":"EP01@Example.COM","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}` |
| Baris DB baru | `id=cmwchqzk5000he1ncoanyit64`, `email="EP01@Example.COM"`, `role=CUSTOMER`, `phone_number="8888888888"`, `created_at=2026-11-11T19:07:31.590Z` |

### 4b. Mengapa email tidak dinormalisasi (nomor baris persis)

| Titik | Lokasi | Isi | Kenapa tidak menormalkan |
|---|---|---|---|
| Skema email | `lib/validation.ts:40-44` | `.string()` (:41) → `.trim()` (:42) → `.email('Invalid email address')` (:43) → `.max(EMAIL_MAX, …)` (:44) | Hanya `trim()`; **tidak ada** `.toLowerCase()` |
| Nilai yang dipakai | `app/api/auth/register/route.ts:20` | `const { full_name, email, phone_number, password } = parsed.data` | `email` dipakai apa adanya dari zod |
| **Kueri duplikat** | `app/api/auth/register/route.ts:22` | `prisma.user.findUnique({ where: { email } })` | Perbandingan **exact match**; `EP01@Example.COM` ≠ `ep01@example.com`, jadi dianggap belum ada |
| **Penyimpanan email** | `app/api/auth/register/route.ts:32` | `email,` (di dalam `data` pada `create`, `:30-39`) | Nilai asli disimpan tanpa lowercase |
| Email di JWT | `app/api/auth/register/route.ts:43` | `email,` pada `signSession` | Ikut nilai asli |
| Email di respons | `app/api/auth/register/route.ts:51` | `email,` | Ikut nilai asli |
| Bukti "tidak ada lowercase" | `lib/`, `app/api/auth/`, `app/auth/register/` | `grep -rn "toLowerCase"` → **satu-satunya** hasil: `app/api/auth/forgot-password/route.ts:64` (`email.toLowerCase()` hanya untuk **key rate limiter**, bukan untuk kueri) | Tidak ada normalisasi di jalur register |
| Constraint DB | `prisma/schema.prisma:18` | `email String @unique` | Unik, tetapi pada nilai apa adanya |
| Index SQL | `prisma/migrations/20261002060423_init/migration.sql:86` | `CREATE UNIQUE INDEX "users_email_key" ON "users"("email");` | **Tanpa `COLLATE NOCASE`** → memakai collation default SQLite `BINARY` |

**Collation SQLite (case-sensitive?) — diukur pada DB salinan setelah TC-EP-13:**

```
SELECT COUNT(*) FROM users WHERE lower(email)='ep01@example.com'        -> 2
SELECT email FROM users WHERE email='ep01@example.com' COLLATE BINARY   -> 1 baris ["ep01@example.com"]
SELECT email FROM users WHERE email='ep01@example.com' COLLATE NOCASE   -> 2 baris ["EP01@Example.COM","ep01@example.com"]
INDEX sqlite_autoindex_users_1 :: (autoindex)
INDEX users_email_key :: CREATE UNIQUE INDEX "users_email_key" ON "users"("email")
```

Kesimpulan: kolom `email` di SQLite memakai collation default **BINARY**, yaitu **case-sensitive** (`'A' ≠ 'a'`). Unique index hanya menolak duplikat dengan byte identik, sehingga dua ejaan berbeda lolos. Prisma `findUnique` mengirim `WHERE email = ?` tanpa `COLLATE NOCASE`, jadi kueri duplikat juga case-sensitive.

### 4c. Login dan forgot-password setelah dua akun ada

Kedua akun memakai password yang sama (`a`×39 + `1`).

| Aksi | Email yang dikirim | HTTP | Hasil |
|---|---|---|---|
| Login | `ep01@example.com` (persis lowercase) | **200** | Masuk sebagai `id=cmwchqzhv000ge1nc4zaalshh`, `email="ep01@example.com"` |
| Login | `EP01@Example.COM` (persis seperti dibuat) | **200** | Masuk sebagai `id=cmwchqzk5000he1ncoanyit64`, `email="EP01@Example.COM"` |
| Login | `ep01@EXAMPLE.com` (variasi) | **401** | Ditolak: `{"error":"Invalid email or password"}` |
| Login | `EP01@EXAMPLE.COM` (huruf besar semua) | **401** | Ditolak: `{"error":"Invalid email or password"}` |

Mekanisme: `app/api/auth/login/route.ts:16-17` → `findUnique({ where: { email } })` dengan email exact; `:34` mengembalikan 401 yang sama untuk email tidak dikenal dan password salah.

Forgot-password (respons selalu netral; bukti "akun ditemukan" = baris baru di `email_outbox` dan `password_reset_tokens`):

| Email yang dikirim | HTTP | Respons persis | `email_outbox` baru | `password_reset_tokens` |
|---|---|---|---|---|
| `ep01@example.com` | 200 | `{"success":true,"message":"If an account exists for this email, a reset link has been generated."}` | **1** → `to="ep01@example.com"` | 0 → 1 |
| `EP01@Example.COM` | 200 | idem | **1** → `to="EP01@Example.COM"` | 1 → 2 |
| `ep01@EXAMPLE.com` | 200 | idem | **0** | 2 → 2 |
| `EP01@EXAMPLE.COM` | 200 | idem | **0** | 2 → 2 |
| `tidak-ada@example.com` (kontrol) | 200 | idem | **0** | 2 → 2 |

Mekanisme: `app/api/auth/forgot-password/route.ts:69` → `findUnique({ where: { email } })` exact. Baris `:64` hanya me-lowercase email untuk key rate limiter, **bukan** untuk pencarian akun. Respons `:12`/`:107` selalu 200 netral, sehingga variasi yang tidak cocok tidak bisa dibedakan dari email yang tidak terdaftar.

### 4d. Dampak nyata (3 kalimat)

Pendaftaran menerima dua akun terpisah untuk alamat yang sama secara case-insensitive (`ep01@example.com` dan `EP01@Example.COM`), sehingga satu orang dapat memiliki dua akun dengan riwayat reservasi dan kuota yang terpecah — terbukti dari dua baris `users`, dua token reset, dan `lower(email)` yang menghitung 2. Login hanya berhasil bila ejaan diketik **persis** seperti yang tersimpan, sehingga pengguna yang mengetik `ep01@EXAMPLE.com` ditolak 401 walaupun akunnya ada — terbukti. Lupa-password juga hanya memproses ejaan yang persis cocok dan tetap membalas 200 netral, sehingga permintaan reset untuk variasi huruf lain tidak menghasilkan email apa pun tanpa pesan kesalahan — terbukti dari `email_outbox` yang tidak bertambah.

---

## (c) Atribut klien dan teks pesan

### c1. Atribut per input (`app/auth/register/page.tsx`)

`<form>` di `:82` **tanpa** `noValidate`, sehingga constraint validation bawaan browser berjalan sebelum `handleRegister`.

| Field | `id` | `type` | `maxLength` | `minLength` | `required` | `pattern` |
|---|---|---|---|---|---|---|
| `full_name` | `register-name` (:86) | `text` (:87) | **100** (:92) | TIDAK ADA | **ya** (:93) | TIDAK ADA |
| `email` | `register-email` (:102) | `email` (:103) | **254** (:108) | TIDAK ADA | **ya** (:109) | TIDAK ADA |
| `phone_number` | `register-phone` (:118) | `tel` (:119) | **20** (:124) | TIDAK ADA | **tidak** | TIDAK ADA |
| `password` | `register-password` (:133) | `password` (:134) | **72** (:139) | **8** (:141) | **ya** (:140) | TIDAK ADA |

`pattern` tidak ditemukan di file ini (`grep "pattern="` → kosong). Nilai batas berasal dari konstanta bersama `lib/validation.ts:21-26` (`NAME_MAX=100`, `EMAIL_MAX=254`, `PHONE_MAX=20`, `PASSWORD_MIN=8`, `PASSWORD_MAX=72`), jadi tidak bisa melenceng dari aturan server.

### c2. Kasus yang tidak bisa lewat UI — TC-EP-04, 06, 08, 10

| Kasus | Nilai uji | Bisa diketik/di-paste lewat UI? | Penghalang |
|---|---|---|---|
| TC-EP-04 | `full_name` 101 | **Tidak** | `maxLength=100` (`:92`) |
| TC-EP-06 | `email` 255 | **Tidak** | `maxLength=254` (`:108`) |
| TC-EP-08 | `phone` 21 | **Tidak** | `maxLength=20` (`:124`) |
| TC-EP-10 | `password` 73 | **Tidak** | `maxLength=72` (`:139`) |

Nilai tersebut hanya bisa dikirim lewat devtools/HTTP langsung (seperti pada run ini); server tetap menolaknya dengan 400.

### c3. TC-EP-03, 05, 09, 11, 12 — siapa menolak lebih dulu

| Kasus | Nilai | Penolak pertama | Alasan |
|---|---|---|---|
| TC-EP-03 | `full_name` 1 | **Skema klien (zod)** | `required` hanya menolak string kosong; 1 karakter lolos native, lalu `registerSchema.safeParse` (`:33`) gagal dan `fetch` (`:47`) tidak dijalankan |
| TC-EP-05 | `email` `invalid-email` | **Validasi native browser** | `type="email"` (`:103`) + `required` (`:109`) → `typeMismatch`, submit diblokir sebelum `handleRegister` |
| TC-EP-09 | `password` 7 | **Validasi native browser** | `minLength=8` (`:141`) → `tooShort`, submit diblokir |
| TC-EP-11 | `password` `abcdefgh` | **Skema klien (zod)** | 8 karakter lolos `minLength`/`required`, lalu zod gagal aturan digit |
| TC-EP-12 | `password` `12345678` | **Skema klien (zod)** | 8 karakter lolos native, lalu zod gagal aturan huruf |

### c4. Teks pesan zod persis (`lib/validation.ts`)

| Kondisi | Field | Teks persis | Baris |
|---|---|---|---|
| Nama pendek | `full_name` | `Full name must be at least 2 characters` | `:34` |
| Nama panjang | `full_name` | `Full name must be at most 100 characters` | `:35` |
| Email format salah | `email` | `Invalid email address` | `:43` |
| Email panjang | `email` | `Email must be at most 254 characters` | `:44` |
| Phone panjang | `phone_number` | `Phone number must be at most 20 characters` | `:52` |
| Password pendek | `password` | `Password must be at least 8 characters` | `:63` |
| Password panjang | `password` | `Password must be at most 72 characters` | `:64` |
| Password tanpa huruf | `password` | `Password must contain at least one letter` | `:65` |
| Password tanpa angka | `password` | `Password must contain at least one digit` | `:66` |
| Email duplikat | `email` | `An account with this email already exists` — **bukan zod**, dari server `app/api/auth/register/route.ts:25`, ditampilkan di paragraf error global `app/auth/register/page.tsx:147-149` | `route.ts:25` |

Tidak ada pesan zod untuk format `phone_number` maupun format `full_name` (tidak ada aturan format), dan tidak ada aturan panjang minimum untuk `email`.

Di klien, `fieldErrors()` (`lib/validation.ts:4-12`) menyimpan **satu** pesan pertama per field dan halaman merender satu `<p>` per field (`:95-97`, `:111-113`, `:126-128`, `:143-145`).

---

## (d) Info build

| Item | Nilai | Sumber |
|---|---|---|
| Versi aplikasi | **1.0.0** | `package.json:3` |
| Commit pendek | **`c7906b72`** | `git rev-parse --short HEAD` |
| Branch | `main` | `git` |
| Next.js | 14.1.4 | `package.json` / `node_modules` |
| React | ^18.2.0 | `package.json` |
| Prisma CLI & client | 6.19.3 | `package.json` |
| zod (deklarasi / terpasang) | ^3.22.4 / **3.25.76** | `package.json` / `node_modules/zod/package.json` |
| Node saat eksekusi | v24.15.0 | `node -v` |
| OS | Windows, shell Git Bash | lingkungan eksekusi |

---

## (e) HASIL YANG BEDA DARI EKSPEKTASI

1. **TC-EP-13 — `EP01@Example.COM` diterima sebagai akun kedua (HTTP 200, bukan 409).** Diperkirakan 409 karena alamat dianggap sama secara case-insensitive; aktualnya 200 dan baris `users` baru terbentuk (`id=cmwchqzk5000he1ncoanyit64`), sehingga ada dua akun untuk alamat yang sama. Penyebab: `app/api/auth/register/route.ts:22` memakai exact match, `:32` menyimpan email apa adanya, `lib/validation.ts:40-44` tanpa `toLowerCase()`, dan unique index `users_email_key` (`migration.sql:86`) memakai collation BINARY (case-sensitive).
2. **Login dan forgot-password ikut case-sensitive** (konsekuensi dari #1): `ep01@EXAMPLE.com` → 401; forgot-password untuk variasi itu tidak menghasilkan email reset, tetapi tetap membalas 200 netral. Ini bukan "BEDA" terhadap ekspektasi 26 kasus, tetapi berbeda dari perilaku yang biasanya diharapkan pada sistem email.

Tidak ada baris BEDA lain: 25 dari 26 kasus sesuai, tanpa 5xx.

## TIDAK PASTI

1. **Teks tooltip native browser** (mis. untuk `type="email"` atau `minLength=8`) — **TIDAK PASTI**; tidak dijalankan di browser, teks bergantung browser + locale.
2. **Perilaku UI untuk TC-EP-03/04/05/06/08/09/10/11/12** — disimpulkan dari kode klien (`maxLength`/`minLength`/`required`/`type`/`noValidate`), **tidak** dieksekusi lewat browser.
3. **Dua request register bersamaan dengan email sama (race)** — **TIDAK PASTI**; tidak diuji. `prisma.user.create` (`route.ts:30-39`) tidak dibungkus `try/catch`, sehingga pelanggaran unique berpotensi menjadi 500, bukan 409.
4. **Ekspektasi 409 pada TC-EP-13 adalah asumsi desain** (email case-insensitive). Bila spesifikasi memang mengizinkan email case-sensitive, TC-EP-13 bukan cacat, melainkan perilaku yang perlu ditetapkan; kode saat ini konsisten dengan exact match, bukan dengan normalisasi.
5. **Dampak lintas-fitur lain** (mis. reset-password memakai token per akun, bukan per alamat) tidak diuji di luar forgot-password.

---

## Lampiran — file yang dibuat / dihapus

| File | Status | Keterangan |
|---|---|---|
| `docs/m3/m3_results.csv` | **dibuat (permanen)** | 26 baris hasil + header |
| `docs/m3/m3_evidence.log` | **dibuat (permanen)** | 273 baris log mentah run |
| `docs/MODULE3_EXEC.md` | **dibuat (permanen)** | Dokumen ini |
| `docs/m3/m3_run.mjs` | dibuat sementara, **dihapus** | Runner 26 kasus + probe login/forgot |
| `prisma/verify_m3c.db` | dibuat sementara, **dihapus** | DB salinan baru & kosong (`migrate deploy`, tanpa seed) |
| `.m3_server.log` | dibuat sementara, **dihapus** | Log `next dev -p 3247` |

Tidak ada perubahan pada `app/`, `lib/`, `components/`, `prisma/schema.prisma`, `prisma/dev.db`, maupun `prisma/test.db`. Server uji (`next dev -p 3247`, PID dari proses background) dihentikan setelah run.
