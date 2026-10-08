'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gamepad2 } from 'lucide-react'
import {
  resetFormSchema,
  fieldErrors,
  PASSWORD_MIN,
  PASSWORD_MAX,
} from '@/lib/validation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  // The reset link carries a one-time token in the query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resetToken = params.get('token')
    setToken(resetToken)
    if (!resetToken) {
      setError('This reset link is invalid or expired')
    }
    setReady(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('This reset link is invalid or expired')
      return
    }

    const parsed = resetFormSchema.safeParse({
      token,
      password,
      confirm_password: confirmPassword,
    })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'This reset link is invalid or expired')
        setLoading(false)
        return
      }
    } catch {
      setError('This reset link is invalid or expired')
      setLoading(false)
      return
    }

    toast.success('Password updated. You can now sign in with your new password.')
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-gaming-card border-cyan-500/20 glow-border">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4">
            <Gamepad2 className="h-6 w-6 text-cyan-400" />
          </div>
          <CardTitle className="text-2xl text-white">Reset Password</CardTitle>
          <CardDescription className="text-gray-400">
            Choose a new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-gray-400 text-sm text-center animate-pulse">
              Verifying reset link...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-password" className="text-sm text-gray-400 mb-1 block">New Password</label>
                <input
                  id="reset-password"
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
              <div>
                <label htmlFor="reset-confirm" className="text-sm text-gray-400 mb-1 block">Confirm Password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gaming-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="••••••••"
                  maxLength={PASSWORD_MAX}
                  required
                  minLength={PASSWORD_MIN}
                />
                {errors.confirm_password && (
                  <p className="text-red-400 text-sm mt-1">{errors.confirm_password}</p>
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
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-gray-400 mt-4">
            <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300">
              Back to Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
