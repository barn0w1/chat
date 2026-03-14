package main

import (
	"flag"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "./chat.db", "SQLite database path")
	flag.Parse()

	store, err := NewSQLiteStore(*dbPath)
	if err != nil {
		log.Fatalf("store: %v", err)
	}

	srv := NewServer(store)
	log.Printf("listening on %s", *addr)
	if err := http.ListenAndServe(*addr, srv); err != nil {
		log.Fatalf("server: %v", err)
	}
}
