import { useEffect, useRef, useCallback, useState } from 'react'
import type { Identity, User, WireStoredMsg, WireMsg } from '../types'

interface WSCallbacks {
  onHistory: (msgs: WireStoredMsg[]) => void
  onMsg:     (msg: WireMsg) => void
  onJoin:    (name: string, emoji: string, ts: number) => void
  onLeave:   (name: string, emoji: string, ts: number) => void
  onOnline:  (users: User[]) => void
  onTyping:  (name: string, active: boolean) => void
}

export function useWebSocket(
  channel: number,
  identity: Identity | null,
  callbacks: WSCallbacks,
) {
  const [connected, setConnected]     = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const wsRef  = useRef<WebSocket | null>(null)
  const cbRef  = useRef(callbacks)

  useEffect(() => { cbRef.current = callbacks })

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    if (!identity) return

    let closed = false
    let retryTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      const url = import.meta.env.DEV
        ? `ws://localhost:8080/ws/${channel}`
        : `wss://c.hss-science.org/ws/${channel}`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setReconnecting(false)
        ws.send(JSON.stringify({ type: 'join', name: identity.name, emoji: identity.emoji }))
      }

      ws.onmessage = (e: MessageEvent<string>) => {
        let msg: Record<string, unknown>
        try { msg = JSON.parse(e.data) as Record<string, unknown> }
        catch { return }

        switch (msg.type) {
          case 'history':
            cbRef.current.onHistory((msg.msgs as WireStoredMsg[]) ?? [])
            break
          case 'msg':
            cbRef.current.onMsg(msg as unknown as WireMsg)
            break
          case 'join':
            cbRef.current.onJoin(msg.name as string, msg.emoji as string, msg.ts as number)
            break
          case 'leave':
            cbRef.current.onLeave(msg.name as string, msg.emoji as string, msg.ts as number)
            break
          case 'online':
            cbRef.current.onOnline((msg.users as User[]) ?? [])
            break
          case 'typing':
            cbRef.current.onTyping(msg.name as string, msg.active as boolean)
            break
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!closed) {
          setReconnecting(true)
          retryTimer = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      closed = true
      clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [channel, identity?.name, identity?.emoji])

  return { send, connected, reconnecting }
}
