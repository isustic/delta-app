use calamine::{open_workbook, Data, Reader, Xlsx};
use rusqlite::{params, Connection};
use std::path::Path;

fn float_to_string(f: f64) -> String {
    if f.fract() == 0.0 && f.abs() < 9.0e15 {
        format!("{}", f as i64)
    } else {
        format!("{}", f)
    }
}

fn cell_to_string(cell: Option<&Data>) -> Option<String> {
    match cell? {
        Data::Empty => None,
        Data::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
        Data::Int(i) => Some(i.to_string()),
        Data::Float(f) => Some(float_to_string(*f)),
        Data::Bool(b) => Some(b.to_string()),
        Data::DateTime(dt) => Some(dt.to_string()),
        _ => None,
    }
}

fn first_sheet_range(path: &Path) -> Result<calamine::Range<Data>, String> {
    let mut wb: Xlsx<_> = open_workbook(path).map_err(|e| format!("deschidere xlsx: {e}"))?;
    let name = wb
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "fișierul nu are niciun sheet".to_string())?;
    wb.worksheet_range(&name)
        .map_err(|e| format!("citire sheet: {e}"))
}

pub fn import_produse_file(conn: &Connection, path: &Path) -> Result<usize, String> {
    let range = first_sheet_range(path)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM produse", []).map_err(|e| e.to_string())?;

    let mut count = 0usize;
    for (i, row) in range.rows().enumerate() {
        if i == 0 {
            continue;
        }
        let Some(cod) = cell_to_string(row.first()) else {
            continue;
        };
        let denumire = cell_to_string(row.get(1)).unwrap_or_default();
        let grupa = cell_to_string(row.get(2)).unwrap_or_default();
        tx.execute(
            "INSERT INTO produse (cod, denumire, grupa) VALUES (?1, ?2, ?3)
             ON CONFLICT(cod) DO UPDATE SET denumire = ?2, grupa = ?3",
            params![cod, denumire, grupa],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

pub fn import_agenti_file(conn: &Connection, path: &Path) -> Result<usize, String> {
    let range = first_sheet_range(path)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM agenti_clienti", [])
        .map_err(|e| e.to_string())?;

    let mut count = 0usize;
    for (i, row) in range.rows().enumerate() {
        if i == 0 {
            continue;
        }
        let Some(client) = cell_to_string(row.first()) else {
            continue;
        };
        let agent = cell_to_string(row.get(1)).unwrap_or_default();
        tx.execute(
            "INSERT INTO agenti_clienti (client, agent) VALUES (?1, ?2)
             ON CONFLICT(client) DO UPDATE SET agent = ?2",
            params![client, agent],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn res(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(name)
    }

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE produse (cod TEXT PRIMARY KEY, denumire TEXT, grupa TEXT);
             CREATE TABLE agenti_clienti (client TEXT PRIMARY KEY, agent TEXT);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn importa_produsele_default() {
        let conn = setup_db();
        let n = import_produse_file(&conn, &res("Grupa corespunzatoare.xlsx")).unwrap();
        assert!(n > 2000, "mă așteptam la >2000 produse, got {n}");

        let grupa: String = conn
            .query_row("SELECT grupa FROM produse WHERE cod = '00100'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(grupa, "ORISING");
    }

    #[test]
    fn importa_agentii_default() {
        let conn = setup_db();
        let n = import_agenti_file(&conn, &res("Raport agent.xlsx")).unwrap();
        assert!(n > 500, "mă așteptam la >500 rânduri, got {n}");

        let agent: String = conn
            .query_row(
                "SELECT agent FROM agenti_clienti WHERE client = 'A&A BEAUTY HAIR STYLE S.R.L.'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(agent, "Bogdan Nae");
    }
}
