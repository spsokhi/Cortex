use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

use crate::models::{Conversation, IndexedFile, Message};

const SCHEMA: &str = r#"
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    model_id    TEXT NOT NULL,
    system_prompt TEXT,
    tags        TEXT NOT NULL DEFAULT '[]',
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL,
    content          TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'complete',
    model_id         TEXT,
    token_count      INTEGER,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS indexed_files (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    path         TEXT NOT NULL,
    file_type    TEXT NOT NULL,
    size         INTEGER NOT NULL,
    mime_type    TEXT,
    index_status TEXT NOT NULL DEFAULT 'pending',
    chunk_count  INTEGER,
    error_msg    TEXT,
    summary      TEXT,
    tags         TEXT NOT NULL DEFAULT '[]',
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    indexed_at   INTEGER
);

CREATE TABLE IF NOT EXISTS file_chunks (
    id          TEXT PRIMARY KEY,
    file_id     TEXT NOT NULL REFERENCES indexed_files(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    page        INTEGER,
    chunk_index INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_file ON file_chunks(file_id);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"#;

pub fn db_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("No app data dir")
        .join("cortex.db")
}

pub async fn initialize_db(app: &AppHandle) -> Result<()> {
    let path = db_path(app);

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context("Failed to create app data dir")?;
    }

    let conn = Connection::open(&path).context("Failed to open database")?;
    conn.execute_batch(SCHEMA).context("Failed to apply schema")?;

    log::info!("Database initialized at {}", path.display());
    Ok(())
}

pub fn open_connection(app: &AppHandle) -> Result<Connection> {
    let path = db_path(app);
    Connection::open(path).context("Failed to open database connection")
}

// ─── Conversation CRUD ──────────────────────────────────────────────────────

pub fn list_conversations(conn: &Connection) -> Result<Vec<Conversation>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, model_id, system_prompt, tags, pinned, created_at, updated_at
         FROM conversations ORDER BY pinned DESC, updated_at DESC",
    )?;

    let convs = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(4)?;
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model_id: row.get(2)?,
                system_prompt: row.get(3)?,
                messages: vec![],
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                pinned: row.get::<_, i64>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()
        .context("Failed to list conversations")?;

    Ok(convs)
}

pub fn get_conversation(conn: &Connection, id: &str) -> Result<Option<Conversation>> {
    let conv = conn
        .query_row(
            "SELECT id, title, model_id, system_prompt, tags, pinned, created_at, updated_at
             FROM conversations WHERE id = ?1",
            params![id],
            |row| {
                let tags_json: String = row.get(4)?;
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    model_id: row.get(2)?,
                    system_prompt: row.get(3)?,
                    messages: vec![],
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    pinned: row.get::<_, i64>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .optional()
        .context("Failed to get conversation")?;

    if let Some(mut c) = conv {
        c.messages = get_messages(conn, &c.id)?;
        Ok(Some(c))
    } else {
        Ok(None)
    }
}

pub fn save_conversation(conn: &Connection, conv: &Conversation) -> Result<()> {
    let tags = serde_json::to_string(&conv.tags).unwrap_or_default();

    conn.execute(
        "INSERT INTO conversations (id, title, model_id, system_prompt, tags, pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, model_id=excluded.model_id,
           system_prompt=excluded.system_prompt, tags=excluded.tags,
           pinned=excluded.pinned, updated_at=excluded.updated_at",
        params![
            conv.id, conv.title, conv.model_id, conv.system_prompt,
            tags, conv.pinned as i64, conv.created_at, conv.updated_at
        ],
    )?;

    for msg in &conv.messages {
        save_message(conn, msg)?;
    }

    Ok(())
}

pub fn delete_conversation(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
    Ok(())
}

fn get_messages(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, status, model_id, token_count, created_at, updated_at
         FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
    )?;

    let msgs = stmt
        .query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: serde_json::from_str(&format!(r#""{}""#, row.get::<_, String>(2)?))
                    .unwrap_or(crate::models::MessageRole::User),
                content: row.get(3)?,
                status: serde_json::from_str(&format!(r#""{}""#, row.get::<_, String>(4)?))
                    .unwrap_or(crate::models::MessageStatus::Complete),
                model_id: row.get(5)?,
                token_count: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()
        .context("Failed to get messages")?;

    Ok(msgs)
}

fn save_message(conn: &Connection, msg: &Message) -> Result<()> {
    let role = serde_json::to_string(&msg.role)
        .unwrap_or_default()
        .trim_matches('"')
        .to_string();
    let status = serde_json::to_string(&msg.status)
        .unwrap_or_default()
        .trim_matches('"')
        .to_string();

    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, status, model_id, token_count, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
           content=excluded.content, status=excluded.status,
           token_count=excluded.token_count, updated_at=excluded.updated_at",
        params![
            msg.id, msg.conversation_id, role, msg.content,
            status, msg.model_id, msg.token_count, msg.created_at, msg.updated_at
        ],
    )?;

    Ok(())
}

// ─── File CRUD ──────────────────────────────────────────────────────────────

pub fn list_files(conn: &Connection) -> Result<Vec<IndexedFile>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, file_type, size, mime_type, index_status,
                chunk_count, error_msg, summary, tags, created_at, updated_at, indexed_at
         FROM indexed_files ORDER BY updated_at DESC",
    )?;

    let files = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(10)?;
            Ok(IndexedFile {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                file_type: row.get(3)?,
                size: row.get::<_, i64>(4)? as u64,
                mime_type: row.get(5)?,
                index_status: row.get(6)?,
                chunk_count: row.get(7)?,
                error: row.get(8)?,
                summary: row.get(9)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                indexed_at: row.get(13)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()
        .context("Failed to list files")?;

    Ok(files)
}

pub fn save_file(conn: &Connection, file: &IndexedFile) -> Result<()> {
    let tags = serde_json::to_string(&file.tags).unwrap_or_default();

    conn.execute(
        "INSERT INTO indexed_files (id, name, path, file_type, size, mime_type, index_status,
          chunk_count, error_msg, summary, tags, created_at, updated_at, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET
           index_status=excluded.index_status, chunk_count=excluded.chunk_count,
           error_msg=excluded.error_msg, summary=excluded.summary,
           updated_at=excluded.updated_at, indexed_at=excluded.indexed_at",
        params![
            file.id, file.name, file.path, file.file_type,
            file.size as i64, file.mime_type, file.index_status,
            file.chunk_count, file.error, file.summary,
            tags, file.created_at, file.updated_at, file.indexed_at
        ],
    )?;

    Ok(())
}

pub fn delete_file(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM indexed_files WHERE id = ?1", params![id])?;
    Ok(())
}
