package main

// User represents a connected user's identity.
type User struct {
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
}

// Message is the database record for a chat message.
type Message struct {
	ID        int64
	Channel   int
	UserID    string
	Name      string
	Emoji     string
	Body      string
	CreatedAt int64
}

// StoredMsg is the wire representation sent inside a history payload.
type StoredMsg struct {
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Text  string `json:"text"`
	Ts    int64  `json:"ts"`
}

// Envelope is what a client sends to the server.
type Envelope struct {
	Type   string `json:"type"`
	Name   string `json:"name,omitempty"`
	Emoji  string `json:"emoji,omitempty"`
	Text   string `json:"text,omitempty"`
	Active bool   `json:"active,omitempty"`
}

// EventKind identifies the kind of internal hub event.
type EventKind uint8

const (
	KindRegister   EventKind = iota
	KindUnregister EventKind = iota
	KindMsg        EventKind = iota
	KindTyping     EventKind = iota
	KindQuery      EventKind = iota
)

// Event is the internal message passed from Client goroutines into Hub.Run.
type Event struct {
	Kind   EventKind
	Client *Client
	Env    Envelope
	Reply  chan int // used by KindQuery only
}
