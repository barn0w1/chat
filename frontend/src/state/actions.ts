import type { Identity, User, WireStoredMsg, WireMsg } from '../types'

export type ChatAction =
  | { type: 'HISTORY';        msgs: WireStoredMsg[] }
  | { type: 'MSG_RECEIVED';   msg: WireMsg }
  | { type: 'JOIN';           name: string; emoji: string }
  | { type: 'LEAVE';          name: string; emoji: string }
  | { type: 'ONLINE';         users: User[] }
  | { type: 'TYPING_START';   name: string }
  | { type: 'TYPING_STOP';    name: string }
  | { type: 'TYPING_EXPIRE';  name: string }
  | { type: 'SNACKBAR_ADD';   text: string }
  | { type: 'SNACKBAR_REMOVE'; id: string }
  | { type: 'SET_IDENTITY';   identity: Identity }
  | { type: 'SET_CONNECTED';  connected: boolean }
