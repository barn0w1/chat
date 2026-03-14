import type { ChatAction } from './actions'
import type { ChatMsg, Identity, SnackbarItem, User } from '../types'

export interface ChatState {
  messages:    ChatMsg[]
  onlineUsers: User[]
  typingUsers: string[]
  snackbars:   SnackbarItem[]
  identity:    Identity | null
  connected:   boolean
}

function sameAuthor(a: ChatMsg, b: { name: string; emoji: string }): boolean {
  return a.name === b.name && a.emoji === b.emoji
}

function buildMsg(
  wire: { name: string; emoji: string; text: string; ts: number },
  isNew: boolean,
  grouped: boolean,
): ChatMsg {
  return {
    id: crypto.randomUUID(),
    name: wire.name,
    emoji: wire.emoji,
    text: wire.text,
    ts: wire.ts,
    isNew,
    grouped,
    isLastInGroup: true,
  }
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

export const initialState: ChatState = {
  messages:    [],
  onlineUsers: [],
  typingUsers: [],
  snackbars:   [],
  identity:    loadIdentity(),
  connected:   false,
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'HISTORY': {
      const msgs: ChatMsg[] = action.msgs.map((wire, i) => {
        const prev = action.msgs[i - 1]
        const grouped = !!prev && prev.name === wire.name && prev.emoji === wire.emoji
        return buildMsg(wire, false, grouped)
      })
      for (let i = 0; i < msgs.length - 1; i++) {
        const next = msgs[i + 1]
        if (sameAuthor(msgs[i], next)) {
          msgs[i] = { ...msgs[i], isLastInGroup: false }
        }
      }
      return { ...state, messages: msgs }
    }

    case 'MSG_RECEIVED': {
      const prev = state.messages[state.messages.length - 1]
      const grouped = !!prev && sameAuthor(prev, action.msg)
      const newMsg = buildMsg(action.msg, true, grouped)
      const messages = grouped
        ? [...state.messages.slice(0, -1), { ...prev, isLastInGroup: false }, newMsg]
        : [...state.messages, newMsg]
      return { ...state, messages }
    }

    case 'JOIN':
      return {
        ...state,
        snackbars: [
          ...state.snackbars,
          { id: crypto.randomUUID(), text: `${action.emoji} ${action.name} joined` },
        ],
      }

    case 'LEAVE':
      return {
        ...state,
        snackbars: [
          ...state.snackbars,
          { id: crypto.randomUUID(), text: `${action.emoji} ${action.name} left` },
        ],
      }

    case 'ONLINE':
      return { ...state, onlineUsers: action.users }

    case 'TYPING_START':
      return state.typingUsers.includes(action.name)
        ? state
        : { ...state, typingUsers: [...state.typingUsers, action.name] }

    case 'TYPING_STOP':
    case 'TYPING_EXPIRE':
      return { ...state, typingUsers: state.typingUsers.filter((n) => n !== action.name) }

    case 'SNACKBAR_ADD':
      return {
        ...state,
        snackbars: [...state.snackbars, { id: crypto.randomUUID(), text: action.text }],
      }

    case 'SNACKBAR_REMOVE':
      return { ...state, snackbars: state.snackbars.filter((s) => s.id !== action.id) }

    case 'SET_IDENTITY':
      return { ...state, identity: action.identity }

    case 'SET_CONNECTED':
      return { ...state, connected: action.connected }
  }
}
