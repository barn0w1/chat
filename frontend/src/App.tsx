import { useState, useCallback, useRef } from 'react'
import type { ChatMsg, Identity, SnackbarItem, User, WireMsg, WireStoredMsg } from './types'
import { useWebSocket } from './hooks/useWebSocket'
import { useTyping }    from './hooks/useTyping'
import { TopAppBar }       from './components/TopAppBar'
import { MessageList }     from './components/MessageList'
import { TypingIndicator } from './components/TypingIndicator'
import { InputBar }        from './components/InputBar'
import { IdentitySheet }   from './components/IdentitySheet'
import { SnackbarStack }   from './components/Snackbar'

function parseChannel(): number {
  const m = window.location.pathname.match(/^\/ch\/(\d+)$/)
  if (!m) return 0
  const n = parseInt(m[1], 10)
  return n >= 1 && n <= 256 ? n : 0
}

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem('identity')
    if (!raw) return null
    return JSON.parse(raw) as Identity
  } catch {
    return null
  }
}

let msgCounter = 0
function nextId() { return String(++msgCounter) }

export default function App() {
  const channel = parseChannel()

  if (channel === 0) {
    window.location.replace('/ch/1')
    return null
  }

  const [identity, setIdentity]       = useState<Identity | null>(loadIdentity)
  const [messages, setMessages]       = useState<ChatMsg[]>([])
  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [snackbars, setSnackbars]     = useState<SnackbarItem[]>([])

  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const addSnackbar = useCallback((text: string) => {
    const item: SnackbarItem = { id: nextId(), text }
    setSnackbars((prev) => [...prev, item])
  }, [])

  const removeSnackbar = useCallback((id: string) => {
    setSnackbars((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const onHistory = useCallback((msgs: WireStoredMsg[]) => {
    setMessages(msgs.map((m) => ({ id: nextId(), ...m, live: false })))
  }, [])

  const onMsg = useCallback((m: WireMsg) => {
    const msg: ChatMsg = { id: nextId(), name: m.name, emoji: m.emoji, text: m.text, ts: m.ts, live: true }
    setMessages((prev) => [...prev, msg])
  }, [])

  const onJoin = useCallback((name: string, emoji: string) => {
    addSnackbar(`${emoji} ${name} joined`)
  }, [addSnackbar])

  const onLeave = useCallback((name: string, emoji: string) => {
    addSnackbar(`${emoji} ${name} left`)
  }, [addSnackbar])

  const onOnline = useCallback((users: User[]) => {
    setOnlineUsers(users)
  }, [])

  const onTyping = useCallback((name: string, active: boolean) => {
    const timers = typingTimers.current
    if (timers.has(name)) clearTimeout(timers.get(name)!)

    if (active) {
      setTypingUsers((prev) => prev.includes(name) ? prev : [...prev, name])
      const t = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== name))
        timers.delete(name)
      }, 3000)
      timers.set(name, t)
    } else {
      setTypingUsers((prev) => prev.filter((n) => n !== name))
      timers.delete(name)
    }
  }, [])

  const { send, connected } = useWebSocket(channel, identity, {
    onHistory, onMsg, onJoin, onLeave, onOnline, onTyping,
  })

  const { handleInput, clearTyping } = useTyping(send)

  const handleSend = useCallback((text: string) => {
    send({ type: 'msg', text })
    clearTyping()
  }, [send, clearTyping])

  const handleIdentitySubmit = useCallback((id: Identity) => {
    setIdentity(id)
  }, [])

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--md-sys-color-surface)' }}
    >
      <TopAppBar channel={channel} onlineUsers={onlineUsers} />

      {identity ? (
        <>
          <MessageList messages={messages} identity={identity} />
          <TypingIndicator typingUsers={typingUsers} />
          <InputBar
            onSend={handleSend}
            onInput={handleInput}
            disabled={!connected}
          />
        </>
      ) : (
        <div className="flex-1" />
      )}

      {!identity && <IdentitySheet onSubmit={handleIdentitySubmit} />}

      <SnackbarStack items={snackbars} onRemove={removeSnackbar} />

      {/* Reconnecting banner */}
      {identity && !connected && (
        <div
          className="fixed top-14 left-0 right-0 text-center py-1.5"
          style={{
            background: 'var(--md-sys-color-secondary-container)',
            color: 'var(--md-sys-color-on-secondary-container)',
            fontSize: 'var(--md-type-label-medium)',
            zIndex: 30,
          }}
        >
          Reconnecting…
        </div>
      )}
    </div>
  )
}
