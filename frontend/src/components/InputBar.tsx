import { useState, useRef } from 'react'

interface Props {
  onSend:   (text: string) => void
  onInput:  () => void
  disabled?: boolean
}

function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

export function InputBar({ onSend, onInput, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div
      className="flex items-end gap-3 px-3 py-3 shrink-0 border-t"
      style={{
        background: 'var(--md-sys-color-surface-container-low)',
        borderColor: 'var(--md-sys-color-outline-variant)',
      }}
    >
      {/* MD3 Filled text field */}
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); onInput() }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder="Message"
          className="w-full resize-none px-4 pt-3 pb-2 outline-none transition-all duration-short4"
          style={{
            background: 'var(--md-sys-color-surface-container-highest)',
            color: 'var(--md-sys-color-on-surface)',
            borderRadius: '4px 4px 0 0',
            borderBottom: focused
              ? `2px solid var(--md-sys-color-primary)`
              : `1px solid var(--md-sys-color-outline-variant)`,
            fontSize: 'var(--md-type-body-large)',
            lineHeight: '1.5',
            maxHeight: 120,
            overflowY: 'auto',
          }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`
          }}
        />
      </div>

      {/* Send FAB */}
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="w-14 h-14 rounded-md-large flex items-center justify-center shrink-0
                   transition-transform duration-short2 active:scale-95
                   disabled:opacity-40"
        style={{
          background: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)',
          boxShadow: '0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.3)',
        }}
        aria-label="Send"
      >
        <SendIcon />
      </button>
    </div>
  )
}
