import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMsg, Identity } from '../types'
import { MessageBubble } from './MessageBubble'

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

function getDateLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) return 'Today'
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate()
  ) return 'Yesterday'
  return dateFormatter.format(d)
}

type ListItem =
  | { kind: 'date'; label: string; key: string }
  | { kind: 'msg';  msg: ChatMsg; isOwn: boolean }

interface Props {
  messages: ChatMsg[]
  identity: Identity
}

function DownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </svg>
  )
}

export const MessageList = memo(function MessageList({ messages, identity }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const [showFab, setShowFab]         = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const items = useMemo<ListItem[]>(() => {
    const result: ListItem[] = []
    let lastDateLabel = ''
    messages.forEach((msg) => {
      const label = getDateLabel(msg.ts)
      if (label !== lastDateLabel) {
        result.push({ kind: 'date', label, key: `date-${label}-${msg.id}` })
        lastDateLabel = label
      }
      result.push({
        kind: 'msg',
        msg,
        isOwn: msg.name === identity.name && msg.emoji === identity.emoji,
      })
    })
    return result
  }, [messages, identity])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const isNear = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    nearBottomRef.current = isNear
    setShowFab(!isNear)
    if (isNear) setUnreadCount(0)
  }

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last) return
    if (!last.isNew) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
      return
    }
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      setUnreadCount(0)
    } else {
      setUnreadCount((c) => c + 1)
    }
  }, [messages.length])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    setUnreadCount(0)
  }, [])

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto flex flex-col py-2"
        style={{ background: 'var(--md-sys-color-surface-container-lowest)' }}
      >
        {messages.length === 0 ? (
          <div
            className="flex-1 flex items-center justify-center"
            style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: 'var(--md-type-body-medium)' }}
          >
            No messages yet. Say hello!
          </div>
        ) : (
          items.map((item) =>
            item.kind === 'date' ? (
              <div
                key={item.key}
                className="flex items-center justify-center py-2 px-4"
              >
                <span
                  className="px-3 py-0.5 rounded-md-full"
                  style={{
                    background: 'var(--md-sys-color-surface-container-high)',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    fontSize: 'var(--md-type-label-small)',
                  }}
                >
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageBubble key={item.msg.id} msg={item.msg} isOwn={item.isOwn} />
            )
          )
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {showFab && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 w-10 h-10 rounded-md-full flex items-center justify-center md-elevation-2 transition-transform duration-short2 active:scale-95"
          style={{
            background: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
          }}
          aria-label="Scroll to bottom"
        >
          {unreadCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-md-full flex items-center justify-center px-1"
              style={{
                background: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                fontSize: 'var(--md-type-label-small)',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <DownIcon />
        </button>
      )}
    </div>
  )
})
