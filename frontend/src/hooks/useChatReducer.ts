import { useReducer } from 'react'
import { chatReducer, initialState } from '../state/reducer'
import type { ChatState } from '../state/reducer'
import type { ChatAction } from '../state/actions'

export function useChatReducer(): { state: ChatState; dispatch: React.Dispatch<ChatAction> } {
  const [state, dispatch] = useReducer(chatReducer, initialState)
  return { state, dispatch }
}
