package main

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// Store persists and retrieves chat messages.
type Store interface {
	SaveMessage(m *Message) error
	GetHistory(channel, limit int) ([]*Message, error)
}

// SQLiteStore is a Store backed by SQLite via database/sql.
// database/sql manages its own connection pool, so no additional mutex is needed.
type SQLiteStore struct {
	db *sql.DB
}

const schema = `
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
`

// NewSQLiteStore opens (or creates) a SQLite database at path and applies the schema.
func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if _, err = db.Exec(schema); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) SaveMessage(m *Message) error {
	_, err := s.db.Exec(
		`INSERT INTO messages (channel, user_id, name, emoji, body, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		m.Channel, m.UserID, m.Name, m.Emoji, m.Body, m.CreatedAt,
	)
	return err
}

// GetHistory returns the last `limit` messages for a channel, oldest-first.
func (s *SQLiteStore) GetHistory(channel, limit int) ([]*Message, error) {
	rows, err := s.db.Query(
		`SELECT id, channel, user_id, name, emoji, body, created_at
		 FROM (
		   SELECT * FROM messages WHERE channel = ?
		   ORDER BY created_at DESC LIMIT ?
		 ) ORDER BY created_at ASC`,
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
	return msgs, rows.Err()
}
