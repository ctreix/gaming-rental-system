# M4_SOURCE — Kode Sumber untuk White-Box Testing (READ-ONLY)

Dokumen ini dihasilkan tanpa mengubah, menambah, atau menghapus file lain di proyek, dan tanpa menginstal paket apa pun.

**Konvensi penomoran baris:** setiap blok kode di bawah diberi prefiks nomor baris asli file dalam format `NOMOR<TAB>`. Teks setelah prefiks itu adalah salinan verbatim isi file (termasuk indentasi, spasi, dan komentar). Tidak ada karakter isi yang diubah.

---

## 1. Salinan Kode Sumber

### 1a. `lib/reservation-status.ts` (seluruh file, 108 baris)

```ts
1	// Reservation status transitions (pure, no I/O).
2	//
3	// This module is the single source of truth for which status changes are
4	// allowed and who may perform them. The API route and the UI both import it,
5	// so the buttons shown match exactly what the server will accept.
6	
7	export type ReservationStatus =
8	  | 'PENDING'
9	  | 'CONFIRMED'
10	  | 'ACTIVE'
11	  | 'COMPLETED'
12	  | 'CANCELLED'
13	  | 'NO_SHOW'
14	
15	export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'
16	
17	export const RESERVATION_STATUSES: ReservationStatus[] = [
18	  'PENDING',
19	  'CONFIRMED',
20	  'ACTIVE',
21	  'COMPLETED',
22	  'CANCELLED',
23	  'NO_SHOW',
24	]
25	
26	export interface TransitionActor {
27	  role: 'CUSTOMER' | 'ADMIN'
28	  isOwner: boolean
29	}
30	
31	// Side effects applied together with the status change.
32	export interface TransitionEffect {
33	  payment_status?: PaymentStatus
34	  // When true, the route fills payment_verified_at / payment_verified_by
35	  // (both columns exist in prisma/schema.prisma).
36	  verifyPayment?: boolean
37	}
38	
39	export interface TransitionRule {
40	  // Only ADMIN may perform this transition.
41	  adminOnly: boolean
42	  // The owning CUSTOMER may perform this transition.
43	  allowOwnerCustomer: boolean
44	  effect?: TransitionEffect
45	}
46	
47	// from -> to table. Any pair not listed here is rejected.
48	export const TRANSITIONS: Record<string, TransitionRule> = {
49	  // ADMIN confirms a pending booking; no payment-proof upload exists yet, so
50	  // confirming marks the payment as PAID and records who verified it.
51	  'PENDING->CONFIRMED': {
52	    adminOnly: true,
53	    allowOwnerCustomer: false,
54	    effect: { payment_status: 'PAID', verifyPayment: true },
55	  },
56	  // The owner can cancel their own pending request (or an admin can).
57	  'PENDING->CANCELLED': {
58	    adminOnly: false,
59	    allowOwnerCustomer: true,
60	  },
61	  'CONFIRMED->ACTIVE': {
62	    adminOnly: true,
63	    allowOwnerCustomer: false,
64	  },
65	  'ACTIVE->COMPLETED': {
66	    adminOnly: true,
67	    allowOwnerCustomer: false,
68	  },
69	  'CONFIRMED->NO_SHOW': {
70	    adminOnly: true,
71	    allowOwnerCustomer: false,
72	  },
73	  // Cancelling a confirmed booking refunds the payment.
74	  'CONFIRMED->CANCELLED': {
75	    adminOnly: true,
76	    allowOwnerCustomer: false,
77	    effect: { payment_status: 'REFUNDED' },
78	  },
79	}
80	
81	export function transitionKey(
82	  from: ReservationStatus,
83	  to: ReservationStatus
84	): string {
85	  return `${from}->${to}`
86	}
87	
88	export function getTransitionRule(
89	  from: ReservationStatus,
90	  to: ReservationStatus
91	): TransitionRule | undefined {
92	  return TRANSITIONS[transitionKey(from, to)]
93	}
94	
95	// True when `actor` may change a reservation from `from` to `to`.
96	// ADMIN may perform any transition listed in the table; a CUSTOMER may only
97	// perform transitions explicitly opened to the owner (and only when they
98	// actually own the reservation).
99	export function canTransition(
100	  from: ReservationStatus,
101	  to: ReservationStatus,
102	  actor: TransitionActor
103	): boolean {
104	  const rule = TRANSITIONS[transitionKey(from, to)]
105	  if (!rule) return false
106	  if (actor.role === 'ADMIN') return true
107	  return rule.allowOwnerCustomer && actor.isOwner
108	}
```

### 1b. `app/api/reservations/[id]/route.ts` (seluruh file, 100 baris)

Catatan: file ini hanya mengekspor `dynamic` dan handler `PATCH`. Tidak ada handler `GET` atau `DELETE` di file ini (lihat bagian 8).

```ts
1	import { NextResponse } from 'next/server'
2	import type { Prisma } from '@prisma/client'
3	import { z } from 'zod'
4	import { prisma } from '@/lib/db'
5	import { requireUser } from '@/lib/auth'
6	import { serializeUnit } from '@/lib/serialize'
7	import {
8	  canTransition,
9	  getTransitionRule,
10	  type ReservationStatus,
11	  type TransitionActor,
12	} from '@/lib/reservation-status'
13	
14	export const dynamic = 'force-dynamic'
15	
16	const patchSchema = z.object({
17	  status: z.enum([
18	    'PENDING',
19	    'CONFIRMED',
20	    'ACTIVE',
21	    'COMPLETED',
22	    'CANCELLED',
23	    'NO_SHOW',
24	  ]),
25	})
26	
27	// PATCH /api/reservations/[id] { status }
28	//
29	// Authenticated users only. The caller's role and ownership are read from the
30	// database (never trusted from the JWT alone):
31	//   - reservation missing, or caller may not see it -> 404
32	//   - transition not in the table                   -> 409
33	//   - caller's role/ownership not allowed by it     -> 403
34	export async function PATCH(
35	  request: Request,
36	  { params }: { params: { id: string } }
37	) {
38	  const auth = await requireUser()
39	  if (auth.response) return auth.response
40	  const user = auth.user
41	
42	  const body = await request.json().catch(() => null)
43	  const parsed = patchSchema.safeParse(body)
44	  if (!parsed.success) {
45	    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
46	  }
47	  const to = parsed.data.status
48	
49	  const reservation = await prisma.reservation.findUnique({
50	    where: { id: params.id },
51	  })
52	  if (!reservation) {
53	    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
54	  }
55	
56	  const isOwner = reservation.user_id === user.id
57	  const isAdmin = user.role === 'ADMIN'
58	  // Do not reveal reservations the caller has no right to see.
59	  if (!isOwner && !isAdmin) {
60	    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
61	  }
62	
63	  const from = reservation.status as ReservationStatus
64	  const rule = getTransitionRule(from, to)
65	  if (!rule) {
66	    return NextResponse.json(
67	      { error: `Cannot change status from ${from} to ${to}` },
68	      { status: 409 }
69	    )
70	  }
71	
72	  const actor: TransitionActor = {
73	    role: isAdmin ? 'ADMIN' : 'CUSTOMER',
74	    isOwner,
75	  }
76	  if (!canTransition(from, to, actor)) {
77	    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
78	  }
79	
80	  const data: Prisma.ReservationUpdateInput = { status: to }
81	  if (rule.effect?.payment_status) {
82	    data.payment_status = rule.effect.payment_status
83	  }
84	  if (rule.effect?.verifyPayment) {
85	    data.payment_verified_at = new Date()
86	    data.payment_verified_by = user.id
87	  }
88	
89	  const updated = await prisma.$transaction((tx) =>
90	    tx.reservation.update({
91	      where: { id: reservation.id },
92	      data,
93	      include: { unit: true },
94	    })
95	  )
96	
97	  return NextResponse.json({
98	    reservation: { ...updated, unit: serializeUnit(updated.unit) },
99	  })
100	}
```

### 1c. `app/api/locks/route.ts` — handler `POST` (seluruh fungsi)

Rentang permintaan "sekitar 47–150" ternyata tidak menutup seluruh fungsi: fungsi `POST` dimulai di baris 48 dan berakhir di baris 164. Yang disalin di bawah adalah **seluruh fungsi `POST` (baris 48–164) apa adanya**, ditambah deklarasi pendukung di atasnya yang dipakai fungsi ini (`LockRejected` baris 33–40 dan `result` baris 29–30), agar analisis manual tidak kehilangan konteks. Konstanta modul (baris 8–19) tidak disalin.

```ts
29	const result = (body: LockResult, status: number) =>
30	  NextResponse.json<LockResult>(body, { status })
31	
32	// Thrown inside the transaction to roll back on any rejection.
33	class LockRejected extends Error {
34	  constructor(
35	    message: string,
36	    readonly statusCode = 400
37	  ) {
38	    super(message)
39	  }
40	}
41	
42	// POST /api/locks { unit_id, start_time, end_time }
43	// Keeps the legacy `acquire_unit_lock()` RPC response contract:
44	// { success: boolean, session_id: string, message: string }.
45	//
46	// Never touches units.status (it stays AVAILABLE/MAINTENANCE/OFFLINE and is
47	// only changed by an admin).
48	export async function POST(request: Request) {
49	  const auth = await requireUser()
50	  if (auth.response) {
51	    return result(
52	      { success: false, session_id: '', message: 'Not authenticated' },
53	      auth.response.status
54	    )
55	  }
56	  const userId = auth.user.id
57	
58	  const body = await request.json().catch(() => null)
59	  const parsed = createLockSchema.safeParse(body)
60	  if (!parsed.success) {
61	    return result({ success: false, session_id: '', message: 'Invalid lock request' }, 400)
62	  }
63	
64	  const start = new Date(parsed.data.start_time)
65	  const end = new Date(parsed.data.end_time)
66	
67	  try {
68	    const lock = await prisma.$transaction(async (tx) => {
69	      // 1. Clean up expired locks first.
70	      await tx.reservationLock.deleteMany({
71	        where: { expires_at: { lt: new Date() } },
72	      })
73	
74	      // 2. Unit must be bookable.
75	      const unit = await tx.unit.findUnique({ where: { id: parsed.data.unit_id } })
76	      if (!unit) throw new LockRejected('Unit not found', 404)
77	      if (unit.status === 'MAINTENANCE' || unit.status === 'OFFLINE') {
78	        throw new LockRejected('Unit is under maintenance or offline', 409)
79	      }
80	
81	      // 3. Range sanity: start < end, whole hours, 08:00-24:00 WIB of a
82	      //    single day.
83	      if (start.getTime() >= end.getTime()) {
84	        throw new LockRejected('Start time must be before end time')
85	      }
86	      const wholeHours =
87	        (start.getTime() + WIB_OFFSET_MS) % HOUR_MS === 0 &&
88	        (end.getTime() + WIB_OFFSET_MS) % HOUR_MS === 0
89	      if (!wholeHours) {
90	        throw new LockRejected('Time range must cover whole hours')
91	      }
92	      const startRel = start.getTime() + WIB_OFFSET_MS
93	      const startOfDay = Math.floor(startRel / DAY_MS) * DAY_MS
94	      const withinDay =
95	        startRel >= startOfDay + OPEN_HOUR_MS &&
96	        end.getTime() + WIB_OFFSET_MS <= startOfDay + DAY_MS
97	      if (!withinDay) {
98	        throw new LockRejected('Bookings must be within 08:00-24:00 WIB on a single day')
99	      }
100	
101	      // 4a. Strict overlap with active reservations (start < other.end AND
102	      //     end > other.start).
103	      const overlappingReservations = await tx.reservation.count({
104	        where: {
105	          unit_id: unit.id,
106	          status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
107	          start_time: { lt: end },
108	          end_time: { gt: start },
109	        },
110	      })
111	      if (overlappingReservations > 0) {
112	        throw new LockRejected('Time slot is already booked', 409)
113	      }
114	
115	      // 4b. Strict overlap with ANOTHER user's unexpired lock.
116	      const foreignLock = await tx.reservationLock.findFirst({
117	        where: {
118	          unit_id: unit.id,
119	          expires_at: { gt: new Date() },
120	          user_id: { not: userId },
121	          start_time: { lt: end },
122	          end_time: { gt: start },
123	        },
124	      })
125	      if (foreignLock) {
126	        throw new LockRejected('Unit is being booked by another user', 409)
127	      }
128	
129	      // 5. Replace the caller's previous lock on this unit.
130	      await tx.reservationLock.deleteMany({
131	        where: { unit_id: unit.id, user_id: userId },
132	      })
133	
134	      // 6. Create the lock (session_id comes from the column default).
135	      return tx.reservationLock.create({
136	        data: {
137	          unit_id: unit.id,
138	          user_id: userId,
139	          start_time: start,
140	          end_time: end,
141	          expires_at: new Date(Date.now() + LOCK_MINUTES * 60 * 1000),
142	        },
143	      })
144	    })
145	
146	    return result(
147	      {
148	        success: true,
149	        session_id: lock.session_id,
150	        message: 'Lock acquired successfully',
151	      },
152	      200
153	    )
154	  } catch (err) {
155	    if (err instanceof LockRejected) {
156	      return result(
157	        { success: false, session_id: '', message: err.message },
158	        err.statusCode
159	      )
160	    }
161	    console.error('[locks/post]', err)
162	    return result({ success: false, session_id: '', message: 'Failed to acquire lock' }, 500)
163	  }
164	}
```

---

## 2. Daftar Fungsi/Handler, Rentang Baris, Titik Keputusan, Dependensi Eksternal

Definisi "titik keputusan" yang dipakai: `if`, `else if`, `else`, ternary `?:`, `&&`, `||`, `switch/case`, `for`/`while`/`do` loop, `.some/.filter/.map` callback yang mengandung kondisi, `catch` / `.catch()`, dan optional chaining `?.` dihitung terpisah (disebut eksplisit di kolom rincian).

### 2a. `lib/reservation-status.ts`

| # | Nama | Baris | Titik keputusan | Rincian | Dependensi eksternal |
|---|------|-------|-----------------|---------|----------------------|
| 1 | `transitionKey` | 81–86 | **0** | tidak ada cabang; hanya string interpolation | tidak ada (pure) |
| 2 | `getTransitionRule` | 88–93 | **0** | akses objek `TRANSITIONS` dengan key hasil `transitionKey` | tidak ada (pure); memanggil `transitionKey` (lib yang sama) |
| 3 | `canTransition` | 99–108 | **3** | `if (!rule)` (105) = 1; `if (actor.role === 'ADMIN')` (106) = 1; `&&` pada `return rule.allowOwnerCustomer && actor.isOwner` (107) = 1 | tidak ada (pure); memanggil `transitionKey` lewat key lookup; membaca `TRANSITIONS` |

Data ekspor non-fungsi: `RESERVATION_STATUSES` (17–24, konstanta array), `TRANSITIONS` (48–79, objek data 6 entri). Keduanya **0** titik keputusan (bukan fungsi).

Catatan faktual untuk pengujian: field `adminOnly` dideklarasikan (41) dan diisi di tabel (52, 58, 62, 66, 70, 75) tetapi **tidak dibaca** oleh `canTransition`; keputusan admin dibuat murni dari `actor.role === 'ADMIN'`.

### 2b. `app/api/reservations/[id]/route.ts`

| # | Nama | Baris | Titik keputusan | Rincian | Dependensi eksternal |
|---|------|-------|-----------------|---------|----------------------|
| 1 | `PATCH` | 34–100 | **10** (+1 `.catch`) | `if (auth.response)` (39) = 1; `if (!parsed.success)` (44) = 1; `if (!reservation)` (52) = 1; `if (!isOwner && !isAdmin)` (59) = 2 (if + `&&`); `if (!rule)` (65) = 1; ternary `isAdmin ? 'ADMIN' : 'CUSTOMER'` (73) = 1; `if (!canTransition(...))` (76) = 1; `if (rule.effect?.payment_status)` (81) = 1; `if (rule.effect?.verifyPayment)` (84) = 1; tambahan `.catch(() => null)` pada `request.json()` (42) = 1 bila catch dihitung | `requireUser()` → `@/lib/auth`; `request.json()` (Web API); `patchSchema.safeParse` (zod); `prisma.reservation.findUnique`; `prisma.$transaction` + `tx.reservation.update` (`@/lib/db`); `getTransitionRule`, `canTransition` (`@/lib/reservation-status`); `serializeUnit` (`@/lib/serialize`); `new Date()` (85); `NextResponse.json` |
| 2 | `patchSchema` (objek skema) | 16–25 | **0** | hanya deklarasi `z.object` + `z.enum` 6 nilai; tidak ada cabang kode | `zod` |

Catatan: tidak ada `GET`, `DELETE`, atau handler lain di file ini; hanya `export const dynamic` (14) dan `PATCH` (34–100).

### 2c. `app/api/locks/route.ts` — `POST`

| # | Nama | Baris | Titik keputusan | Rincian | Dependensi eksternal |
|---|------|-------|-----------------|---------|----------------------|
| 1 | `POST` | 48–164 | **17** (+1 `.catch`, +1 `default` param) | `if (auth.response)` (50) = 1; `.catch(() => null)` (58) = 1 (bila catch dihitung); `if (!parsed.success)` (60) = 1; `try` (67) = 1; `if (!unit)` (76) = 1; `if (unit.status === 'MAINTENANCE' \|\| unit.status === 'OFFLINE')` (77) = 2 (if + `\|\|`); `if (start.getTime() >= end.getTime())` (83) = 1; `&&` pada `wholeHours` (87–88) = 1; `if (!wholeHours)` (89) = 1; `&&` pada `withinDay` (95–96) = 1; `if (!withinDay)` (97) = 1; `if (overlappingReservations > 0)` (111) = 1; `if (foreignLock)` (125) = 1; `catch (err)` (154) = 1; `if (err instanceof LockRejected)` (155) = 1 | `requireUser()` (`@/lib/auth`); `request.json()`; `createLockSchema.safeParse` (zod); `prisma.$transaction`; `tx.reservationLock.deleteMany` (2×); `tx.unit.findUnique`; `tx.reservation.count`; `tx.reservationLock.findFirst`; `tx.reservationLock.create` (`@/lib/db`); `new Date()` (64, 65, 71, 119); `new Date(Date.now() + ...)` (141); `console.error` (161); `NextResponse.json` via `result` |
| 2 | `result` (helper) | 29–30 | **0** | panah satu ekspresi | `NextResponse.json` |
| 3 | `LockRejected` (konstruktor) | 33–40 | **0** | `readonly statusCode = 400` adalah *default parameter*, bukan cabang; `super(message)` | `Error` (bawaan JS) |
| 4 | `createLockSchema` (objek skema) | 15–19 | **0** | deklarasi `z.object` | `zod` |

Catatan: pemanggilan `new Date(...)` di dalam `where` (71, 119) serta `Date.now()` (141) membuat handler ini bergantung pada jam sistem; tidak ada mock/fake timer di file ini.

---

## 3. Daftar Ekspor `lib/*.ts` dan Jumlah Titik Keputusan per Fungsi

Angka saja, tanpa isi kode. `—` berarti ekspor tersebut bukan fungsi (tipe/konstanta/skema deklaratif).

### `lib/auth.ts` (157 baris)

| Ekspor | Baris | Titik keputusan |
|--------|-------|-----------------|
| `SESSION_COOKIE` (const) | 7 | — |
| `SessionPayload` (type) | 9–13 | — |
| `AuthUser` (interface) | 16–22 | — |
| `signSession` | 40–47 | 0 |
| `verifySession` | 51–65 | 4 |
| `getCurrentUser` | 70–79 | 3 |
| `RequireResult` (type) | 85–87 | — |
| `requireUser` | 90–99 | 1 |
| `requireAdmin` | 103–113 | 2 |
| `setSessionCookie` | 119–127 | 1 |
| `clearSessionCookie` | 129–137 | 1 |
| `hashPassword` | 143–145 | 0 |
| `verifyPassword` | 147–152 | 0 |

Rincian: `verifySession` = `try/catch` 1 + `if (typeof payload.sub !== 'string')` 1 + 2 ternary 2. `getCurrentUser` = optional chaining `?.value` 1 + 2 `if` 2. `setSessionCookie`/`clearSessionCookie` = `process.env.NODE_ENV === 'production'` 1. Internal (tidak diekspor): `AUTH_USER_SELECT` (24–30), `getSecret` (32–34, 0 titik keputusan).

### `lib/db.ts` (9 baris)

| Ekspor | Baris | Titik keputusan |
|--------|-------|-----------------|
| `prisma` (const) | 7 | 1 (`??` pada baris 7) |

Modul level: `if (process.env.NODE_ENV !== 'production')` baris 9 = 1 titik keputusan (bukan fungsi).

### `lib/reservation-status.ts` (108 baris)

| Ekspor | Baris | Titik keputusan |
|--------|-------|-----------------|
| `ReservationStatus` (type) | 7–13 | — |
| `PaymentStatus` (type) | 15 | — |
| `RESERVATION_STATUSES` (const) | 17–24 | — |
| `TransitionActor` (interface) | 26–29 | — |
| `TransitionEffect` (interface) | 32–37 | — |
| `TransitionRule` (interface) | 39–45 | — |
| `TRANSITIONS` (const) | 48–79 | — |
| `transitionKey` | 81–86 | 0 |
| `getTransitionRule` | 88–93 | 0 |
| `canTransition` | 99–108 | 3 |

### `lib/serialize.ts` (32 baris)

| Ekspor | Baris | Titik keputusan |
|--------|-------|-----------------|
| `profileSelect` (const) | 6–13 | — |
| `ProfileRow` (type) | 15–17 | — |
| `serializeUnit` | 21–32 | 3 |

Rincian `serializeUnit`: `try/catch` 1 + `if (parsed && typeof parsed === 'object')` 2 (`if` + `&&`).

### `lib/utils.ts` (153 baris)

| Ekspor | Baris | Titik keputusan |
|--------|-------|-----------------|
| `cn` | 4–6 | 0 |
| `formatCurrency` | 8–14 | 0 |
| `formatDate` | 16–21 | 0 |
| `formatTime` | 23–27 | 0 |
| `addHours` | 29–33 | 0 |
| `getTimeSlots` | 35–55 | 1 |
| `maskUsername` | 57–61 | 2 |
| `calculateDurationHours` | 63–66 | 0 |
| `areSlotsContiguous` | 73–83 | 3 |
| `isTimeSlotAvailable` | 85–96 | 3 |
| `generateTimeSlots` | 98–117 | 1 |
| `getStatusColor` | 119–134 | 1 |
| `getStatusBadgeVariant` | 136–153 | 1 |

Rincian: `getTimeSlots` = `while` 1. `maskUsername` = `if (!name || name.length < 3)` 2 (`if` + `||`). `areSlotsContiguous` = `if (slots.length <= 1)` 1 + `for` 1 + `if` di dalam loop 1. `isTimeSlotAvailable` = `.some()` 1 + 2 `&&` di callback 2. `generateTimeSlots` = `for` 1. `getStatusColor` / `getStatusBadgeVariant` = `||` pada return 1.

### `lib/validation.ts` (110 baris)

| Ekspor | Baris | Titik keputusan |
|--------|-------|-----------------|
| `fieldErrors` | 4–11 | 4 |
| `NAME_MIN` | 21 | — |
| `NAME_MAX` | 22 | — |
| `EMAIL_MAX` | 23 | — |
| `PHONE_MAX` | 24 | — |
| `PASSWORD_MIN` | 25 | — |
| `PASSWORD_MAX` | 26 | — |
| `fullNameSchema` | 31–35 | — |
| `emailSchema` | 40–44 | — |
| `phoneSchema` | 49–54 | — |
| `passwordSchema` | 61–66 | — |
| `registerSchema` | 70–75 | — |
| `RegisterInput` (type) | 76 | — |
| `loginSchema` | 79–82 | — |
| `LoginInput` (type) | 83 | — |
| `forgotSchema` | 86–88 | — |
| `ForgotInput` (type) | 89 | — |
| `resetSchema` | 92–95 | — |
| `ResetInput` (type) | 96 | — |
| `resetFormSchema` | 100–109 | 1 |
| `ResetFormInput` (type) | 110 | — |

Rincian `fieldErrors`: `for` 1 + `??` 1 + `if (key && !out[key])` 2 = 4. Rincian `resetFormSchema`: `.refine((data) => data.password === data.confirm_password)` = 1 (callback predikat). Skema zod lain berisi aturan deklaratif (`.min/.max/.regex/.optional/.default`) tanpa cabang di kode kita, sehingga dihitung `—`.

---

## 4. Isi `tests/unit/reservation-status.test.ts` (hanya baca, 89 baris)

```ts
1	import { describe, it, expect } from 'vitest'
2	import {
3	  canTransition,
4	  getTransitionRule,
5	  type ReservationStatus,
6	  type TransitionActor,
7	} from '@/lib/reservation-status'
8	
9	const admin: TransitionActor = { role: 'ADMIN', isOwner: false }
10	const owner: TransitionActor = { role: 'CUSTOMER', isOwner: true }
11	const other: TransitionActor = { role: 'CUSTOMER', isOwner: false }
12	
13	describe('allowed transitions', () => {
14	  it('ADMIN: PENDING -> CONFIRMED', () => {
15	    expect(canTransition('PENDING', 'CONFIRMED', admin)).toBe(true)
16	  })
17	  it('owner CUSTOMER: PENDING -> CANCELLED', () => {
18	    expect(canTransition('PENDING', 'CANCELLED', owner)).toBe(true)
19	  })
20	  it('ADMIN: PENDING -> CANCELLED', () => {
21	    expect(canTransition('PENDING', 'CANCELLED', admin)).toBe(true)
22	  })
23	  it('ADMIN: CONFIRMED -> ACTIVE', () => {
24	    expect(canTransition('CONFIRMED', 'ACTIVE', admin)).toBe(true)
25	  })
26	  it('ADMIN: ACTIVE -> COMPLETED', () => {
27	    expect(canTransition('ACTIVE', 'COMPLETED', admin)).toBe(true)
28	  })
29	  it('ADMIN: CONFIRMED -> NO_SHOW', () => {
30	    expect(canTransition('CONFIRMED', 'NO_SHOW', admin)).toBe(true)
31	  })
32	  it('ADMIN: CONFIRMED -> CANCELLED', () => {
33	    expect(canTransition('CONFIRMED', 'CANCELLED', admin)).toBe(true)
34	  })
35	})
36	
37	describe('rejected transitions', () => {
38	  it('CUSTOMER cannot PENDING -> CONFIRMED (admin only)', () => {
39	    expect(canTransition('PENDING', 'CONFIRMED', owner)).toBe(false)
40	  })
41	  it('non-owner CUSTOMER cannot PENDING -> CANCELLED', () => {
42	    expect(canTransition('PENDING', 'CANCELLED', other)).toBe(false)
43	  })
44	  it('CUSTOMER cannot CONFIRMED -> CANCELLED (admin only)', () => {
45	    expect(canTransition('CONFIRMED', 'CANCELLED', owner)).toBe(false)
46	  })
47	  it('PENDING -> ACTIVE is not in the table', () => {
48	    expect(canTransition('PENDING', 'ACTIVE', admin)).toBe(false)
49	  })
50	  it('PENDING -> COMPLETED is not in the table', () => {
51	    expect(canTransition('PENDING', 'COMPLETED', admin)).toBe(false)
52	  })
53	  it('CONFIRMED -> PENDING is not in the table', () => {
54	    expect(canTransition('CONFIRMED', 'PENDING', admin)).toBe(false)
55	  })
56	  it('COMPLETED -> ACTIVE is not in the table', () => {
57	    expect(canTransition('COMPLETED', 'ACTIVE', admin)).toBe(false)
58	  })
59	  it('CANCELLED -> PENDING is not in the table', () => {
60	    expect(canTransition('CANCELLED', 'PENDING', admin)).toBe(false)
61	  })
62	  it('NO_SHOW -> CONFIRMED is not in the table', () => {
63	    expect(canTransition('NO_SHOW', 'CONFIRMED', admin)).toBe(false)
64	  })
65	  it('ACTIVE -> CANCELLED is not in the table', () => {
66	    expect(canTransition('ACTIVE', 'CANCELLED', admin)).toBe(false)
67	  })
68	})
69	
70	describe('transition side effects', () => {
71	  it('PENDING -> CONFIRMED marks the payment PAID and verifies it', () => {
72	    const rule = getTransitionRule('PENDING', 'CONFIRMED')
73	    expect(rule?.effect?.payment_status).toBe('PAID')
74	    expect(rule?.effect?.verifyPayment).toBe(true)
75	  })
76	  it('CONFIRMED -> CANCELLED refunds the payment', () => {
77	    const rule = getTransitionRule('CONFIRMED', 'CANCELLED')
78	    expect(rule?.effect?.payment_status).toBe('REFUNDED')
79	  })
80	  it('PENDING -> CANCELLED has no payment side effect', () => {
81	    const rule = getTransitionRule('PENDING', 'CANCELLED')
82	    expect(rule?.effect).toBeUndefined()
83	  })
84	  it('getTransitionRule returns undefined for unknown pairs', () => {
85	    const from: ReservationStatus = 'COMPLETED'
86	    const to: ReservationStatus = 'ACTIVE'
87	    expect(getTransitionRule(from, to)).toBeUndefined()
88	  })
89	})
```

Ringkasan cakupan tes yang sudah ada (untuk menghindari duplikasi): 7 tes transisi diizinkan, 10 tes transisi ditolak (termasuk `PENDING->ACTIVE`, `PENDING->COMPLETED`, `CONFIRMED->PENDING`, `COMPLETED->ACTIVE`, `CANCELLED->PENDING`, `NO_SHOW->CONFIRMED`, `ACTIVE->CANCELLED`), dan 4 tes efek samping (`PAID`+`verifyPayment`, `REFUNDED`, tanpa efek, `undefined`). Semua lewat `canTransition`/`getTransitionRule`. **Tidak ada** tes langsung untuk `transitionKey` (baris 81–86) sebagai unit terpisah.

File tes lain yang ada di repo (tidak diminta isinya): `tests/unit/utils.test.ts`, `tests/unit/validation.test.ts`, `tests/api/booking.test.ts`, `tests/api/global-setup.ts`, `tests/e2e/auth.spec.ts`, `tests/e2e/booking.spec.ts`, `tests/e2e/global-setup.ts`.

---

## 5. Konfigurasi Tes

### 5a. `package.json` — bagian `"scripts"` (verbatim)

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset --force",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
```

### 5b. `package.json` — bagian `"devDependencies"` (verbatim)

```json
  "devDependencies": {
    "@playwright/test": "^1.64.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.12.2",
    "@types/react": "^18.2.73",
    "@types/react-dom": "^18.2.23",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "prisma": "^6.19.3",
    "tailwindcss": "^3.4.3",
    "tsx": "^4.23.15",
    "typescript": "^5.4.3",
    "vitest": "^1.6.1"
  }
```

Catatan: **tidak ada** `@vitest/coverage-v8` maupun `@vitest/coverage-istanbul` di `devDependencies`. Tidak ada script `test:coverage`.

### 5c. `vitest.config.ts` (seluruh file, 18 baris, verbatim)

```ts
1	import { defineConfig } from 'vitest/config'
2	import { fileURLToPath } from 'node:url'
3	
4	export default defineConfig({
5	  resolve: {
6	    // '@' -> project root, matching tsconfig paths.
7	    alias: {
8	      '@': fileURLToPath(new URL('./', import.meta.url)),
9	    },
10	  },
11	  test: {
12	    environment: 'node',
13	    include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'],
14	    globalSetup: ['./tests/api/global-setup.ts'],
15	    testTimeout: 30_000,
16	    hookTimeout: 150_000,
17	  },
18	})
```

Catatan penting: `globalSetup` menunjuk `tests/api/global-setup.ts`, jadi setiap `vitest run` (termasuk yang dibatasi ke tes unit) akan menjalankan global setup API tersebut. Tidak ada blok `coverage` di konfigurasi ini.

### 5d. Keberadaan coverage provider di `node_modules`

| Paket | Terpasang? |
|-------|-----------|
| `@vitest/coverage-v8` | **TIDAK** |
| `@vitest/coverage-istanbul` | **TIDAK** |
| `vitest` (pembanding) | YA |

Diperiksa dengan cek direktori `node_modules/@vitest/coverage-v8` dan `node_modules/@vitest/coverage-istanbul`; keduanya tidak ada. Tidak ada paket yang diinstal.

---

## 6. Eksekusi Coverage

**coverage provider belum terpasang**

Perintah `npx vitest run --coverage --coverage.include=lib/reservation-status.ts --coverage.reporter=text` **tidak dijalankan**, sesuai instruksi, karena baik `@vitest/coverage-v8` maupun `@vitest/coverage-istanbul` tidak ada di `node_modules`. Tidak ada keluaran coverage untuk ditempel.

---

## 7. Info Git

### `git remote -v`

```
origin	https://github.com/ctreix/gaming-rental-system.git (fetch)
origin	https://github.com/ctreix/gaming-rental-system.git (push)
```

### Branch aktif

```
main
```

### `git log --oneline -5`

```
c7906b72 feat: add Vitest configuration for unit and API tests
02f3ab5b Remove Supabase configuration from environment file
0448960e fifth commit
410cc4b7 fourth commit
5ec93dcf third commit
```

### `gh auth status`

```
gh tidak tersedia
```

(`gh: command not found` — CLI GitHub tidak terpasang di lingkungan ini.)

### `gh repo view --json hasIssuesEnabled`

```
gh tidak tersedia
```

Tidak dapat dilaporkan apakah Issues diaktifkan pada repo, karena `gh` tidak tersedia. Tidak ada upaya instalasi.

---

## 8. Daftar TIDAK ADA / TIDAK PASTI

**TIDAK ADA**
- Handler `GET` di `app/api/reservations/[id]/route.ts` — file hanya berisi `export const dynamic` dan `PATCH`.
- Handler `DELETE` di `app/api/reservations/[id]/route.ts`.
- Handler lain (`PUT`, `POST`) di `app/api/reservations/[id]/route.ts`.
- `@vitest/coverage-v8` di `node_modules` dan di `devDependencies`.
- `@vitest/coverage-istanbul` di `node_modules` dan di `devDependencies`.
- Script npm khusus coverage (mis. `test:coverage`) di `package.json`.
- Blok `coverage` di `vitest.config.ts`.
- Pemanggilan email/outbox di ketiga file yang dianalisis (`lib/reservation-status.ts`, `app/api/reservations/[id]/route.ts`, `app/api/locks/route.ts`).
- Tes unit langsung untuk `transitionKey` di `tests/unit/reservation-status.test.ts`.
- `gh` CLI (dan karenanya `gh auth status` serta `gh repo view --json hasIssuesEnabled` tidak bisa dijalankan).

**TIDAK PASTI**
- Rentang "baris sekitar 47–150" untuk handler `POST` di `app/api/locks/route.ts`: fungsi sebenarnya adalah baris **48–164** (komentar handler mulai baris 42). Saya menyalin seluruh fungsi 48–164 agar utuh; bukan pemotongan sesuai 47–150.
- Jumlah titik keputusan bisa berbeda 1–2 tergantung konvensi penghitungan: saya menghitung `.catch()` pada `request.json()` sebagai satu catch, optional chaining `?.` sebagai satu keputusan, dan `else` tidak muncul di kode ini. Angka "utama" pada tabel 2b dan 2c **tidak** memasukkan `.catch` (disebut terpisah).
- `adminOnly` pada `TransitionRule` tidak pernah dibaca oleh `canTransition`; apakah ini disengaja (dokumentasi) atau bug tidak dapat dipastikan dari kode saja.
- Apakah `payment_verified_at`/`payment_verified_by` benar-benar ada di `prisma/schema.prisma`: hanya diklaim oleh komentar baris 34–35; saya tidak memverifikasi schema.
- Hasil `gh repo view --json hasIssuesEnabled` (status Issues repo) tidak dapat dipastikan tanpa `gh`.
- Perilaku `vitest run` yang dibatasi ke tes unit tetap memicu `globalSetup: ./tests/api/global-setup.ts`; apakah setup itu memerlukan database aktif tidak diperiksa dan tidak dijalankan.
