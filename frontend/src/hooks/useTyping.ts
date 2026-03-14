import { useRef, useCallback } from 'react'

export function useTyping(send: (data: object) => void) {
  const activeRef = useRef(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInput = useCallback(() => {
    if (!activeRef.current) {
      activeRef.current = true
      send({ type: 'typing', active: true })
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      activeRef.current = false
      send({ type: 'typing', active: false })
    }, 2000)
  }, [send])

  const clearTyping = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (activeRef.current) {
      activeRef.current = false
      send({ type: 'typing', active: false })
    }
  }, [send])

  return { handleInput, clearTyping }
}
