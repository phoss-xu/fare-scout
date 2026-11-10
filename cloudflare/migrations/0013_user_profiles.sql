CREATE TABLE user_profiles (
 user_id INTEGER PRIMARY KEY REFERENCES users(id),
 avatar TEXT, updated_at TEXT NOT NULL
);
