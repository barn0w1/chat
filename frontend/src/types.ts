export interface User {
  name: string
  emoji: string
}

export interface Identity {
  name: string
  emoji: string
}

export interface ChatMsg {
  id: string
  name: string
  emoji: string
  text: string
  ts: number
  isNew: boolean
  grouped: boolean
  isLastInGroup: boolean
}

export interface SnackbarItem {
  id: string
  text: string
}

export interface WireHistory {
  type: 'history'
  msgs: WireStoredMsg[]
}

export interface WireStoredMsg {
  name: string
  emoji: string
  text: string
  ts: number
}

export interface WireMsg {
  type: 'msg'
  name: string
  emoji: string
  text: string
  ts: number
}

export interface WirePresence {
  type: 'join' | 'leave'
  name: string
  emoji: string
  ts: number
}

export interface WireOnline {
  type: 'online'
  users: User[]
}

export interface WireTyping {
  type: 'typing'
  name: string
  active: boolean
}

export type ServerEvent =
  | WireHistory
  | WireMsg
  | WirePresence
  | WireOnline
  | WireTyping
