'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gamepad2, MailCheck } from 'lucide-react'
import { forgotSchema, fieldErrors, EMAIL_MAX } from '@/lib/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsed = forgotSchema.safeParse({ email })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Failed to send reset link')
        setLoading(false)
        return
      }
    } catch {
      setError('Failed to send reset link')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-gaming-card border-cyan-500/20 glow-border">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4">
            <Gamepad2 className="h-6 w-6 text-cyan-400" />
          </div>
          <CardTitle className="text-2xl text-white">Forgot Password</CardTitle>
          <CardDescription className="text-gray-400">
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-green-400" />
              </div>
              <p className="text-gray-400 text-sm">
                If an account exists for this email, a reset link has been generated.
              </p>
              <Link href="/auth/login">
                <Button
                  variant="outline"
                  className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                >
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="text-sm text-gray-400 mb-1 block">Email</label>
                <input
                  id="forgot-email"
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
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-gray-400 mt-4">
            Remember your password?{' '}
            <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
