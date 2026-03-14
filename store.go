package main

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

// Store persists and retrieves chat messages.
type Store interface {
	SaveMessage(m *Message) error
	GetHistory(channel, limit int) ([]*Message, error)
}

// SQLiteStore is a Store backed by SQLite via database/sql.
// The connection pool handles concurrency internally.
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore opens the database at path, runs migrations, and
// returns a ready-to-use store.
func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	if err := migrate(db); err != nil {
		return nil, err
	}
	return &SQLiteStore{db: db}, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			channel    INTEGER NOT NULL,
			user_id    TEXT    NOT NULL,
			name       TEXT    NOT NULL,
			emoji      TEXT    NOT NULL,
			body       TEXT    NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_ch_ts ON messages(channel, created_at DESC);
	`)
	return err
}

func (s *SQLiteStore) SaveMessage(m *Message) error {
	_, err := s.db.Exec(
		`INSERT INTO messages (channel, user_id, name, emoji, body, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		m.Channel, m.UserID, m.Name, m.Emoji, m.Body, m.CreatedAt,
	)
	return err
}

func (s *SQLiteStore) GetHistory(channel, limit int) ([]*Message, error) {
	rows, err := s.db.Query(
		`SELECT id, channel, user_id, name, emoji, body, created_at
		 FROM messages WHERE channel = ?
		 ORDER BY created_at DESC LIMIT ?`,
		channel, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []*Message
	for rows.Next() {
		m := &Message{}
		if err := rows.Scan(&m.ID, &m.Channel, &m.UserID, &m.Name, &m.Emoji, &m.Body, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Reverse: SQL returned newest-first; we want oldest-first.
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	return msgs, nil
}
