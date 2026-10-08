'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gamepad2 } from 'lucide-react'
import {
  registerSchema,
  fieldErrors,
  NAME_MAX,
  EMAIL_MAX,
  PHONE_MAX,
  PASSWORD_MIN,
  PASSWORD_MAX,
} from '@/lib/validation'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsed = registerSchema.safeParse({
      full_name: fullName,
      email,
      phone_number: phone,
      password,
    })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Registration failed')
        setLoading(false)
        return
      }
    } catch {
      setError('Registration failed')
      setLoading(false)
      return
    }

    router.push('/customer')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-gaming-card border-cyan-500/20 glow-border">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4">
            <Gamepad2 className="h-6 w-6 text-cyan-400" />
          </div>
          <CardTitle className="text-2xl text-white">Create Account</CardTitle>
          <CardDescription className="text-gray-400">
            Join the gaming community today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="register-name" className="text-sm text-gray-400 mb-1 block">Full Name</label>
              <input
                id="register-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-gaming-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="John Doe"
                maxLength={NAME_MAX}
                required
              />
              {errors.full_name && (
                <p className="text-red-400 text-sm mt-1">{errors.full_name}</p>
              )}
            </div>
            <div>
              <label htmlFor="register-email" className="text-sm text-gray-400 mb-1 block">Email</label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gaming-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="you@example.com"
                maxLength={EMAIL_MAX}
                required
              />
              {errors.email && (
                <p className="text-red-400 text-sm mt-1">{errors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="register-phone" className="text-sm text-gray-400 mb-1 block">Phone Number</label>
              <input
                id="register-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-gaming-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="+62 812-3456-7890"
                maxLength={PHONE_MAX}
              />
              {errors.phone_number && (
                <p className="text-red-400 text-sm mt-1">{errors.phone_number}</p>
              )}
            </div>
            <div>
              <label htmlFor="register-password" className="text-sm text-gray-400 mb-1 block">Password</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gaming-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder="••••••••"
                maxLength={PASSWORD_MAX}
                required
                minLength={PASSWORD_MIN}
              />
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">{errors.password}</p>
              )}
            </div>
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
