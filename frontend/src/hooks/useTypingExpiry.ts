import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { ChatAction } from '../state/actions'

export function useTypingExpiry(typingUsers: string[], dispatch: Dispatch<ChatAction>) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = timersRef.current

    typingUsers.forEach((name) => {
      if (!timers.has(name)) {
        const t = setTimeout(() => {
          dispatch({ type: 'TYPING_EXPIRE', name })
          timers.delete(name)
        }, 3000)
        timers.set(name, t)
      }
    })

    timers.forEach((t, name) => {
      if (!typingUsers.includes(name)) {
        clearTimeout(t)
        timers.delete(name)
      }
    })
  }, [typingUsers, dispatch])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t))
    }
  }, [])
}
