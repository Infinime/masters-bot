--DROP TABLE IF EXISTS documents;
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY, text TEXT NOT NULL);
DROP TABLE IF EXISTS images;
CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL, url TEXT NOT NULL);
DROP TABLE IF EXISTS share;
CREATE TABLE IF NOT EXISTS share (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by TEXT NOT NULL,
    chat_history TEXT NOT NULL,
    last_updated TEXT NOT NULL,
    password TEXT NOT NULL
);
