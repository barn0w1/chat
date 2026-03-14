import { memo } from 'react'

interface Props {
  typingUsers: string[]
}

export const TypingIndicator = memo(function TypingIndicator({ typingUsers }: Props) {
  const visible = typingUsers.length > 0

  const label = typingUsers.length === 1
    ? `${typingUsers[0]} is typing…`
    : `${typingUsers.slice(0, 2).join(', ')} are typing…`

  return (
    <div
      className="flex items-center gap-2 px-4 h-8 transition-opacity duration-short2"
      style={{
        background: 'var(--md-sys-color-surface-container-lowest)',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--md-sys-color-primary)',
              animation: visible ? `bounce-dot 1.2s ease-in-out ${i * 0.2}s infinite` : 'none',
            }}
          />
        ))}
      </div>

      {visible && (
        <span
          style={{
            fontSize: 'var(--md-type-label-medium)',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
})
