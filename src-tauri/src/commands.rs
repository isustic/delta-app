use crate::report::{self, Report};
use crate::xlsx;
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Serialize)]
pub struct Stats {
    pub produse: usize,
    pub agenti_clienti: usize,
    pub agenti_distinct: usize,
    pub seed_version: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Produs {
    pub cod: String,
    pub denumire: String,
    pub grupa: String,
    /// Momentul adăugării prin butonul „Adaugă produse lipsă" (badge „NOU").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adaugat_la: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct AgentClient {
    pub client: String,
    pub agent: String,
}

fn count(conn: &rusqlite::Connection, sql: &str) -> Result<usize, String> {
    conn.query_row(sql, [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(state: State<AppState>) -> Result<Stats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = &db.conn;
    let seed_version: Option<String> = conn
        .query_row(
            "SELECT valoare FROM meta WHERE cheie = 'seed_version'",
            [],
            |r| r.get(0),
        )
        .ok();
    Ok(Stats {
        produse: count(conn, "SELECT COUNT(*) FROM produse")?,
        agenti_clienti: count(conn, "SELECT COUNT(*) FROM agenti_clienti")?,
        agenti_distinct: count(conn, "SELECT COUNT(DISTINCT agent) FROM agenti_clienti")?,
        seed_version,
    })
}

/// Construiește marcaje SQL pentru un filtru IN, începând de la `start`.
/// Rezultatul este `vec![]` dacă lista e goală (filtru inactiv).
fn in_marks(values: &[String], start: usize) -> Vec<String> {
    values
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", start + i))
        .collect()
}

/// Sortare + filtre pe coloane pentru lista de produse.
/// `sort_by` folosește convenția "-col" pentru descendent (ex: "-denumire").
/// Filtrele `cod`/`denumire`/`grupa` acceptă mai multe valori (lista goală = fără filtru).
#[tauri::command]
pub fn get_produse(
    state: State<AppState>,
    search: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    sort_by: Option<String>,
    cod: Option<Vec<String>>,
    denumire: Option<Vec<String>>,
    grupa: Option<Vec<String>>,
) -> Result<Vec<Produs>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let search = search.unwrap_or_default();
    let limit = limit.unwrap_or(50).clamp(1, 5000);
    let offset = offset.unwrap_or(0).max(0);
    let cod = cod.unwrap_or_default();
    let denumire = denumire.unwrap_or_default();
    let grupa = grupa.unwrap_or_default();

    // Whitelist: numai coloane reale, fără injecție SQL.
    let (col, dir) = match sort_by.as_deref().unwrap_or("cod") {
        "cod" => ("cod", ""),
        "denumire" => ("denumire", ""),
        "grupa" => ("grupa", ""),
        "-cod" => ("cod", " DESC"),
        "-denumire" => ("denumire", " DESC"),
        "-grupa" => ("grupa", " DESC"),
        _ => ("cod", ""),
    };

    // Marcajele ?N trebuie să fie secvențiale: ?1 = search, apoi valorile
    // filtrelor în ordinea cod → denumire → grupa, apoi limit și offset.
    let marks_cod = in_marks(&cod, 2);
    let marks_denumire = in_marks(&denumire, 2 + cod.len());
    let marks_grupa = in_marks(&grupa, 2 + cod.len() + denumire.len());
    let limit_mark = 2 + cod.len() + denumire.len() + grupa.len();
    let offset_mark = limit_mark + 1;

    // Fiecare filtru devine „IN (…)”; lista goală înseamnă fără filtrare.
    let cod_sql = if marks_cod.is_empty() {
        "1 = 1".to_string()
    } else {
        format!("cod IN ({})", marks_cod.join(", "))
    };
    let denumire_sql = if marks_denumire.is_empty() {
        "1 = 1".to_string()
    } else {
        format!("denumire IN ({})", marks_denumire.join(", "))
    };
    let grupa_sql = if marks_grupa.is_empty() {
        "1 = 1".to_string()
    } else {
        format!("grupa IN ({})", marks_grupa.join(", "))
    };

    let sql = format!(
        "SELECT cod, denumire, grupa, adaugat_la FROM produse
         WHERE (?1 = '' OR cod LIKE '%' || ?1 || '%' OR denumire LIKE '%' || ?1 || '%' OR grupa LIKE '%' || ?1 || '%')
           AND ({cod_sql})
           AND ({denumire_sql})
           AND ({grupa_sql})
         ORDER BY {col} COLLATE NOCASE{dir}, cod COLLATE NOCASE
         LIMIT ?{limit_mark} OFFSET ?{offset_mark}"
    );

    let mut params: Vec<&dyn rusqlite::ToSql> = vec![&search];
    for v in cod.iter().chain(denumire.iter()).chain(grupa.iter()) {
        params.push(v);
    }
    params.push(&limit);
    params.push(&offset);

    let mut stmt = db.conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params.as_slice(), |r| {
            Ok(Produs {
                cod: r.get(0)?,
                denumire: r.get(1)?,
                grupa: r.get(2)?,
                adaugat_la: r.get(3).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Valorile distincte (nevide) ale unei coloane de produse, pentru filtre.
#[tauri::command]
pub fn get_produse_coloana(
    state: State<AppState>,
    coloana: String,
    search: Option<String>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    // Whitelist de coloane reale.
    let col = match coloana.as_str() {
        "cod" => "cod",
        "denumire" => "denumire",
        "grupa" => "grupa",
        _ => return Err("coloană necunoscută".into()),
    };
    let search = search.unwrap_or_default();
    let sql = format!(
        "SELECT DISTINCT {col} FROM produse
         WHERE {col} != '' AND (?1 = '' OR {col} LIKE '%' || ?1 || '%')
         ORDER BY {col} COLLATE NOCASE"
    );
    let mut stmt = db.conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_produs(state: State<AppState>, cod: String) -> Result<Produs, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .query_row(
            "SELECT cod, denumire, grupa, adaugat_la FROM produse WHERE cod = ?1",
            params![cod],
            |r| {
                Ok(Produs {
                    cod: r.get(0)?,
                    denumire: r.get(1)?,
                    grupa: r.get(2)?,
                    adaugat_la: r.get(3).ok(),
                })
            },
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_grupe(state: State<AppState>, search: Option<String>) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let search = search.unwrap_or_default();
    let mut stmt = db
        .conn
        .prepare(
            "SELECT DISTINCT grupa FROM produse
             WHERE grupa != '' AND (?1 = '' OR grupa LIKE '%' || ?1 || '%')
             ORDER BY grupa",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_agenti_distinct(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let search = search.unwrap_or_default();
    let mut stmt = db
        .conn
        .prepare(
            "SELECT DISTINCT agent FROM agenti_clienti
             WHERE agent != '' AND (?1 = '' OR agent LIKE '%' || ?1 || '%')
             ORDER BY agent",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Sortare + filtre pe coloane pentru lista de clienți.
/// `sort_by` folosește convenția "-col" pentru descendent.
/// Filtrele `client`/`agent` acceptă mai multe valori (lista goală = fără filtru).
#[tauri::command]
pub fn get_agenti(
    state: State<AppState>,
    search: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    sort_by: Option<String>,
    client: Option<Vec<String>>,
    agent: Option<Vec<String>>,
) -> Result<Vec<AgentClient>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let search = search.unwrap_or_default();
    let limit = limit.unwrap_or(50).clamp(1, 5000);
    let offset = offset.unwrap_or(0).max(0);
    let client = client.unwrap_or_default();
    let agent = agent.unwrap_or_default();

    let (col, dir) = match sort_by.as_deref().unwrap_or("client") {
        "client" => ("client", ""),
        "agent" => ("agent", ""),
        "-client" => ("client", " DESC"),
        "-agent" => ("agent", " DESC"),
        _ => ("client", ""),
    };

    // ?1 = search, apoi valorile filtrelor (client → agent), apoi limit și offset.
    let marks_client = in_marks(&client, 2);
    let marks_agent = in_marks(&agent, 2 + client.len());
    let limit_mark = 2 + client.len() + agent.len();
    let offset_mark = limit_mark + 1;

    let client_sql = if marks_client.is_empty() {
        "1 = 1".to_string()
    } else {
        format!("client IN ({})", marks_client.join(", "))
    };
    let agent_sql = if marks_agent.is_empty() {
        "1 = 1".to_string()
    } else {
        format!("agent IN ({})", marks_agent.join(", "))
    };

    let sql = format!(
        "SELECT client, agent FROM agenti_clienti
         WHERE (?1 = '' OR client LIKE '%' || ?1 || '%' OR agent LIKE '%' || ?1 || '%')
           AND ({client_sql})
           AND ({agent_sql})
         ORDER BY {col} COLLATE NOCASE{dir}, client COLLATE NOCASE
         LIMIT ?{limit_mark} OFFSET ?{offset_mark}"
    );

    let mut params: Vec<&dyn rusqlite::ToSql> = vec![&search];
    for v in client.iter().chain(agent.iter()) {
        params.push(v);
    }
    params.push(&limit);
    params.push(&offset);

    let mut stmt = db.conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params.as_slice(), |r| {
            Ok(AgentClient {
                client: r.get(0)?,
                agent: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Valorile distincte (nevide) ale unei coloane de clienți, pentru filtre.
#[tauri::command]
pub fn get_agenti_coloana(
    state: State<AppState>,
    coloana: String,
    search: Option<String>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let col = match coloana.as_str() {
        "client" => "client",
        "agent" => "agent",
        _ => return Err("coloană necunoscută".into()),
    };
    let search = search.unwrap_or_default();
    let sql = format!(
        "SELECT DISTINCT {col} FROM agenti_clienti
         WHERE {col} != '' AND (?1 = '' OR {col} LIKE '%' || ?1 || '%')
         ORDER BY {col} COLLATE NOCASE"
    );
    let mut stmt = db.conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_produse(state: State<AppState>, path: String) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    xlsx::import_produse_file(&db.conn, Path::new(&path))
}

#[tauri::command]
pub fn import_agenti(state: State<AppState>, path: String) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    xlsx::import_agenti_file(&db.conn, Path::new(&path))
}

fn export_produse_rows(conn: &rusqlite::Connection) -> Result<Vec<Produs>, String> {
    let mut stmt = conn
        .prepare("SELECT cod, denumire, grupa FROM produse ORDER BY cod")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Produs {
                cod: r.get(0)?,
                denumire: r.get(1)?,
                grupa: r.get(2)?,
                adaugat_la: None,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn export_agenti_rows(conn: &rusqlite::Connection) -> Result<Vec<AgentClient>, String> {
    let mut stmt = conn
        .prepare("SELECT client, agent FROM agenti_clienti ORDER BY agent, client")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(AgentClient {
                client: r.get(0)?,
                agent: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_produse(
    state: State<AppState>,
    dest: String,
    format: String,
    rows: Option<Vec<Produs>>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rows = match rows {
        Some(rows) => rows,
        None => export_produse_rows(&db.conn)?,
    };
    crate::export::export_produse(&rows, Path::new(&dest), &format)
}

#[tauri::command]
pub fn export_agenti(
    state: State<AppState>,
    dest: String,
    format: String,
    rows: Option<Vec<AgentClient>>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rows = match rows {
        Some(rows) => rows,
        None => export_agenti_rows(&db.conn)?,
    };
    crate::export::export_agenti(&rows, Path::new(&dest), &format)
}

#[tauri::command]
pub fn adauga_produs(
    state: State<AppState>,
    cod: String,
    denumire: String,
    grupa: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute(
            "INSERT INTO produse (cod, denumire, grupa) VALUES (?1, ?2, ?3)
             ON CONFLICT(cod) DO UPDATE SET denumire = ?2, grupa = ?3",
            params![cod, denumire, grupa],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Produsele din fișierele Excel care nu există încă în baza de date.
#[tauri::command]
pub fn get_produse_lipsa(
    state: State<AppState>,
    path1: String,
    path2: String,
) -> Result<Vec<Produs>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let produse = report::load_produse(&db.conn)?;
    let mut missing: HashMap<String, (String, String)> = HashMap::new();
    report::collect_missing(Path::new(&path1), &produse, &mut missing)?;
    report::collect_missing(Path::new(&path2), &produse, &mut missing)?;

    let mut list: Vec<Produs> = missing
        .into_iter()
        .map(|(cod, (denumire, grupa))| Produs {
            cod,
            denumire,
            grupa,
            adaugat_la: None,
        })
        .collect();
    list.sort_by(|a, b| a.cod.cmp(&b.cod));
    Ok(list)
}

/// Adaugă toate produsele primite în baza de date, marcându-le cu
/// `adaugat_la` (badge „NOU"). Readaugarea unui produs existent
/// îi actualizează denumirea/grupa și reîmprospătează marca.
#[tauri::command]
pub fn adauga_produse_lipsa(
    state: State<AppState>,
    produse: Vec<Produs>,
    year: String,
) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    // Anul vine din UI ca text liber — validăm strict 4 cifre ca să nu
    // persistăm un timestamp malformat în `adaugat_la`.
    if year.len() != 4 || !year.chars().all(|c| c.is_ascii_digit()) {
        return Err("anul trebuie să aibă exact 4 cifre".into());
    }
    let ts = format!("{year}-01-01T00:00:00");
    let tx = db.conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut count = 0usize;
    for p in &produse {
        if p.cod.trim().is_empty() || p.denumire.trim().is_empty() {
            continue;
        }
        count += db
            .conn
            .execute(
                "INSERT INTO produse (cod, denumire, grupa, adaugat_la) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(cod) DO UPDATE SET
                   denumire = excluded.denumire,
                   grupa = excluded.grupa,
                   adaugat_la = excluded.adaugat_la",
                params![p.cod.trim(), p.denumire.trim(), p.grupa.trim(), ts],
            )
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

/// Filtrează o listă de produse, păstrând doar cele care nu există deja în
/// baza de date. Folosit când „Adaugă produse lipsă" este deschis dintr-un
/// raport din istoric, ca să nu se propună produse deja adăugate.
#[tauri::command]
pub fn filtreaza_produse_lipsa(
    state: State<AppState>,
    produse: Vec<Produs>,
) -> Result<Vec<Produs>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for p in produse {
        if p.cod.trim().is_empty() {
            continue;
        }
        let exists: bool = db
            .conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM produse WHERE cod = ?1)",
                params![p.cod.trim()],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            out.push(p);
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn update_produs(
    state: State<AppState>,
    cod: String,
    denumire: String,
    grupa: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute(
            "UPDATE produse SET denumire = ?2, grupa = ?3 WHERE cod = ?1",
            params![cod, denumire, grupa],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_produs(state: State<AppState>, cod: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute("DELETE FROM produse WHERE cod = ?1", params![cod])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_all_produse(state: State<AppState>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute("DELETE FROM produse", [])
        .map_err(|e| e.to_string())
}

/// Șterge produsele selectate (după cod).
#[tauri::command]
pub fn delete_produse(state: State<AppState>, coduri: Vec<String>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut n = 0usize;
    for cod in coduri {
        n += db
            .conn
            .execute("DELETE FROM produse WHERE cod = ?1", params![cod])
            .map_err(|e| e.to_string())?;
    }
    Ok(n)
}

#[tauri::command]
pub fn adauga_agent(
    state: State<AppState>,
    client: String,
    agent: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute(
            "INSERT INTO agenti_clienti (client, agent) VALUES (?1, ?2)
             ON CONFLICT(client) DO UPDATE SET agent = ?2",
            params![client, agent],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_agent(state: State<AppState>, client: String, agent: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute(
            "UPDATE agenti_clienti SET agent = ?2 WHERE client = ?1",
            params![client, agent],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_agent(state: State<AppState>, client: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute(
            "DELETE FROM agenti_clienti WHERE client = ?1",
            params![client],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_all_agenti(state: State<AppState>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute("DELETE FROM agenti_clienti", [])
        .map_err(|e| e.to_string())
}

/// Șterge clienții selectați (după client).
#[tauri::command]
pub fn delete_agenti(state: State<AppState>, clienti: Vec<String>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut n = 0usize;
    for client in clienti {
        n += db
            .conn
            .execute("DELETE FROM agenti_clienti WHERE client = ?1", params![client])
            .map_err(|e| e.to_string())?;
    }
    Ok(n)
}

#[tauri::command]
pub async fn genereaza_raport(
    state: State<'_, AppState>,
    path1: String,
    path2: String,
    an1: String,
    an2: String,
) -> Result<Report, String> {
    let (produse, agenti) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        (
            report::load_produse(&db.conn)?,
            report::load_agenti(&db.conn)?,
        )
    };
    let p1 = PathBuf::from(path1);
    let p2 = PathBuf::from(path2);
    tauri::async_runtime::spawn_blocking(move || {
        report::build_report_with(produse, agenti, &p1, &p2, an1, an2)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn export_raport_data(report: Report, dest: String) -> Result<(), String> {
    let dest_path = PathBuf::from(dest);
    tauri::async_runtime::spawn_blocking(move || {
        crate::export::export_report(&report, &dest_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct RaportSalvat {
    pub id: i64,
    pub an1: String,
    pub an2: String,
    pub fisier1: String,
    pub fisier2: String,
    pub nr_clienti: i64,
    pub nr_agenti: i64,
    pub creat_la: String,
}

#[tauri::command]
pub fn salveaza_raport(
    state: State<AppState>,
    report: Report,
    fisier1: String,
    fisier2: String,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let date = serde_json::to_string(&report).map_err(|e| e.to_string())?;
    let nr_clienti = report.clienti.len() as i64;
    let nr_agenti = report.sumar.len() as i64;
    db.conn
        .execute(
            "INSERT INTO rapoarte_salvate
                (an1, an2, fisier1, fisier2, nr_clienti, nr_agenti, creat_la, date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now', 'localtime'), ?7)",
            params![
                report.an1,
                report.an2,
                fisier1,
                fisier2,
                nr_clienti,
                nr_agenti,
                date
            ],
        )
        .map_err(|e| e.to_string())?;
    Ok(db.conn.last_insert_rowid())
}

#[tauri::command]
pub fn lista_rapoarte(state: State<AppState>) -> Result<Vec<RaportSalvat>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .conn
        .prepare(
            "SELECT id, an1, an2, fisier1, fisier2, nr_clienti, nr_agenti, creat_la
             FROM rapoarte_salvate ORDER BY id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(RaportSalvat {
                id: r.get(0)?,
                an1: r.get(1)?,
                an2: r.get(2)?,
                fisier1: r.get(3)?,
                fisier2: r.get(4)?,
                nr_clienti: r.get(5)?,
                nr_agenti: r.get(6)?,
                creat_la: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn incarca_raport(state: State<'_, AppState>, id: i64) -> Result<Report, String> {
    let date: String = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.conn
            .query_row(
                "SELECT date FROM rapoarte_salvate WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?
    };
    let mut report: Report = tauri::async_runtime::spawn_blocking(move || {
        serde_json::from_str(&date).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let produse = report::load_produse(&db.conn)?;
    report
        .neconcordante
        .retain(|m| m.lipsa_bd || produse.contains_key(&m.cod));
    Ok(report)
}

#[tauri::command]
pub fn sterge_raport(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn
        .execute("DELETE FROM rapoarte_salvate WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
