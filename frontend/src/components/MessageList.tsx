import { useEffect, useRef } from 'react'
import type { ChatMsg, Identity } from '../types'
import { MessageBubble } from './MessageBubble'

interface Props {
  messages: ChatMsg[]
  identity: Identity
}

export function MessageList({ messages, identity }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)

  const checkNearBottom = () => {
    const el = containerRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  useEffect(() => {
    if (nearBottomRef.current) {
      const el = containerRef.current
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length])

  return (
    <div
      ref={containerRef}
      onScroll={checkNearBottom}
      className="flex-1 flex flex-col overflow-y-auto py-2"
      style={{ background: 'var(--md-sys-color-surface-container-lowest)' }}
    >
      {messages.map((msg, i) => {
        const prev = messages[i - 1]
        const grouped = !!prev && prev.name === msg.name && prev.emoji === msg.emoji
        const isOwn = msg.name === identity.name && msg.emoji === identity.emoji
        return (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={isOwn}
            grouped={grouped}
          />
        )
      })}
      <div style={{ height: 8 }} />
    </div>
  )
}
