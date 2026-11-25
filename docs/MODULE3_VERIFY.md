# MODULE 3 — Verifikasi Desain Tes Form Register

Dokumen ini adalah hasil **verifikasi read-only** atas form Register (`/auth/register` + endpoint `POST /api/auth/register`) untuk kebutuhan BVA/EP.

| Item | Nilai |
|---|---|
| Tanggal verifikasi | 2026-11-09 |
| Commit diverifikasi | `c7906b72` (`git rev-parse --short HEAD`) |
| Branch | `main` |
| Versi aplikasi | `1.0.0` (`package.json:3`) |
| Node / npm saat verifikasi | v24.15.0 / 12.2.2 |
| Metode | Baca kode + eksekusi 25 request HTTP ke server lokal pada **DB uji terpisah** |

**Batasan read-only yang dipatuhi:** tidak ada file sumber yang diubah. `prisma/dev.db` tidak disentuh (mtime tetap `2026-10-09 09:58:28`, sama sebelum dan sesudah). `prisma/test.db` juga tidak disentuh (mtime tetap `2026-10-08 17:13:44`). Semua eksekusi memakai `prisma/verify_m3.db` dan `prisma/verify_m3b.db` (file sementara, dihapus setelah verifikasi). Daftar file yang dibuat/dihapus ada di bagian akhir.

Kode yang menjadi sumber kebenaran:

- `lib/validation.ts` — skema zod yang **dipakai bersama** oleh halaman dan route.
- `app/auth/register/page.tsx` — form klien.
- `app/api/auth/register/route.ts` — route handler.
- `lib/auth.ts` — cookie sesi & hashing.
- `prisma/schema.prisma` — constraint DB.

---

## A. Aturan validasi

### A1. `full_name`

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| Min / max | 2 / 100 karakter | `lib/validation.ts:21-22` (`NAME_MIN=2`, `NAME_MAX=100`), diterapkan di `lib/validation.ts:34-35` |
| Di-trim sebelum dihitung? | **Ya.** `.trim()` dipanggil **sebelum** `.min()`/`.max()` | `lib/validation.ts:33` |
| Spasi saja dianggap kosong? | **Ya.** `"   "` → `""` → gagal `min(2)` | `lib/validation.ts:33-34`; dieksekusi: `400 {"error":"Full name must be at least 2 characters"}` |
| Trim juga terlihat di data tersimpan? | **Ya.** `"  Bob  "` tersimpan sebagai `"Bob"` | dieksekusi: `200` dengan `"full_name":"Bob"` |
| Atribut klien | `maxLength=100`, `required`; **tanpa** `minLength` | `app/auth/register/page.tsx:92-93` |

Catatan: karena trim ada di skema bersama, nilai yang dikirim klien sudah ter-trim (`JSON.stringify(parsed.data)`, `app/auth/register/page.tsx:50`), dan server men-trim ulang.

### A2. `email`

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| Aturan format | Regex default zod `.email()`: `/^(?!\.)(?!.*\.\.)([A-Z0-9_'+.\-]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i` | `lib/validation.ts:43`; regex persis di `node_modules/zod/v3/types.js:384` (zod terpasang **3.25.76**) |
| Max | **254 karakter** | `lib/validation.ts:23` (`EMAIL_MAX=254`), diterapkan `lib/validation.ts:44` |
| Urutan | `trim()` → `.email()` → `.max(254)` | `lib/validation.ts:42-44` |
| Di-trim? | **Ya** | `lib/validation.ts:42` |
| Di-lowercase? | **TIDAK.** Tidak ada `.toLowerCase()` di skema maupun route | `lib/validation.ts:40-44`; `app/api/auth/register/route.ts:22,30-39` |
| Lokasi cek duplikat | Di route, **setelah** validasi lolos: `prisma.user.findUnique({ where: { email } })` | `app/api/auth/register/route.ts:22` |
| Constraint DB | `email String @unique` | `prisma/schema.prisma:18` |
| Status & pesan duplikat | **409** `{"error":"An account with this email already exists"}` | `app/api/auth/register/route.ts:23-27`; dieksekusi TC-EP-07 |

Konsekuensi yang **terbukti** saat eksekusi: cek duplikat **case-sensitive** dan tidak menormalkan huruf. `"CaseMix@Example.COM"` dan `"casemix@example.com"` **sama-sama diterima** sebagai dua akun berbeda (keduanya `200`), dan nilai tersimpan mempertahankan huruf aslinya.

Catatan urutan: email 255 karakter yang **formatnya valid** menghasilkan `"Email must be at most 254 characters"` (bukan error format), karena `.email()` dicek lebih dulu — terbukti di TC-EP-06.

### A3. `phone_number`

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| Max | **20 karakter** (setelah trim) | `lib/validation.ts:24` (`PHONE_MAX=20`), diterapkan `lib/validation.ts:52` |
| Aturan format (digit saja / `+` / spasi / `-`)? | **TIDAK ADA.** Satu-satunya aturan adalah panjang maksimum | `lib/validation.ts:49-54` — tidak ada `.regex()`, `.refine()`, atau `.startsWith()` |
| String kosong diterima? | **Ya** (`200`), lalu disimpan sebagai `NULL` | skema `lib/validation.ts:52-54`; `app/api/auth/register/route.ts:35` (`phone_number || null`); dieksekusi TC-BVA-05 & TC-EP-02 |
| Field dihilangkan dari body? | **Ya**, default `''` → tersimpan `NULL` | `lib/validation.ts:53-54`; dieksekusi (spot check) |
| Di-trim? | **Ya**; `"   "` → `''` → `NULL` | `lib/validation.ts:51`; dieksekusi (spot check) |
| Karakter non-digit | Diterima apa adanya, mis. `"+62 812-3456-7890"` tersimpan verbatim | dieksekusi (spot check, `200`) |
| Atribut klien | `maxLength=20`, **tidak** `required`, **tanpa** `pattern` | `app/auth/register/page.tsx:124` |

### A4. `password`

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| Min / max | **8 / 72** | `lib/validation.ts:25-26`, diterapkan `lib/validation.ts:63-64` |
| Wajib huruf | **Ya**, regex persis `/[A-Za-z]/` | `lib/validation.ts:65` |
| Wajib angka | **Ya**, regex persis `/[0-9]/` | `lib/validation.ts:66` |
| Huruf besar / simbol wajib? | **Tidak** — tidak ada aturan tambahan | `lib/validation.ts:61-66` |
| Di-trim? | **Tidak.** Spasi ikut dihitung dan dipertahankan | `lib/validation.ts:61-66` (tidak ada `.trim()`); dieksekusi: 8 spasi → `400 "Password must contain at least one letter"` |
| Dihitung per karakter atau per byte? | **Per code unit UTF-16** (panjang string JavaScript), **bukan** byte dan **bukan** code point | dieksekusi: `'a'×71 + '😀'` = 72 code point tetapi panjang JS 73 → `400 "Password must be at most 72 characters"` |
| Hashing | bcryptjs cost 10 | `lib/auth.ts:143-145` |

Implikasi untuk BVA: satu emoji dihitung **2**, sehingga batas 72 dapat tercapai oleh kurang dari 72 karakter yang terlihat.

### A5. Urutan validasi & jumlah error

- Skema objek disusun dalam urutan **`full_name` → `email` → `phone_number` → `password`** (`lib/validation.ts:70-75`). Zod memproses key sesuai urutan shape tersebut.
- `safeParse` mengumpulkan **semua** issue, **tetapi** route hanya mengembalikan **satu** pesan: `parsed.error.issues[0]?.message` (`app/api/auth/register/route.ts:16`).
- Terbukti dieksekusi: request dengan 4 field salah sekaligus (`full_name` 1, `email` `"bad"`, `phone` 21, `password` 1) → `400 {"error":"Full name must be at least 2 characters"}` — **hanya error pertama**.
- Di klien, `fieldErrors()` menyimpan **satu pesan pertama per field** (`lib/validation.ts:4-12`), lalu halaman merender satu `<p>` per field (`app/auth/register/page.tsx:95-97, 111-113, 126-128, 143-145`). Artinya: beberapa field dapat menampilkan error **bersamaan**, tetapi per field hanya satu pesan.
- Urutan internal password: `min` → `max` → huruf → angka (`lib/validation.ts:63-66`). Terbukti: `"abcdefgh"` → pesan **angka**; `"12345678"` → pesan **huruf**.
- `full_name` yang tidak dikirim sama sekali → `400 {"error":"Required"}` (pesan default zod, dieksekusi).

Catatan penting untuk desain tes UI: `<form>` **tidak** memakai `noValidate` (`app/auth/register/page.tsx:82`), sehingga **validasi bawaan browser berjalan lebih dulu** dan dapat mencegah `handleRegister` dieksekusi (lihat B6/B7).

---

## B. Atribut di klien (`app/auth/register/page.tsx`)

### B6. Atribut per input

| Field | `id` | `type` | `maxLength` | `minLength` | `required` | `pattern` |
|---|---|---|---|---|---|---|
| `full_name` | `register-name` (`:85`) | `text` (`:87`) | **100** (`:92`) | TIDAK ADA | **ya** (`:93`) | TIDAK ADA |
| `email` | `register-email` (`:101`) | `email` (`:103`) | **254** (`:108`) | TIDAK ADA | **ya** (`:109`) | TIDAK ADA |
| `phone_number` | `register-phone` (`:117`) | `tel` (`:119`) | **20** (`:124`) | TIDAK ADA | **tidak** | TIDAK ADA |
| `password` | `register-password` (`:132`) | `password` (`:134`) | **72** (`:139`) | **8** (`:141`) | **ya** (`:140`) | TIDAK ADA |

Tidak ada `pattern` di file ini — **TIDAK DITEMUKAN**. Nilai `maxLength`/`minLength` berasal dari konstanta bersama (`NAME_MAX`, `EMAIL_MAX`, `PHONE_MAX`, `PASSWORD_MAX`, `PASSWORD_MIN`; `lib/validation.ts:21-26`), jadi tidak bisa melenceng dari aturan server.

**Bisakah mengetik melewati batas lewat UI?**

| Kasus | Jawaban | Alasan |
|---|---|---|
| 101 karakter di `full_name` | **Tidak** | `maxLength=100` (`:92`) memblokir pengetikan dan paste |
| 21 karakter di `phone` | **Tidak** | `maxLength=20` (`:124`) |
| 73 karakter di `password` | **Tidak** | `maxLength=72` (`:139`) |
| 255 karakter di `email` | **Tidak** | `maxLength=254` (`:108`) |

Catatan: `maxLength` adalah batas **interaksi pengguna normal** (ketik/paste). Nilai tetap bisa dipaksakan lewat devtools atau request HTTP langsung; dalam kasus itu server tetap menolak (terbukti TC-EP-04, TC-EP-06, TC-EP-08, TC-EP-10). `maxLength` juga menghitung code unit UTF-16, sama seperti zod.

### B7. Validasi klien sebelum request

**Ya.** `handleRegister` memanggil `registerSchema.safeParse(...)` (`app/auth/register/page.tsx:33`), dan jika gagal langsung `setErrors(...)` + `return` (`:39-41`) — `fetch` di `:47` **tidak dijalankan**. Tidak ada react-hook-form di halaman ini; validasi memakai zod langsung.

Teks pesan yang tampil per field (sumber: `lib/validation.ts`, dirender di `app/auth/register/page.tsx:96, 112, 127, 144`):

| Kondisi | Field | Teks persis |
|---|---|---|
| Terlalu pendek | `full_name` | `Full name must be at least 2 characters` (`:34`) |
| Terlalu panjang | `full_name` | `Full name must be at most 100 characters` (`:35`) |
| Format salah | `email` | `Invalid email address` (`:43`) |
| Terlalu panjang | `email` | `Email must be at most 254 characters` (`:44`) |
| Terlalu panjang | `phone_number` | `Phone number must be at most 20 characters` (`:52`) |
| Terlalu pendek | `password` | `Password must be at least 8 characters` (`:63`) |
| Terlalu panjang | `password` | `Password must be at most 72 characters` (`:64`) |
| Tanpa huruf | `password` | `Password must contain at least one letter` (`:65`) |
| Tanpa angka | `password` | `Password must contain at least one digit` (`:66`) |
| Format salah | `phone_number` | **TIDAK ADA** (tidak ada aturan format) |
| Format salah | `full_name` | **TIDAK ADA** (tidak ada aturan format) |
| Terlalu pendek | `email` | **TIDAK ADA** (tidak ada `min` untuk email) |

**Penting untuk desain tes UI:** karena form tidak `noValidate` (`:82`) dan memakai `required` + `type="email"` + `minLength=8`, browser menjalankan constraint validation lebih dulu. Akibatnya sebagian pesan zod di atas **tidak dapat muncul lewat UI normal**:

- `full_name` kosong → pesan native browser (bukan zod); `full_name` 1 karakter → lolos native, lalu pesan zod **muncul**.
- `email` format salah → pesan native `type="email"`; email 255 karakter tidak bisa diketik.
- `password` < 8 karakter → pesan native `minLength`; jadi `"Password must be at least 8 characters"` tidak tampil lewat UI.
- `password` tanpa huruf/angka (mis. `"abcdefgh"`, 8 karakter) → lolos native, pesan zod **muncul**.

Teks persis pesan native browser **TIDAK PASTI** (bergantung browser + locale; tidak dieksekusi di browser pada verifikasi ini). Pesan server (400/409) ditampilkan di paragraf error global (`app/auth/register/page.tsx:147-149`), bukan per field.

---

## C. Perilaku setelah sukses / gagal

### C8. Endpoint, body, status, dan respons

| Aspek | Fakta | Bukti |
|---|---|---|
| Path & metode | **`POST /api/auth/register`** | `app/api/auth/register/route.ts:11`; `dynamic = 'force-dynamic'` di `:9` |
| Body JSON | `{ "full_name": string, "email": string, "phone_number"?: string, "password": string }` | skema `lib/validation.ts:70-75`; dibaca `app/api/auth/register/route.ts:12-13` |
| Key tak dikenal | **Dibuang** oleh zod; `role` tidak ada di skema | komentar `lib/validation.ts:69`, `app/api/auth/register/route.ts:5-6` |
| Sukses | **HTTP 200** (bukan 201), body `{"user":{"id","email","full_name","phone_number","role"}}` + `Set-Cookie: session=...` | `app/api/auth/register/route.ts:46-56` |
| Gagal validasi | **HTTP 400**, body `{"error":"<pesan issue pertama>"}` | `app/api/auth/register/route.ts:14-19` |
| Email duplikat | **HTTP 409**, body `{"error":"An account with this email already exists"}` | `app/api/auth/register/route.ts:22-28` |
| Body bukan JSON valid | `request.json()` gagal → `null` → 400 dengan pesan zod `Expected object, received null` | `app/api/auth/register/route.ts:12-16` — **dari kode, tidak dijalankan** |
| Header lain | Tidak ada `Location`; tidak ada redirect HTTP | `app/api/auth/register/route.ts:48-56` |

Contoh respons sukses yang benar-benar diterima (TC-BVA-13):

```json
{"user":{"id":"cmw9cbmsr000de19wo525ool9","email":"bva-nominal-13@example.com","full_name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","phone_number":"8888888888","role":"CUSTOMER"}}
```

Catatan: `profileSelect` tidak memuat `email` (`lib/serialize.ts:6-13`), tetapi route menambahkan `email` secara eksplisit di respons (`app/api/auth/register/route.ts:51`), sehingga `email` tetap ada.

### C9. Setelah register sukses

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| Redirect ke mana | **`/customer`**, via `router.push('/customer')` lalu `router.refresh()` | `app/auth/register/page.tsx:65-66` |
| Otomatis login? | **Ya.** Endpoint menandatangani JWT dan menyetel cookie `session` sebelum merespons | `app/api/auth/register/route.ts:41-46`; `lib/auth.ts:119-126`; terverifikasi `Set-Cookie` ada pada **semua 15** respons 200 |
| Sifat cookie | `httpOnly`, `sameSite=lax`, `path=/`, `maxAge=7 hari`, `secure` hanya di production | `lib/auth.ts:119-126`; token `setExpirationTime('7d')` di `lib/auth.ts:45` |
| Role tersimpan | **Selalu `CUSTOMER`**, di-hardcode di route (default kolom juga `CUSTOMER`) | `app/api/auth/register/route.ts:36`; `prisma/schema.prisma:22`; terverifikasi `role=CUSTOMER` di semua baris DB hasil 200 |
| Verifikasi email | **TIDAK ADA** — akun langsung aktif | tidak ada kolom/flow verifikasi di `prisma/schema.prisma:16-27` |
| Halaman `/customer` terlindungi? | Ya, middleware mewajibkan cookie sesi valid; redirect ke `/auth/login` bila tidak ada | `middleware.ts:10, 26-48` |

Karena cookie sudah disetel oleh endpoint, redirect ke `/customer` tidak terlempar kembali ke `/auth/login`.

---

## D. Eksekusi API (DB uji terpisah)

**Setup eksekusi:**

- DB: `prisma/verify_m3b.db` (dibuat dengan `DATABASE_URL="file:./verify_m3b.db" npx prisma migrate deploy` lalu `npx prisma db seed`).
- Server: `DATABASE_URL="file:./verify_m3b.db" AUTH_SECRET="verify-secret-m3" npx next dev -p 3212` (port 3212, terpisah dari dev 3000).
- Request: `fetch` langsung ke `http://localhost:3212/api/auth/register`, `Content-Type: application/json`, **tanpa** cookie jar, **bukan** lewat UI.
- Setiap kasus memakai email unik `@example.com`; khusus TC-EP-07 (`dup@example.com`) akun dibuat lebih dulu (setup) agar benar-benar duplikat.
- Verifikasi "user terbentuk di DB" dilakukan dengan `prisma.user.findUnique({ where: { email } })` pada DB uji yang sama.
- Variabel nominal: `full_name` 50×`A`, `phone_number` 10×`8`, `password` 39×`a` + `1` (40 karakter).

**Hasil (CSV, 25 baris):**

```csv
ID,Kasus,Status_HTTP,Respons,User_Di_DB
TC-BVA-01,"full_name 2",200,"{""user"":{""id"":""cmw9cblyb0001e19wzo2rsr6p"",""email"":""bva-name-2-1@example.com"",""full_name"":""AA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-02,"full_name 3",200,"{""user"":{""id"":""cmw9cbm1b0002e19wjgla64vi"",""email"":""bva-name-3-2@example.com"",""full_name"":""AAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-03,"full_name 99",200,"{""user"":{""id"":""cmw9cbm4j0003e19w0qqdoj50"",""email"":""bva-name-99-3@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-04,"full_name 100",200,"{""user"":{""id"":""cmw9cbm6z0004e19watgvvfej"",""email"":""bva-name-100-4@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-05,"phone 0",200,"{""user"":{""id"":""cmw9cbm9e0005e19w2lyf64rp"",""email"":""bva-phone-0-5@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":null,""role"":""CUSTOMER""}}",ya
TC-BVA-06,"phone 1",200,"{""user"":{""id"":""cmw9cbmbt0006e19w40t0njz8"",""email"":""bva-phone-1-6@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8"",""role"":""CUSTOMER""}}",ya
TC-BVA-07,"phone 19",200,"{""user"":{""id"":""cmw9cbme10007e19wwn5uajr3"",""email"":""bva-phone-19-7@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-08,"phone 20",200,"{""user"":{""id"":""cmw9cbmg90008e19wjqragf30"",""email"":""bva-phone-20-8@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""88888888888888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-09,"password 8",200,"{""user"":{""id"":""cmw9cbmig0009e19w87lmvkam"",""email"":""bva-pass-8-9@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-10,"password 9",200,"{""user"":{""id"":""cmw9cbmks000ae19wygo6a2r5"",""email"":""bva-pass-9-10@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-11,"password 71",200,"{""user"":{""id"":""cmw9cbmod000be19wz57qpo0g"",""email"":""bva-pass-71-11@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-12,"password 72",200,"{""user"":{""id"":""cmw9cbmqi000ce19wl94ip54r"",""email"":""bva-pass-72-12@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-BVA-13,"nominal (50/10/40)",200,"{""user"":{""id"":""cmw9cbmsr000de19wo525ool9"",""email"":""bva-nominal-13@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-EP-01,"phone terisi 10",200,"{""user"":{""id"":""cmw9cbmuy000ee19wws1e9idr"",""email"":""ep-phone-10-14@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":""8888888888"",""role"":""CUSTOMER""}}",ya
TC-EP-02,"phone kosong",200,"{""user"":{""id"":""cmw9cbmx4000fe19ws6cbr5xt"",""email"":""ep-phone-empty-15@example.com"",""full_name"":""AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"",""phone_number"":null,""role"":""CUSTOMER""}}",ya
TC-EP-03,"full_name 1",400,"{""error"":""Full name must be at least 2 characters""}",tidak
TC-EP-04,"full_name 101",400,"{""error"":""Full name must be at most 100 characters""}",tidak
TC-EP-05,"email tanpa @",400,"{""error"":""Invalid email address""}",tidak
TC-EP-06,"email 255 valid format",400,"{""error"":""Email must be at most 254 characters""}",tidak
TC-EP-07,"email sudah terdaftar",409,"{""error"":""An account with this email already exists""}",ya
TC-EP-08,"phone 21",400,"{""error"":""Phone number must be at most 20 characters""}",tidak
TC-EP-09,"password 7",400,"{""error"":""Password must be at least 8 characters""}",tidak
TC-EP-10,"password 73",400,"{""error"":""Password must be at most 72 characters""}",tidak
TC-EP-11,"password abcdefgh",400,"{""error"":""Password must contain at least one digit""}",tidak
TC-EP-12,"password 12345678",400,"{""error"":""Password must contain at least one letter""}",tidak
```

**Rekap:** 15 respons `200` (user baru terbentuk), 9 respons `400`, 1 respons `409`. Tidak ada `5xx`.

Catatan pembacaan CSV: pada **TC-EP-07** kolom `User_Di_DB` bernilai `ya` karena user `dup@example.com` **sudah ada dari langkah setup**, bukan dibuat oleh request tersebut (request-nya sendiri gagal 409).

---

## E. Info build & cara menjalankan

| Item | Nilai | Bukti |
|---|---|---|
| Versi aplikasi | **1.0.0** | `package.json:3` |
| Next.js | **14.1.4** | `package.json:44` |
| React | `^18.2.0` | `package.json:46` |
| Prisma CLI / `@prisma/client` | `^6.19.3` / `^6.19.3` | `package.json:64` / `package.json:21` |
| zod (deklarasi) | `^3.22.4` | `package.json:54` |
| zod (terpasang) | **3.25.76** | `node_modules/zod/package.json:3` |
| Commit pendek terakhir | **`c7906b72`** — `feat: add Vitest configuration for unit and API tests` | `git rev-parse --short HEAD` |
| Repo git | Ya (branch `main`) | `.git/` |

**Menjalankan lokal:**

```bash
npm install
cp .env.example .env      # lalu isi AUTH_SECRET (mis. openssl rand -base64 32)
npm run db:migrate
npm run db:seed
npm run dev               # http://localhost:3000
```

- Port default **3000** (`README.md:57`; `playwright.config.ts` `baseURL` juga `http://localhost:3000`). Port bisa diganti: `npx next dev -p 3212`.
- `npm run dev` = `next dev` (`package.json:6`); produksi: `npm run build` lalu `npm run start` (`package.json:7-8`).
- Env wajib: `DATABASE_URL` (mis. `file:./dev.db` → `prisma/dev.db`), `AUTH_SECRET`, `APP_URL` (`.env.example`). Tanpa `AUTH_SECRET`, jalur sukses register akan gagal saat `signSession` (`lib/auth.ts:33-35` dipanggil dari `app/api/auth/register/route.ts:41`) — **dari kode, tidak diuji**.
- Suite tes memakai DB terpisah dan port sendiri: Vitest API di port **3210** dengan `DATABASE_URL=file:./test.db` (`tests/api/global-setup.ts:6-7`).

---

## TEMUAN YANG BERBEDA DARI ASUMSI SAYA

Asumsi Anda: `full_name` 2–100, email ≤254, `phone` ≤20 opsional tanpa aturan format, password 8–72 dengan ≥1 huruf dan ≥1 angka.

1. **Batas yang Anda asumsikan benar semua, tetapi satuannya berbeda untuk password.** Batas dihitung per **code unit UTF-16**, bukan per karakter. `'a'×71 + '😀'` (72 karakter terlihat) **ditolak** `400 "Password must be at most 72 characters"`. Untuk BVA, emoji/karakter non-BMP harus dihitung 2.
2. **Email TIDAK di-lowercase dan cek duplikat case-sensitive.** `CaseMix@Example.COM` dan `casemix@example.com` sama-sama `200` (dua akun). Asumsi "email ≤254" benar, tetapi normalisasi huruf **TIDAK DITEMUKAN** — ini bisa mengubah desain kasus duplikat Anda.
3. **Kasus batas atas (101 nama, 21 phone, 73 password, 255 email) tidak dapat diuji lewat UI.** `maxLength` (100/20/72/254) memblokir input; `minLength=8` + `required` + `type="email"` juga memblokir lebih dulu. Kasus tersebut hanya valid di level API (dan di API memang ditolak 400).
4. **Pesan validasi klien tidak selalu bisa muncul karena validasi native browser berjalan lebih dulu** (`<form>` tanpa `noValidate`, `app/auth/register/page.tsx:82`). Contoh: pesan `"Password must be at least 8 characters"` tidak akan tampil lewat UI karena password 7 karakter sudah diblokir `minLength`. Teks native-nya **TIDAK PASTI** (tergantung browser/locale) dan tidak dieksekusi di browser.
5. **API hanya mengembalikan SATU error**, bukan semua error sekaligus: `{"error": "<issue pertama>"}` (`app/api/auth/register/route.ts:16`). Terbukti dengan 4 field salah → hanya pesan `full_name`. Klien menampilkan maksimal satu pesan per field.
6. **Tidak ada `pattern` sama sekali** di keempat input — **TIDAK DITEMUKAN**. `phone` benar-benar hanya dibatasi panjang (20), `full_name`/`email` tidak punya `minLength` HTML.
7. **Phone kosong disimpan sebagai `NULL`, bukan `''`**, dan `"   "` juga menjadi `NULL` (`app/api/auth/register/route.ts:35`). Format bebas (`+`, spasi, `-`) diterima dan disimpan apa adanya.
8. **`full_name` spasi saja = kosong** (trim lalu gagal min), pesan `"Full name must be at least 2 characters"` — bukan pesan "required".
9. **Sukses = HTTP 200, bukan 201**, tanpa header `Location`; namun cookie `session` langsung disetel (auto-login) dan `role` selalu `CUSTOMER`.
10. **Password tidak di-trim**: 8 spasi lolos panjang tetapi gagal aturan huruf (`400 "Password must contain at least one letter"`). Spasi di awal/akhir password juga ikut tersimpan sebagai bagian password.

### Hal yang TIDAK DITEMUKAN / TIDAK PASTI

- Aturan format `phone_number`: **TIDAK DITEMUKAN**.
- Normalisasi/lowercase email: **TIDAK DITEMUKAN**.
- Atribut `pattern` pada input mana pun: **TIDAK DITEMUKAN**.
- `minLength` untuk `full_name` dan `email`: **TIDAK DITEMUKAN**.
- Teks persis pesan validasi native browser: **TIDAK PASTI** (tidak dijalankan di browser).
- Perilaku dua request duplikat **bersamaan** (race): **TIDAK PASTI** — tidak diuji; dari kode, `create` tidak dibungkus `try/catch`, sehingga pelanggaran unique (`prisma/schema.prisma:18`) berpotensi menjadi `500` alih-alih `409`.
- Pesan untuk body non-JSON (`Expected object, received null`): **dari kode, tidak dijalankan**.

---

## Lampiran — file yang dibuat / dihapus

| File | Status | Keterangan |
|---|---|---|
| `docs/MODULE3_VERIFY.md` | **dibuat (permanen)** | Dokumen ini |
| `prisma/verify_m3.db` | dibuat sementara, **dihapus** | DB uji run pertama |
| `prisma/verify_m3b.db` | dibuat sementara, **dihapus** | DB uji run kedua (sumber CSV di atas) |
| `_verify_register.mjs` | dibuat sementara, **dihapus** | Runner 25 kasus + spot check |

Tidak ada perubahan pada `lib/validation.ts`, `app/auth/register/page.tsx`, `app/api/auth/register/route.ts`, `prisma/schema.prisma`, `prisma/dev.db`, maupun `prisma/test.db`. Untuk mereproduksi: buat DB terpisah (`DATABASE_URL="file:./verify.db" npx prisma migrate deploy && npx prisma db seed`), jalankan `next dev` pada port lain dengan `DATABASE_URL` tersebut, lalu kirim `POST /api/auth/register` sesuai tabel D.
