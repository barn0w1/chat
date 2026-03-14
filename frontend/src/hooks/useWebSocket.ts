import { useEffect, useRef, useCallback } from 'react'
import type { Dispatch } from 'react'
import type { ChatAction } from '../state/actions'
import type { Identity, ServerEvent, WireStoredMsg, User } from '../types'

function parseEvent(raw: string): ServerEvent | null {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  switch (obj.type) {
    case 'history':
      return { type: 'history', msgs: (obj.msgs as WireStoredMsg[]) ?? [] }
    case 'msg':
      return {
        type: 'msg',
        name: obj.name as string,
        emoji: obj.emoji as string,
        text: obj.text as string,
        ts: obj.ts as number,
      }
    case 'join':
      return { type: 'join', name: obj.name as string, emoji: obj.emoji as string, ts: obj.ts as number }
    case 'leave':
      return { type: 'leave', name: obj.name as string, emoji: obj.emoji as string, ts: obj.ts as number }
    case 'online':
      return { type: 'online', users: (obj.users as User[]) ?? [] }
    case 'typing':
      return { type: 'typing', name: obj.name as string, active: obj.active as boolean }
    default:
      return null
  }
}

export function useWebSocket(
  channel: number,
  identity: Identity | null,
  dispatch: Dispatch<ChatAction>,
) {
  const wsRef      = useRef<WebSocket | null>(null)
  const dispatchRef = useRef(dispatch)

  useEffect(() => { dispatchRef.current = dispatch })

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
        dispatchRef.current({ type: 'SET_CONNECTED', connected: true })
        ws.send(JSON.stringify({ type: 'join', name: identity.name, emoji: identity.emoji }))
      }

      ws.onmessage = (e: MessageEvent<string>) => {
        const event = parseEvent(e.data)
        if (!event) return
        const d = dispatchRef.current
        switch (event.type) {
          case 'history':  d({ type: 'HISTORY',      msgs: event.msgs });                          break
          case 'msg':      d({ type: 'MSG_RECEIVED',  msg: event });                                break
          case 'join':     d({ type: 'JOIN',          name: event.name, emoji: event.emoji });      break
          case 'leave':    d({ type: 'LEAVE',         name: event.name, emoji: event.emoji });      break
          case 'online':   d({ type: 'ONLINE',        users: event.users });                        break
          case 'typing':
            d(event.active
              ? { type: 'TYPING_START', name: event.name }
              : { type: 'TYPING_STOP',  name: event.name })
            break
        }
      }

      ws.onclose = () => {
        dispatchRef.current({ type: 'SET_CONNECTED', connected: false })
        if (!closed) {
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

  return { send }
}
