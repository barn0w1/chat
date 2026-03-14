package main

import (
	"encoding/json"
	"log"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
	sendBufSize    = 256
)

// Client represents a single WebSocket connection.
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID string
}

// Hub manages all clients connected to a single channel.
// All state mutation happens inside Run — no mutexes required.
type Hub struct {
	channel int
	in      chan Event
	clients map[*Client]struct{}
	joined  map[*Client]*joinedInfo // clients that completed the join handshake
	online  int32                   // atomic: count of connected clients
	store   Store
}

type joinedInfo struct {
	name  string
	emoji string
}

// NewHub creates an idle hub; call Run in a goroutine.
func NewHub(channel int, store Store) *Hub {
	return &Hub{
		channel: channel,
		in:      make(chan Event, 128),
		clients: make(map[*Client]struct{}),
		joined:  make(map[*Client]*joinedInfo),
		store:   store,
	}
}

// Online returns the number of connected clients (safe for concurrent reads).
func (h *Hub) Online() int {
	return int(atomic.LoadInt32(&h.online))
}

// Run processes events sequentially; must run in exactly one goroutine.
func (h *Hub) Run() {
	for ev := range h.in {
		switch ev.Type {

		case EventRegister:
			h.clients[ev.Client] = struct{}{}
			atomic.StoreInt32(&h.online, int32(len(h.clients)))

		case EventUnregister:
			if _, ok := h.clients[ev.Client]; !ok {
				break
			}
			delete(h.clients, ev.Client)
			close(ev.Client.send)
			atomic.StoreInt32(&h.online, int32(len(h.clients)))

			if info, ok := h.joined[ev.Client]; ok {
				delete(h.joined, ev.Client)
				h.broadcast(mustMarshal(WireLeave{
					Type:  "leave",
					Name:  info.name,
					Emoji: info.emoji,
					Ts:    nowMilli(),
				}))
				h.broadcastOnline()
			}

		case EventJoin:
			info := &joinedInfo{name: ev.Name, emoji: ev.Emoji}
			h.joined[ev.Client] = info

			msgs, err := h.store.GetHistory(h.channel, 50)
			if err != nil {
				log.Printf("hub[%d] history: %v", h.channel, err)
				msgs = []*Message{}
			}
			if msgs == nil {
				msgs = []*Message{}
			}
			h.send(ev.Client, mustMarshal(WireHistory{Type: "history", Msgs: msgs}))
			h.broadcast(mustMarshal(WireJoin{
				Type:  "join",
				Name:  ev.Name,
				Emoji: ev.Emoji,
				Ts:    nowMilli(),
			}))
			h.broadcastOnline()

		case EventMessage:
			info, ok := h.joined[ev.Client]
			if !ok {
				break
			}
			m := &Message{
				Channel:   h.channel,
				UserID:    ev.Client.userID,
				Name:      info.name,
				Emoji:     info.emoji,
				Body:      ev.Text,
				CreatedAt: nowMilli(),
			}
			if err := h.store.SaveMessage(m); err != nil {
				log.Printf("hub[%d] save: %v", h.channel, err)
			}
			h.broadcast(mustMarshal(WireMsg{
				Type:  "msg",
				Name:  info.name,
				Emoji: info.emoji,
				Text:  ev.Text,
				Ts:    m.CreatedAt,
			}))

		case EventTyping:
			info, ok := h.joined[ev.Client]
			if !ok {
				break
			}
			h.broadcast(mustMarshal(WireTyping{
				Type:   "typing",
				Name:   info.name,
				Active: ev.Active,
			}))
		}
	}
}

func (h *Hub) send(c *Client, data []byte) {
	select {
	case c.send <- data:
	default:
	}
}

func (h *Hub) broadcast(data []byte) {
	for c := range h.clients {
		select {
		case c.send <- data:
		default:
			// client is too slow; skip this message
		}
	}
}

func (h *Hub) broadcastOnline() {
	users := make([]UserInfo, 0, len(h.joined))
	for _, info := range h.joined {
		users = append(users, UserInfo{Name: info.name, Emoji: info.emoji})
	}
	h.broadcast(mustMarshal(WireOnline{Type: "online", Users: users}))
}

// ReadPump pumps messages from the WebSocket to the hub.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.in <- Event{Type: EventUnregister, Client: c}
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg IncomingMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "join":
			c.hub.in <- Event{
				Type:   EventJoin,
				Client: c,
				Name:   msg.Name,
				Emoji:  msg.Emoji,
			}
		case "msg":
			if msg.Text != "" {
				c.hub.in <- Event{
					Type:   EventMessage,
					Client: c,
					Text:   msg.Text,
				}
			}
		case "typing":
			c.hub.in <- Event{
				Type:   EventTyping,
				Client: c,
				Active: msg.Active,
			}
		}
	}
}

// WritePump pumps messages from the hub to the WebSocket.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func mustMarshal(v any) []byte {
	data, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return data
}

func nowMilli() int64 {
	return time.Now().UnixMilli()
}
