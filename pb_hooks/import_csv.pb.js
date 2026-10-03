routerAdd("POST", "/api/import/parse-csv", (e) => {
  // ---- Admin-only guard (server-side) ----
  const auth = e.auth;
  if (!auth || !auth.getBool("active") || auth.getString("role") !== "admin" || !auth.getString("school") || !$app.findRecordById("schools",auth.getString("school")).getBool("active")) {
    return e.json(403, { message: "Only administrators may import data." });
  }

  const MAX_BYTES = 3_000_000; // ~3MB
  const MAX_ROWS = 10000;

  const info = e.requestInfo();
  const body = info.body || {};
  const type = (body.type || "").toString();
  let text = (body.csv || "").toString();

  const validTypes = ["roster", "orders", "combined"];
  if (!validTypes.includes(type)) {
    return e.json(400, { message: "Invalid import type." });
  }
  if (!text || text.trim().length === 0) {
    return e.json(400, { message: "The uploaded file is empty." });
  }
  if (text.length > MAX_BYTES) {
    return e.json(400, { message: "File is too large. Please keep it under 3MB." });
  }

  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  function parseCSV(input) {
    const rows = [];
    let field = "";
    let row = [];
    let i = 0;
    let inQuotes = false;
    const pushField = () => { row.push(field); field = ""; };
    const pushRow = () => { rows.push(row); row = []; };
    while (i < input.length) {
      const c = input[i];
      if (inQuotes) {
        if (c === '"') {
          if (input[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      } else {
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ",") { pushField(); i++; continue; }
        if (c === "\r") { i++; continue; }
        if (c === "\n") { pushField(); pushRow(); i++; continue; }
        field += c; i++; continue;
      }
    }
    pushField();
    pushRow();
    return rows;
  }

  let parsed;
  try {
    parsed = parseCSV(text);
  } catch (err) {
    $app.logger().error("CSV parse failed", "error", String(err));
    return e.json(400, { message: "Could not parse the file as CSV." });
  }

  // Drop fully-empty rows
  const clean = parsed.filter((r) => r.some((c) => (c || "").trim().length > 0));
  if (clean.length < 2) {
    return e.json(400, { message: "The file must contain a header row and at least one data row." });
  }

  const headers = clean[0].map((h) => (h || "").trim());
  if (headers.length < 2 || headers.every((h) => h === "")) {
    return e.json(400, { message: "The file does not appear to have valid column headers." });
  }

  const dataRows = clean.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return e.json(400, { message: "Too many rows. Please import in batches of " + MAX_ROWS + " or fewer." });
  }

  // Normalize each data row to the header length
  const normalized = dataRows.map((r) => {
    const out = [];
    for (let j = 0; j < headers.length; j++) out.push((r[j] || "").trim());
    return out;
  });

  return e.json(200, { headers: headers, rows: normalized, rowCount: normalized.length });
});
