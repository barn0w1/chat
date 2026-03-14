import { useState, useEffect } from 'react'
import type { Identity } from '../types'

const EMOJIS = [
  '🌿','🌊','🌙','⭐','🌸','🔥','🎈','🌈','🦋','🍀',
  '🎵','🌺','🏔️','🌻','🦚','🌴','🍁','🐙','🦊','🌵',
]

interface Props {
  onSubmit: (identity: Identity) => void
}

export function IdentitySheet({ onSubmit }: Props) {
  const [visible, setVisible] = useState(false)
  const [name, setName]       = useState('')
  const [emoji, setEmoji]     = useState(EMOJIS[0])
  const [nameFocused, setNameFocused] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const identity: Identity = { name: trimmed, emoji }
    localStorage.setItem('identity', JSON.stringify(identity))
    onSubmit(identity)
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 transition-opacity duration-medium2"
        style={{
          background: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          zIndex: 40,
        }}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 flex flex-col pb-8 px-4 pt-2
                   transition-transform duration-medium4 ease-md-emphasized-decel"
        style={{
          background: 'var(--md-sys-color-surface-container-low)',
          borderRadius: '28px 28px 0 0',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          zIndex: 50,
          maxWidth: 600,
          margin: '0 auto',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-2">
          <div
            style={{
              width: 32,
              height: 4,
              borderRadius: 2,
              background: 'var(--md-sys-color-on-surface-variant)',
              opacity: 0.4,
            }}
          />
        </div>

        {/* Title */}
        <h2
          className="mt-2 mb-1"
          style={{
            fontSize: 'var(--md-type-headline-small)',
            color: 'var(--md-sys-color-on-surface)',
            fontWeight: 400,
          }}
        >
          Who are you?
        </h2>

        {/* Subtitle */}
        <p
          className="mb-6"
          style={{
            fontSize: 'var(--md-type-body-medium)',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          No account needed — just pick a name and an emoji.
        </p>

        {/* Outlined text field */}
        <div className="relative mb-6">
          <label
            className="absolute left-3 transition-all duration-short4 pointer-events-none"
            style={{
              top: nameFocused || name ? '-10px' : '50%',
              transform: nameFocused || name ? 'translateY(0) scale(0.85)' : 'translateY(-50%)',
              transformOrigin: 'left',
              fontSize: 'var(--md-type-body-large)',
              color: nameFocused
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-on-surface-variant)',
              background: nameFocused || name ? 'var(--md-sys-color-surface-container-low)' : 'transparent',
              padding: nameFocused || name ? '0 4px' : '0',
            }}
          >
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            maxLength={24}
            className="w-full h-14 px-4 outline-none rounded-md-extra-small transition-all duration-short4"
            style={{
              border: nameFocused
                ? `2px solid var(--md-sys-color-primary)`
                : `1px solid var(--md-sys-color-outline)`,
              background: 'transparent',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: 'var(--md-type-body-large)',
            }}
          />
        </div>

        {/* Emoji grid */}
        <div
          className="grid gap-2 mb-6"
          style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className="aspect-square flex items-center justify-center rounded-md-small
                         transition-all duration-short4"
              style={{
                fontSize: 20,
                background: emoji === e
                  ? 'var(--md-sys-color-primary-container)'
                  : 'var(--md-sys-color-surface-container)',
                border: emoji === e
                  ? '2px solid var(--md-sys-color-primary)'
                  : '2px solid transparent',
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="h-10 px-6 rounded-md-full transition-opacity duration-short4 disabled:opacity-40"
            style={{
              background: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontSize: 'var(--md-type-label-large)',
              fontWeight: 500,
              letterSpacing: '0.1px',
            }}
          >
            Enter chat
          </button>
        </div>
      </div>
    </>
  )
}
