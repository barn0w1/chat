package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// ---- server→client wire types (local to this file) -------------------------

type wireHistory struct {
	Type string       `json:"type"`
	Msgs []*StoredMsg `json:"msgs"`
}

type wirePresence struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Ts    int64  `json:"ts"`
}

type wireMsg struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Text  string `json:"text"`
	Ts    int64  `json:"ts"`
}

type wireOnline struct {
	Type  string `json:"type"`
	Users []User `json:"users"`
}

type wireTyping struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

// ---- Client -----------------------------------------------------------------

// Client represents one WebSocket connection.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	uid  string
}

// ReadPump pumps messages from the WebSocket to the hub.
// It blocks until the connection is closed.
func (c *Client) ReadPump(store Store) {
	defer func() {
		c.hub.in <- Event{Kind: KindUnregister, Client: c}
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	var joined bool
	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws read error: %v", err)
			}
			return
		}

		var env Envelope
		if err := json.Unmarshal(raw, &env); err != nil {
			continue
		}

		if !joined {
			if env.Type != "join" || env.Name == "" {
				continue
			}
			joined = true
			c.hub.in <- Event{Kind: KindRegister, Client: c, Env: env}
			continue
		}

		switch env.Type {
		case "msg":
			if env.Text != "" {
				c.hub.in <- Event{Kind: KindMsg, Client: c, Env: env}
			}
		case "typing":
			c.hub.in <- Event{Kind: KindTyping, Client: c, Env: env}
		}
	}
}

// WritePump pumps messages from the hub send channel to the WebSocket.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ---- Hub --------------------------------------------------------------------

// Hub manages all clients connected to a single channel.
// All state mutation happens exclusively inside Hub.Run — no mutexes needed.
type Hub struct {
	channel int
	in      chan Event
	clients map[*Client]User
	store   Store
}

// NewHub creates a Hub for the given channel number.
func NewHub(channel int, store Store) *Hub {
	return &Hub{
		channel: channel,
		in:      make(chan Event, 512),
		clients: make(map[*Client]User),
		store:   store,
	}
}

// Run processes events until the in channel is closed.
// Must be called in its own goroutine.
func (h *Hub) Run() {
	for ev := range h.in {
		switch ev.Kind {
		case KindRegister:
			h.handleRegister(ev.Client, ev.Env)
		case KindUnregister:
			h.handleUnregister(ev.Client)
		case KindMsg:
			h.handleMsg(ev.Client, ev.Env)
		case KindTyping:
			h.handleTyping(ev.Client, ev.Env)
		case KindQuery:
			if ev.Reply != nil {
				ev.Reply <- len(h.clients)
			}
		}
	}
}

func (h *Hub) handleRegister(c *Client, env Envelope) {
	u := User{Name: env.Name, Emoji: env.Emoji}
	h.clients[c] = u

	// Send message history to the joining client.
	msgs, err := h.store.GetHistory(h.channel, 50)
	if err != nil {
		log.Printf("history error ch=%d: %v", h.channel, err)
	}
	stored := make([]*StoredMsg, len(msgs))
	for i, m := range msgs {
		stored[i] = &StoredMsg{Name: m.Name, Emoji: m.Emoji, Text: m.Body, Ts: m.CreatedAt}
	}
	h.sendTo(c, encode(wireHistory{Type: "history", Msgs: stored}))

	// Broadcast join presence event to everyone.
	ts := time.Now().UnixMilli()
	h.broadcast(encode(wirePresence{Type: "join", Name: u.Name, Emoji: u.Emoji, Ts: ts}))

	// Send current online roster to everyone.
	h.broadcastOnline()
}

func (h *Hub) handleUnregister(c *Client) {
	u, ok := h.clients[c]
	if !ok {
		return
	}
	delete(h.clients, c)
	close(c.send)

	ts := time.Now().UnixMilli()
	h.broadcast(encode(wirePresence{Type: "leave", Name: u.Name, Emoji: u.Emoji, Ts: ts}))
	h.broadcastOnline()
}

func (h *Hub) handleMsg(c *Client, env Envelope) {
	u, ok := h.clients[c]
	if !ok {
		return
	}
	ts := time.Now().UnixMilli()

	if err := h.store.SaveMessage(&Message{
		Channel:   h.channel,
		UserID:    c.uid,
		Name:      u.Name,
		Emoji:     u.Emoji,
		Body:      env.Text,
		CreatedAt: ts,
	}); err != nil {
		log.Printf("save message error: %v", err)
	}

	h.broadcast(encode(wireMsg{Type: "msg", Name: u.Name, Emoji: u.Emoji, Text: env.Text, Ts: ts}))
}

func (h *Hub) handleTyping(c *Client, env Envelope) {
	u, ok := h.clients[c]
	if !ok {
		return
	}
	b := encode(wireTyping{Type: "typing", Name: u.Name, Active: env.Active})
	for client := range h.clients {
		if client != c {
			h.sendTo(client, b)
		}
	}
}

func (h *Hub) broadcastOnline() {
	users := make([]User, 0, len(h.clients))
	for _, u := range h.clients {
		users = append(users, u)
	}
	h.broadcast(encode(wireOnline{Type: "online", Users: users}))
}

func (h *Hub) broadcast(b []byte) {
	for c := range h.clients {
		h.sendTo(c, b)
	}
}

func (h *Hub) sendTo(c *Client, b []byte) {
	select {
	case c.send <- b:
	default:
		delete(h.clients, c)
		close(c.send)
	}
}

// encode marshals v to JSON, panicking on error (programmer error).
func encode(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
