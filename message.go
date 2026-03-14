package main

// EventType represents internal hub event types.
type EventType int

const (
	EventRegister   EventType = iota // client connected
	EventUnregister                  // client disconnected
	EventJoin                        // client sent { type:"join" }
	EventMessage                     // client sent { type:"msg" }
	EventTyping                      // client sent { type:"typing" }
)

// Message is persisted in SQLite and returned in history.
// JSON tags expose only the fields the frontend needs.
type Message struct {
	ID        int64  `json:"-"`
	Channel   int    `json:"-"`
	UserID    string `json:"-"`
	Name      string `json:"name"`
	Emoji     string `json:"emoji"`
	Body      string `json:"text"`
	CreatedAt int64  `json:"ts"`
}

// Event is the internal message passed into Hub.in.
type Event struct {
	Type   EventType
	Client *Client
	Name   string
	Emoji  string
	Text   string
	Active bool
}

// UserInfo is the public representation of an online user.
type UserInfo struct {
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
}

// --- Wire types: server → client ---

type WireHistory struct {
	Type string     `json:"type"`
	Msgs []*Message `json:"msgs"`
}

type WireJoin struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Ts    int64  `json:"ts"`
}

type WireLeave struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Ts    int64  `json:"ts"`
}

type WireMsg struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Text  string `json:"text"`
	Ts    int64  `json:"ts"`
}

type WireOnline struct {
	Type  string     `json:"type"`
	Users []UserInfo `json:"users"`
}

type WireTyping struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

// --- Wire type: client → server ---

type IncomingMsg struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Emoji  string `json:"emoji"`
	Text   string `json:"text"`
	Active bool   `json:"active"`
}

// ActiveChannel is returned by /api/active.
type ActiveChannel struct {
	Ch     int `json:"ch"`
	Online int `json:"online"`
}
