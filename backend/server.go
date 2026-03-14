package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
)

type contextKey string

const ctxUID contextKey = "uid"

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Origin check is handled by Caddy in production.
		// Allow all in the backend; CORS header middleware handles REST.
		return true
	},
}

var allowedOrigins = map[string]bool{
	"https://c.hss-science.org": true,
	"http://localhost:5173":     true,
}

// Server wires together all hubs, the store, and the HTTP handler.
type Server struct {
	hubs  [256]*Hub
	store Store
	mux   *http.ServeMux
}

// NewServer creates a Server, wires routes, and starts all hubs.
func NewServer(store Store) *Server {
	s := &Server{store: store, mux: http.NewServeMux()}

	for i := range s.hubs {
		h := NewHub(i+1, store)
		s.hubs[i] = h
		go h.Run()
	}

	s.mux.HandleFunc("GET /ch/{n}", s.withCookie(http.HandlerFunc(s.redirectHandler)).ServeHTTP)
	s.mux.HandleFunc("GET /ws/{n}", s.withCookie(http.HandlerFunc(s.wsHandler)).ServeHTTP)
	s.mux.HandleFunc("GET /api/active", s.withCookie(s.withCORS(http.HandlerFunc(s.activeHandler))).ServeHTTP)

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

// ---- middleware -------------------------------------------------------------

func (s *Server) withCookie(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var uid string
		if ck, err := r.Cookie("uid"); err == nil {
			uid = ck.Value
		} else {
			uid = newUUID()
			http.SetCookie(w, &http.Cookie{
				Name:     "uid",
				Value:    uid,
				Path:     "/",
				SameSite: http.SameSiteLaxMode,
			})
		}
		ctx := context.WithValue(r.Context(), ctxUID, uid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---- handlers ---------------------------------------------------------------

func (s *Server) redirectHandler(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/", http.StatusMovedPermanently)
}

func (s *Server) wsHandler(w http.ResponseWriter, r *http.Request) {
	nStr := r.PathValue("n")
	n, err := strconv.Atoi(nStr)
	if err != nil || n < 1 || n > 256 {
		http.Error(w, "channel must be 1–256", http.StatusBadRequest)
		return
	}

	uid, _ := r.Context().Value(ctxUID).(string)
	hub := s.hubs[n-1]

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrader already wrote the error response.
		return
	}

	c := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
		uid:  uid,
	}

	go c.WritePump()
	go c.ReadPump(s.store)
}

type activeChannel struct {
	Ch     int `json:"ch"`
	Online int `json:"online"`
}

func (s *Server) activeHandler(w http.ResponseWriter, r *http.Request) {
	var result []activeChannel
	for i, h := range s.hubs {
		// Snapshot online count without locking: send a query event and wait
		// would be correct but complex. Instead, read len(h.clients) via a
		// dedicated channel query to keep the Hub goroutine as sole mutator.
		count := hubOnlineCount(h)
		if count > 0 {
			result = append(result, activeChannel{Ch: i + 1, Online: count})
		}
	}
	if result == nil {
		result = []activeChannel{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// hubOnlineCount returns the number of connected clients without mutating hub state.
// It sends a synchronous query through the hub's event channel so that the count
// is always read by the Hub goroutine (no additional mutex).
func hubOnlineCount(h *Hub) int {
	reply := make(chan int, 1)
	h.in <- Event{Kind: KindQuery, Reply: reply}
	return <-reply
}

// ---- helpers ----------------------------------------------------------------

func newUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%12x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
