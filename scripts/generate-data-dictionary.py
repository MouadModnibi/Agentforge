"""Document schema metadata only; never read application row contents."""
from pathlib import Path
import sqlite3
import sys

source = Path(sys.argv[1] if len(sys.argv) > 1 else "data/agentforge.db").resolve()
db = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)
lines = ["# m8m data dictionary", "", "Generated from SQLite schema metadata; no row contents or secret values are included.", "", "Times are Unix milliseconds unless noted. IDs are opaque strings. JSON columns store structured application data. owner_id scopes records to users; child records inherit ownership through their parent workflow/agent. Credential encrypted and users.gemini_key are AES-GCM ciphertext. Passwords are scrypt hashes; sessions/API keys store hashes. Back up APP_SECRET separately from the database.", ""]
for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
    quoted = '"' + table.replace('"', '""') + '"'
    lines += ["## " + table, "", "| Column | SQLite type | Required / key | Default |", "|---|---|---|---|"]
    for _, name, kind, required, default, pk in db.execute("PRAGMA table_info(" + quoted + ")"):
        lines.append(f"| {name} | {kind} | {'PK' if pk else 'NOT NULL' if required else 'nullable'} | {str(default or '').replace('|','/')} |")
    for _, _, parent, child_key, parent_key, _, on_delete, _ in db.execute("PRAGMA foreign_key_list(" + quoted + ")"):
        lines.append(f"\nForeign key: {child_key} → {parent}.{parent_key}; delete: {on_delete}.")
    lines.append("")
db.close()
Path("docs/data-dictionary.md").write_text("\n".join(lines), encoding="utf-8")
print("Data dictionary generated from schema metadata.")
