package main

import (
	"flag"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	db := flag.String("db", "./chat.db", "SQLite file path")
	flag.Parse()

	store, err := NewSQLiteStore(*db)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}

	srv := NewServer(store)
	log.Printf("listening on %s", *addr)
	if err := http.ListenAndServe(*addr, srv); err != nil {
		log.Fatal(err)
	}
}
