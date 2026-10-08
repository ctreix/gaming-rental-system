import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Business timezone (Asia/Jakarta, UTC+7, no DST).
const WIB_TIME_ZONE = 'Asia/Jakarta'

const wibDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: WIB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const wibTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function formatWIB(date: Date): string {
  return `${wibDate.format(date)} ${wibTime.format(date)} WIB`
}

// Splits a message body into text chunks and clickable link chunks.
function renderBody(body: string): React.ReactNode[] {
  return body.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        className="text-cyan-400 hover:text-cyan-300 underline break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default async function DevMailPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  const messages = await prisma.emailOutbox.findMany({
    orderBy: { created_at: 'desc' },
    take: 20,
  })

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-white font-bold">Dev Mail Outbox</h1>
            <p className="text-gray-400 text-sm">
              Last {messages.length} message{messages.length === 1 ? '' : 's'} from
              the local EmailOutbox table (development only).
            </p>
          </div>
          <a
            href="/dev/mail"
            className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 text-sm hover:bg-cyan-500/10"
          >
            Refresh
          </a>
        </div>

        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-12">
            No messages yet. Request a password reset to populate the outbox.
          </p>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className="bg-gaming-card border border-gray-700 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-white font-medium break-all">{message.to}</span>
                  <span className="text-gray-500 whitespace-nowrap">
                    {formatWIB(message.created_at)}
                  </span>
                </div>
                <p className="text-cyan-400 text-sm font-medium">{message.subject}</p>
                <div className="text-gray-400 text-sm whitespace-pre-wrap break-words">
                  {renderBody(message.body)}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-gray-400">
          <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
