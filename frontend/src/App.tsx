import { useCallback, useEffect, useState } from 'react'
import type { Identity } from './types'
import { useChatReducer }   from './hooks/useChatReducer'
import { useWebSocket }     from './hooks/useWebSocket'
import { useTyping }        from './hooks/useTyping'
import { useTypingExpiry }  from './hooks/useTypingExpiry'
import { TopAppBar }        from './components/TopAppBar'
import { MessageList }      from './components/MessageList'
import { TypingIndicator }  from './components/TypingIndicator'
import { InputBar }         from './components/InputBar'
import { IdentitySheet }    from './components/IdentitySheet'
import { SnackbarStack }    from './components/Snackbar'

function parseChannel(): number {
  const m = window.location.pathname.match(/^\/ch\/(\d+)$/)
  if (!m) return 0
  const n = parseInt(m[1], 10)
  return n >= 1 && n <= 256 ? n : 0
}

export default function App() {
  const channel = parseChannel()

  const { state, dispatch } = useChatReducer()
  const { send }            = useWebSocket(channel, state.identity, dispatch)
  const { handleInput, clearTyping } = useTyping(send)
  useTypingExpiry(state.typingUsers, dispatch)

  const [sheetOpen, setSheetOpen] = useState(!state.identity)

  useEffect(() => {
    if (channel === 0) window.location.replace('/ch/1')
  }, [channel])

  useEffect(() => {
    if (state.identity) {
      localStorage.setItem('identity', JSON.stringify(state.identity))
    }
  }, [state.identity])

  const handleSend = useCallback((text: string) => {
    send({ type: 'msg', text })
    clearTyping()
  }, [send, clearTyping])

  const handleIdentitySubmit = useCallback((id: Identity) => {
    dispatch({ type: 'SET_IDENTITY', identity: id })
  }, [dispatch])

  const handleSheetDismiss = useCallback(() => {
    setSheetOpen(false)
  }, [])

  const removeSnackbar = useCallback((id: string) => {
    dispatch({ type: 'SNACKBAR_REMOVE', id })
  }, [dispatch])

  if (channel === 0) return null

  const reconnecting = !!state.identity && !state.connected

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--md-sys-color-surface)' }}
    >
      <TopAppBar
        channel={channel}
        onlineUsers={state.onlineUsers}
        connected={!reconnecting}
      />

      {state.identity ? (
        <>
          <MessageList messages={state.messages} identity={state.identity} />
          <TypingIndicator typingUsers={state.typingUsers} />
          <InputBar
            onSend={handleSend}
            onInput={handleInput}
            disabled={!state.connected}
          />
        </>
      ) : (
        <div className="flex-1" />
      )}

      {sheetOpen && (
        <IdentitySheet
          onSubmit={handleIdentitySubmit}
          onDismiss={handleSheetDismiss}
        />
      )}

      <SnackbarStack items={state.snackbars} onRemove={removeSnackbar} />
    </div>
  )
}
