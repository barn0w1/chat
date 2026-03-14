import { useState } from 'react'
import type { User } from '../types'

interface Props {
  channel: number
  onlineUsers: User[]
}

export function TopAppBar({ channel, onlineUsers }: Props) {
  const [jumpValue, setJumpValue] = useState('')

  const handleJumpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const n = parseInt(jumpValue, 10)
    if (n >= 1 && n <= 256) {
      window.location.href = `/ch/${n}`
    }
    setJumpValue('')
  }

  return (
    <header
      className="flex items-center gap-2 px-3 h-14 shrink-0 border-b"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--md-sys-color-outline-variant)',
      }}
    >
      {/* Channel badge */}
      <span
        className="text-sm font-semibold rounded-md-full px-3 py-1 shrink-0"
        style={{
          background: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)',
          fontSize: 'var(--md-type-label-large)',
        }}
      >
        # {channel}
      </span>

      {/* Online user chips — scrollable */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0">
        {onlineUsers.map((u) => (
          <span
            key={`${u.emoji}${u.name}`}
            className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md-small border text-xs whitespace-nowrap"
            style={{
              background: 'var(--md-sys-color-surface-container-low)',
              borderColor: 'var(--md-sys-color-outline-variant)',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: 'var(--md-type-label-medium)',
            }}
          >
            <span>{u.emoji}</span>
            <span>{u.name}</span>
          </span>
        ))}
      </div>

      {/* Channel jump input */}
      <input
        type="number"
        min={1}
        max={256}
        value={jumpValue}
        onChange={(e) => setJumpValue(e.target.value)}
        onKeyDown={handleJumpKeyDown}
        placeholder="ch"
        className="w-16 h-8 text-center rounded-md-full border bg-transparent outline-none shrink-0
                   focus:border-[var(--md-sys-color-primary)] transition-colors duration-short4"
        style={{
          borderColor: 'var(--md-sys-color-outline)',
          color: 'var(--md-sys-color-on-surface)',
          fontSize: 'var(--md-type-label-large)',
        }}
      />
    </header>
  )
}
