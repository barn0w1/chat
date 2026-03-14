import { memo, useState } from 'react'
import type { User } from '../types'

const MAX_VISIBLE_CHIPS = 3

interface Props {
  channel:     number
  onlineUsers: User[]
  connected:   boolean
}

export const TopAppBar = memo(function TopAppBar({ channel, onlineUsers, connected }: Props) {
  const [jumpValue, setJumpValue] = useState('')
  const [jumpFocused, setJumpFocused] = useState(false)

  const visibleUsers  = onlineUsers.slice(0, MAX_VISIBLE_CHIPS)
  const overflowCount = onlineUsers.length - MAX_VISIBLE_CHIPS

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
      className="shrink-0 border-b"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--md-sys-color-outline-variant)',
      }}
    >
      <div className="flex items-center gap-2 px-3 h-14">
        <span
          className="font-semibold rounded-md-full px-3 py-1 shrink-0"
          style={{
            background: connected
              ? 'var(--md-sys-color-primary-container)'
              : 'var(--md-sys-color-surface-container-high)',
            color: connected
              ? 'var(--md-sys-color-on-primary-container)'
              : 'var(--md-sys-color-on-surface-variant)',
            fontSize: 'var(--md-type-label-large)',
            transition: 'background 300ms, color 300ms',
          }}
        >
          # {channel}
        </span>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0">
          {visibleUsers.map((u) => (
            <span
              key={`${u.emoji}${u.name}`}
              className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md-small border whitespace-nowrap"
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
          {overflowCount > 0 && (
            <span
              className="shrink-0 px-2 py-0.5 rounded-md-small border whitespace-nowrap"
              style={{
                background: 'var(--md-sys-color-surface-container-low)',
                borderColor: 'var(--md-sys-color-outline-variant)',
                color: 'var(--md-sys-color-on-surface-variant)',
                fontSize: 'var(--md-type-label-medium)',
              }}
            >
              +{overflowCount}
            </span>
          )}
        </div>

        <input
          type="text"
          inputMode="numeric"
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          onKeyDown={handleJumpKeyDown}
          onFocus={() => setJumpFocused(true)}
          onBlur={() => setJumpFocused(false)}
          placeholder="Go to #"
          className="w-16 h-8 text-center rounded-md-full outline-none shrink-0 transition-all duration-short4"
          style={{
            border: jumpFocused
              ? '2px solid var(--md-sys-color-primary)'
              : '1px solid var(--md-sys-color-outline)',
            background: 'transparent',
            color: 'var(--md-sys-color-on-surface)',
            fontSize: 'var(--md-type-label-large)',
          }}
        />
      </div>

      <div
        className="overflow-hidden transition-all duration-medium2 flex items-center justify-center"
        style={{
          height: connected ? 0 : 24,
          background: 'var(--md-sys-color-secondary-container)',
          color: 'var(--md-sys-color-on-secondary-container)',
          fontSize: 'var(--md-type-label-medium)',
        }}
      >
        Reconnecting…
      </div>
    </header>
  )
})
