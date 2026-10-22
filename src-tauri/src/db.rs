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
) -> Result<Db, Box<dyn std::error::Error>> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    migrate(&conn)?;

    let db = Db { conn };

    if !already_seeded(&db.conn)? {
        // Seed both tables atomically: a missing or invalid resource must be
        // retried on the next launch, never recorded as a successful seed.
        let produse_path = produse_seed
            .filter(|p| p.exists())
            .ok_or("lipsește fișierul implicit de produse")?;
        let agenti_path = agenti_seed
            .filter(|p| p.exists())
            .ok_or("lipsește fișierul implicit de agenți")?;
        let tx = db.conn.unchecked_transaction()?;
        xlsx::import_produse_file(&tx, &produse_path)?;
        xlsx::import_agenti_file(&tx, &agenti_path)?;
        mark_seeded(&tx)?;
        tx.commit()?;
    }

    Ok(db)
}

fn ensure_column(conn: &Connection, table: &str, column: &str, ddl: &str) -> rusqlite::Result<()> {
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
         CREATE TABLE IF NOT EXISTS grupe (
            nume TEXT PRIMARY KEY
         );
         CREATE TABLE IF NOT EXISTS agenti (
            nume TEXT PRIMARY KEY
         );
         DROP TABLE IF EXISTS raport_coloane;
         CREATE INDEX IF NOT EXISTS idx_produse_grupa ON produse(grupa);
         CREATE INDEX IF NOT EXISTS idx_agenti_agent ON agenti_clienti(agent);",
    )?;
    // Populează tabelele de lookup din datele existente (idempotent).
    conn.execute_batch(
        "INSERT OR IGNORE INTO grupe (nume) SELECT DISTINCT grupa FROM produse WHERE grupa != '' AND grupa IS NOT NULL;
         INSERT OR IGNORE INTO agenti (nume) SELECT DISTINCT agent FROM agenti_clienti WHERE agent != '' AND agent IS NOT NULL;",
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_seed_rolls_back_and_can_retry() {
        let path = std::env::temp_dir().join(format!("delta-seed-{}.db", std::process::id()));
        let resources = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
        let products = resources.join("Grupa corespunzatoare.xlsx");
        let agents = resources.join("Raport agent.xlsx");
        assert!(init(&path, Some(products.clone()), Some(products.clone())).is_err());
        {
            let conn = Connection::open(&path).unwrap();
            assert!(!already_seeded(&conn).unwrap());
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM produse", [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0);
        }
        let db = init(&path, Some(products), Some(agents)).unwrap();
        assert!(already_seeded(&db.conn).unwrap());
        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM produse", [], |r| r.get(0))
            .unwrap();
        assert!(count > 2000);
        drop(db);
        std::fs::remove_file(path).unwrap();
    }
}
