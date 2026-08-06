use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::xlsx;

pub struct Db {
    pub conn: Connection,
}

pub fn init(
    db_path: &Path,
    produse_seed: Option<PathBuf>,
    agenti_seed: Option<PathBuf>,
) -> rusqlite::Result<Db> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    migrate(&conn)?;

    let db = Db { conn };

    if !already_seeded(&db.conn)? {
        if let Some(p) = produse_seed.filter(|p| p.exists()) {
            let _ = xlsx::import_produse_file(&db.conn, &p);
        }
        if let Some(a) = agenti_seed.filter(|a| a.exists()) {
            let _ = xlsx::import_agenti_file(&db.conn, &a);
        }
        mark_seeded(&db.conn)?;
    }

    Ok(db)
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    ddl: &str,
) -> rusqlite::Result<()> {
    let has: bool = conn.query_row(
        &format!("SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = '{column}'"),
        [],
        |r| r.get(0),
    )?;
    if !has {
        conn.execute_batch(ddl)?;
    }
    Ok(())
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS produse (
           cod TEXT PRIMARY KEY,
           denumire TEXT,
           grupa TEXT
        );
         CREATE TABLE IF NOT EXISTS agenti_clienti (
            client TEXT PRIMARY KEY,
            agent TEXT
         );
         CREATE TABLE IF NOT EXISTS meta (
            cheie TEXT PRIMARY KEY,
            valoare TEXT
         );
         CREATE TABLE IF NOT EXISTS rapoarte_salvate (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            an1 TEXT,
            an2 TEXT,
            fisier1 TEXT,
            fisier2 TEXT,
            nr_clienti INTEGER,
            nr_agenti INTEGER,
            creat_la TEXT,
            date TEXT
         );
         DROP TABLE IF EXISTS raport_coloane;
         CREATE INDEX IF NOT EXISTS idx_produse_grupa ON produse(grupa);
         CREATE INDEX IF NOT EXISTS idx_agenti_agent ON agenti_clienti(agent);",
    )?;
    // Momentul la care produsul a fost adăugat în fondul de date prin butonul
    // „Adaugă produse lipsă" — folosit pentru badge-ul „NOU" din pagina Produse.
    ensure_column(
        conn,
        "produse",
        "adaugat_la",
        "ALTER TABLE produse ADD COLUMN adaugat_la TEXT;",
    )
}

fn already_seeded(conn: &Connection) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare("SELECT valoare FROM meta WHERE cheie = 'seed_version'")?;
    let mut rows = stmt.query([])?;
    Ok(rows.next()?.is_some())
}

fn mark_seeded(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO meta (cheie, valoare) VALUES ('seed_version', '1')
         ON CONFLICT(cheie) DO UPDATE SET valoare = '1'",
        [],
    )?;
    Ok(())
}

#[cfg(test)]
pub fn test_conn() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    migrate(&conn).unwrap();
    conn
}
