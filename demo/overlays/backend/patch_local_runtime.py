"""One-off local overlay for isolation tests. Host production files are never written."""
from pathlib import Path
import sys

app = Path(sys.argv[1])
data = Path(sys.argv[2]).resolve().as_posix()

db = app / "database.py"
main = app / "main.py"

text = db.read_text(encoding="utf-8")
old = 'os.path.join(os.path.dirname(__file__), "..", "properties_data", "properties.db")'
new = f'os.path.join(r"{data}", "properties.db")'
if old not in text:
    raise SystemExit("database.py snippet missing")
db.write_text(text.replace(old, new, 1), encoding="utf-8")

text = main.read_text(encoding="utf-8")

old = "app.include_router(contract_history_controller.router)\n"
new = (
    old
    + "from controllers import demo_reset_controller\n"
    + "app.include_router(demo_reset_controller.router)\n"
)
if old not in text:
    raise SystemExit("main.py router snippet missing")
text = text.replace(old, new, 1)

old = """        try:
            user_service.ensure_admin_from_env(db)
        except Exception as e:
            print(f"[seed] ERROR creating admin: {e}", flush=True)
"""
new = old + """        try:
            from seed_demo import seed_if_empty
            seed_if_empty(db)
        except Exception as e:
            print(f"[demo-seed] ERROR: {e}", flush=True)
"""
if old not in text:
    raise SystemExit("main.py seed snippet missing")
text = text.replace(old, new, 1)
main.write_text(text, encoding="utf-8")
print("OVERLAY_OK")
