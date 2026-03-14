import { useState, useEffect } from 'react'
import type { SnackbarItem } from '../types'

interface SingleProps {
  text:      string
  onDismiss: () => void
}

function Snackbar({ text, onDismiss }: SingleProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 200)
    }, 3000)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [onDismiss])

  return (
    <div
      className="rounded-md-extra-small px-4 py-3 md-elevation-3 transition-all duration-short4"
      style={{
        background: 'var(--md-sys-color-inverse-surface)',
        color: 'var(--md-sys-color-inverse-on-surface)',
        fontSize: 'var(--md-type-body-medium)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        willChange: 'opacity, transform',
        minWidth: 240,
        maxWidth: 420,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  )
}

interface StackProps {
  items:    SnackbarItem[]
  onRemove: (id: string) => void
}

export function SnackbarStack({ items, onRemove }: StackProps) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2 items-center"
      style={{ zIndex: 100, pointerEvents: 'none' }}
    >
      {items.map((item) => (
        <Snackbar key={item.id} text={item.text} onDismiss={() => onRemove(item.id)} />
      ))}
    </div>
  )
}
