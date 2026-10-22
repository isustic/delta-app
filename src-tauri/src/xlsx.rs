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

fn validate_headers(range: &calamine::Range<Data>, expected: &[&str]) -> Result<(), String> {
    if range.start().map(|(_, col)| col) != Some(0) {
        return Err("coloanele fișierului trebuie să înceapă cu A".into());
    }
    let header = range.rows().next().ok_or("fișierul este gol")?;
    for (i, name) in expected.iter().enumerate() {
        let actual = cell_to_string(header.get(i))
            .unwrap_or_default()
            .to_lowercase()
            .replace('ă', "a");
        if actual != *name {
            return Err(format!(
                "antet invalid: coloana {} trebuie să fie {name}",
                i + 1
            ));
        }
    }
    Ok(())
}

pub fn import_produse_file(conn: &Connection, path: &Path) -> Result<usize, String> {
    let range = first_sheet_range(path)?;
    validate_headers(&range, &["cod", "denumire", "grupa"])?;
    // Startup seeding already owns a transaction covering both imports.
    let tx = if conn.is_autocommit() {
        Some(conn.unchecked_transaction().map_err(|e| e.to_string())?)
    } else {
        None
    };
    conn.execute("DELETE FROM produse", [])
        .map_err(|e| e.to_string())?;

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
        conn.execute(
            "INSERT INTO produse (cod, denumire, grupa) VALUES (?1, ?2, ?3)
             ON CONFLICT(cod) DO UPDATE SET denumire = ?2, grupa = ?3",
            params![cod, denumire, grupa],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }

    conn.execute(
        "INSERT OR IGNORE INTO grupe (nume) SELECT DISTINCT grupa FROM produse WHERE grupa != '' AND grupa IS NOT NULL",
        [],
    )
    .map_err(|e| e.to_string())?;

    if count == 0 {
        return Err("fișierul nu conține înregistrări; datele existente au fost păstrate".into());
    }
    if let Some(tx) = tx {
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(count)
}

pub fn import_agenti_file(conn: &Connection, path: &Path) -> Result<usize, String> {
    let range = first_sheet_range(path)?;
    validate_headers(&range, &["client", "agent"])?;
    // Startup seeding already owns a transaction covering both imports.
    let tx = if conn.is_autocommit() {
        Some(conn.unchecked_transaction().map_err(|e| e.to_string())?)
    } else {
        None
    };
    conn.execute("DELETE FROM agenti_clienti", [])
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
        conn.execute(
            "INSERT INTO agenti_clienti (client, agent) VALUES (?1, ?2)
             ON CONFLICT(client) DO UPDATE SET agent = ?2",
            params![client, agent],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }

    conn.execute(
        "INSERT OR IGNORE INTO agenti (nume) SELECT DISTINCT agent FROM agenti_clienti WHERE agent != '' AND agent IS NOT NULL",
        [],
    )
    .map_err(|e| e.to_string())?;

    if count == 0 {
        return Err("fișierul nu conține înregistrări; datele existente au fost păstrate".into());
    }
    if let Some(tx) = tx {
        tx.commit().map_err(|e| e.to_string())?;
    }
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
             CREATE TABLE agenti_clienti (client TEXT PRIMARY KEY, agent TEXT);
             CREATE TABLE grupe (nume TEXT PRIMARY KEY);
             CREATE TABLE agenti (nume TEXT PRIMARY KEY);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn invalid_imports_preserve_existing_data() {
        let conn = setup_db();
        import_produse_file(&conn, &res("Grupa corespunzatoare.xlsx")).unwrap();
        import_agenti_file(&conn, &res("Raport agent.xlsx")).unwrap();
        let before: (i64, i64) = conn
            .query_row(
                "SELECT (SELECT COUNT(*) FROM produse), (SELECT COUNT(*) FROM agenti_clienti)",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert!(import_produse_file(&conn, &res("Raport agent.xlsx")).is_err());
        assert!(import_agenti_file(&conn, &res("Grupa corespunzatoare.xlsx")).is_err());
        for (label, headers) in [
            ("products", vec!["cod", "denumire", "grupa"]),
            ("clients", vec!["Client", "Agent"]),
        ] {
            let path = std::env::temp_dir()
                .join(format!("delta-empty-{label}-{}.xlsx", std::process::id()));
            let mut wb = rust_xlsxwriter::Workbook::new();
            let ws = wb.add_worksheet();
            for (i, header) in headers.iter().enumerate() {
                ws.write_string(0, i as u16, *header).unwrap();
            }
            wb.save(&path).unwrap();
            assert!(if label == "products" {
                import_produse_file(&conn, &path)
            } else {
                import_agenti_file(&conn, &path)
            }
            .is_err());
            std::fs::remove_file(path).unwrap();
        }
        let after = conn
            .query_row(
                "SELECT (SELECT COUNT(*) FROM produse), (SELECT COUNT(*) FROM agenti_clienti)",
                [],
                |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)),
            )
            .unwrap();
        assert_eq!(before, after);
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
