use crate::commands::{AgentClient, Produs};
use crate::report::{RandClient, Report};
use rust_xlsxwriter::{Format, FormatAlign, FormatBorder, Workbook, Worksheet, XlsxError};
use std::io::Write;
use std::path::Path;

#[derive(Clone)]
struct Fmts {
    header: Format,
    sub: Format,
    label: Format,
    num: Format,
    diff: Format,
}

fn fmts() -> Fmts {
    let header = Format::new()
        .set_bold()
        .set_font_color(0xFFFFFF)
        .set_background_color(0x1F2937)
        .set_border(FormatBorder::Thin)
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter);
    let sub = Format::new()
        .set_bold()
        .set_background_color(0xE5E7EB)
        .set_border(FormatBorder::Thin)
        .set_align(FormatAlign::Center);
    let label = Format::new()
        .set_border(FormatBorder::Thin)
        .set_align(FormatAlign::VerticalCenter);
    let num = Format::new()
        .set_num_format("#,##0.00")
        .set_border(FormatBorder::Thin);
    let diff = Format::new()
        .set_num_format("#,##0.00;[Red]-#,##0.00")
        .set_border(FormatBorder::Thin);
    Fmts {
        header,
        sub,
        label,
        num,
        diff,
    }
}

fn sanitize_sheet_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '[' | ']' | ':' | '*' | '?' | '/' | '\\' => ' ',
            c => c,
        })
        .collect();
    let mut s = cleaned.trim().to_string();
    if s.is_empty() {
        s = "Sheet".to_string();
    }
    s.chars().take(31).collect()
}

struct MRow {
    lead: Vec<String>,
    vals: Vec<(f64, f64)>,
    nou: bool,
}

fn write_matrix(
    ws: &mut Worksheet,
    lead_headers: &[&str],
    rows: &[MRow],
    columns: &[String],
    an1: &str,
    an2: &str,
    f: &Fmts,
) -> Result<(), XlsxError> {
    let nlead = lead_headers.len() as u16;

    for (j, h) in lead_headers.iter().enumerate() {
        ws.merge_range(0, j as u16, 1, j as u16, h, &f.header)?;
    }
    for (k, name) in columns.iter().enumerate() {
        let c0 = nlead + (k as u16) * 3;
        ws.merge_range(0, c0, 0, c0 + 2, name.as_str(), &f.header)?;
        ws.write_string_with_format(1, c0, an1, &f.sub)?;
        ws.write_string_with_format(1, c0 + 1, an2, &f.sub)?;
        ws.write_string_with_format(1, c0 + 2, "Diferență", &f.sub)?;
    }

    for (ri, row) in rows.iter().enumerate() {
        let r = ri as u32 + 2;
        for (j, val) in row.lead.iter().enumerate() {
            let cell = if j == 0 && row.nou {
                format!("{val} (NOU)")
            } else {
                val.clone()
            };
            ws.write_string_with_format(r, j as u16, &cell, &f.label)?;
        }
        for (k, (v1, v2)) in row.vals.iter().enumerate() {
            let c0 = nlead + (k as u16) * 3;
            ws.write_number_with_format(r, c0, *v1, &f.num)?;
            ws.write_number_with_format(r, c0 + 1, *v2, &f.num)?;
            ws.write_number_with_format(r, c0 + 2, v2 - v1, &f.diff)?;
        }
    }

    for j in 0..nlead {
        ws.set_column_width(j, if j == 0 { 42.0 } else { 22.0 })?;
    }
    for k in 0..columns.len() as u16 {
        let c0 = nlead + k * 3;
        ws.set_column_width(c0, 12.0)?;
        ws.set_column_width(c0 + 1, 12.0)?;
        ws.set_column_width(c0 + 2, 12.0)?;
    }
    ws.set_row_height(0, 22.0)?;

    Ok(())
}

fn client_rows<'a>(clients: impl Iterator<Item = &'a RandClient>) -> Vec<MRow> {
    clients
        .map(|c| MRow {
            lead: vec![c.client.clone(), c.agent.clone()],
            vals: c.valori.clone(),
            nou: c.nou,
        })
        .collect()
}

pub fn export_report(report: &Report, dest: &Path) -> Result<(), String> {
    let mut wb = Workbook::new();
    let f = fmts();
    let an1 = report.an1.clone();
    let an2 = report.an2.clone();

    // SUMAR
    {
        let ws = wb
            .add_worksheet()
            .set_name("SUMAR")
            .map_err(|e| e.to_string())?;
        let rows: Vec<MRow> = report
            .sumar
            .iter()
            .map(|s| MRow {
                lead: vec![s.agent.clone()],
                vals: s.valori.clone(),
                nou: false,
            })
            .collect();
        write_matrix(ws, &["Agent"], &rows, &report.coloane, &an1, &an2, &f)
            .map_err(|e| e.to_string())?;
    }

    // Total: {an2} vs {an1}
    let total_name = sanitize_sheet_name(&format!("{} vs {}", an2, an1));
    {
        let ws = wb
            .add_worksheet()
            .set_name(&total_name)
            .map_err(|e| e.to_string())?;
        let rows = client_rows(report.clienti.iter());
        write_matrix(ws, &["Client", "Agent"], &rows, &report.coloane, &an1, &an2, &f)
            .map_err(|e| e.to_string())?;
    }

    // Per agent
    let mut used: Vec<String> = vec!["SUMAR".to_string(), total_name];
    for agent in &report.agenti {
        let mut name = sanitize_sheet_name(agent);
        let mut suffix = 2;
        while used.contains(&name) {
            name = sanitize_sheet_name(&format!("{} {}", agent, suffix));
            suffix += 1;
        }
        used.push(name.clone());
        let ws = wb.add_worksheet().set_name(&name).map_err(|e| e.to_string())?;
        let rows = client_rows(report.clienti.iter().filter(|c| c.agent == *agent));
        write_matrix(ws, &["Client", "Agent"], &rows, &report.coloane, &an1, &an2, &f)
            .map_err(|e| e.to_string())?;
    }

    wb.save(dest).map_err(|e| format!("salvare xlsx: {e}"))?;
    Ok(())
}

fn export_rows_csv(
    dest: &Path,
    headers: &[&str],
    rows: impl Iterator<Item = Vec<String>>,
) -> Result<(), String> {
    let mut out =
        std::fs::File::create(dest).map_err(|e| format!("creare fișier: {e}"))?;

    let mut write_line = |line: &str| -> Result<(), String> {
        out.write_all(line.as_bytes())
            .map_err(|e| format!("scriere fișier: {e}"))
    };

    let header = headers
        .iter()
        .map(|h| format!("\"{}\"", h.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(",");
    write_line(&header)?;
    write_line("\n")?;

    for row in rows {
        let line = row
            .iter()
            .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(",");
        write_line(&line)?;
        write_line("\n")?;
    }
    Ok(())
}

fn export_rows_xlsx(
    dest: &Path,
    headers: &[&str],
    rows: impl Iterator<Item = Vec<String>>,
) -> Result<(), String> {
    let mut wb = Workbook::new();
    let ws = wb
        .add_worksheet()
        .set_name("Date")
        .map_err(|e| e.to_string())?;
    let header = Format::new()
        .set_bold()
        .set_font_color(0xFFFFFF)
        .set_background_color(0x1F2937)
        .set_border(FormatBorder::Thin)
        .set_align(FormatAlign::Center);
    for (j, h) in headers.iter().enumerate() {
        ws.write_string_with_format(0, j as u16, *h, &header)
            .map_err(|e| e.to_string())?;
        ws.set_column_width(j as u16, 28.0)
            .map_err(|e| e.to_string())?;
    }
    for (i, row) in rows.enumerate() {
        for (j, c) in row.iter().enumerate() {
            ws.write_string(i as u32 + 1, j as u16, c.as_str())
                .map_err(|e| e.to_string())?;
        }
    }
    wb.save(dest).map_err(|e| format!("salvare xlsx: {e}"))?;
    Ok(())
}

fn export_rows(
    dest: &Path,
    format: &str,
    headers: &[&str],
    rows: Vec<Vec<String>>,
) -> Result<(), String> {
    match format {
        "csv" => export_rows_csv(dest, headers, rows.into_iter()),
        "xlsx" => export_rows_xlsx(dest, headers, rows.into_iter()),
        other => Err(format!("format necunoscut: {other}")),
    }
}

pub fn export_produse(rows: &[Produs], dest: &Path, format: &str) -> Result<(), String> {
    export_rows(
        dest,
        format,
        &["cod", "denumire", "grupa"],
        rows.iter()
            .map(|p| vec![p.cod.clone(), p.denumire.clone(), p.grupa.clone()])
            .collect(),
    )
}

pub fn export_agenti(rows: &[AgentClient], dest: &Path, format: &str) -> Result<(), String> {
    export_rows(
        dest,
        format,
        &["client", "agent"],
        rows.iter()
            .map(|a| vec![a.client.clone(), a.agent.clone()])
            .collect(),
    )
}
