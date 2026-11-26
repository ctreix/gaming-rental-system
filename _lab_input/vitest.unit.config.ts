import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/unit/white-box-*.test.ts'],
    coverage: { provider: 'istanbul', include: [
        'lib/auth.ts', 'lib/db.ts', 'lib/serialize.ts', 'lib/validation.ts', 'lib/reservation-status.ts',
        'app/api/auth/{register,login,logout,me,forgot-password,reset-password}/route.ts',
        'app/api/units/route.ts', 'app/api/units/*/route.ts', 'app/api/units/*/availability/route.ts',
        'app/api/locks/route.ts', 'app/api/locks/*/route.ts',
        'app/api/reservations/route.ts', 'app/api/reservations/mine/route.ts', 'app/api/reservations/*/route.ts',
      ], reporter: ['text','json','json-summary'], reportsDirectory: './coverage' },
  },
})
