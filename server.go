package main

import (
	"context"
	crand "crypto/rand"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	mrand "math/rand/v2"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
)

//go:embed static
var staticFiles embed.FS

type ctxKey struct{}

const cookieName = "uid"

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// Server holds the channel hubs and the HTTP multiplexer.
type Server struct {
	hubs [256]*Hub
	mux  *http.ServeMux
}

// NewServer pre-allocates all 256 hubs, starts each hub's Run goroutine,
// and registers HTTP routes.
func NewServer(store Store) *Server {
	s := &Server{}
	for i := range s.hubs {
		s.hubs[i] = NewHub(i+1, store)
		go s.hubs[i].Run()
	}
	s.setupRoutes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) setupRoutes() {
	s.mux = http.NewServeMux()
	s.mux.HandleFunc("GET /{$}", s.withUID(s.handleRoot))
	s.mux.HandleFunc("GET /ch/{n}", s.withUID(s.handleChannel))
	s.mux.HandleFunc("GET /ws/{n}", s.withUID(s.handleWS))
	s.mux.HandleFunc("GET /api/active", s.handleActive)
}

// withUID ensures every request carries a uid cookie and stores its value
// in the request context.
func (s *Server) withUID(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var uid string
		if c, err := r.Cookie(cookieName); err == nil {
			uid = c.Value
		} else {
			uid = newUID()
			http.SetCookie(w, &http.Cookie{
				Name:     cookieName,
				Value:    uid,
				Path:     "/",
				MaxAge:   365 * 24 * 3600,
				SameSite: http.SameSiteLaxMode,
			})
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, uid)))
	}
}

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	n := mrand.IntN(256) + 1
	http.Redirect(w, r, fmt.Sprintf("/ch/%d", n), http.StatusFound)
}

func (s *Server) handleChannel(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 1 || n > 256 {
		http.NotFound(w, r)
		return
	}
	data, err := staticFiles.ReadFile("static/index.html")
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 1 || n > 256 {
		http.NotFound(w, r)
		return
	}

	uid, _ := r.Context().Value(ctxKey{}).(string)
	hub := s.hubs[n-1]

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}

	client := &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, sendBufSize),
		userID: uid,
	}

	hub.in <- Event{Type: EventRegister, Client: client}
	go client.WritePump()
	go client.ReadPump()
}

func (s *Server) handleActive(w http.ResponseWriter, r *http.Request) {
	result := make([]ActiveChannel, 0)
	for i, h := range s.hubs {
		if n := h.Online(); n > 0 {
			result = append(result, ActiveChannel{Ch: i + 1, Online: n})
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// newUID generates a random UUID v4 using crypto/rand.
func newUID() string {
	b := make([]byte, 16)
	_, _ = crand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
