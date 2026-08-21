"""Apply DEMO-only patches inside the Docker image. Never run this against host production files."""
from pathlib import Path

ROOT = Path("/app")
MAIN = ROOT / "main.py"
DATABASE = ROOT / "database.py"


def must_replace(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Overlay failed: expected snippet not found in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def main() -> None:
    must_replace(
        DATABASE,
        'os.path.join(os.path.dirname(__file__), "..", "properties_data", "properties.db")',
        'os.path.join("/app", "properties_data", "properties.db")',
    )
    must_replace(
        MAIN,
        "app.include_router(contract_history_controller.router)\n",
        "app.include_router(contract_history_controller.router)\n"
        "from controllers import demo_reset_controller\n"
        "app.include_router(demo_reset_controller.router)\n",
    )
    must_replace(
        MAIN,
        """        try:
            user_service.ensure_admin_from_env(db)
        except Exception as e:
            print(f"[seed] ERROR creating admin: {e}")
""",
        """        try:
            user_service.ensure_admin_from_env(db)
        except Exception as e:
            print(f"[seed] ERROR creating admin: {e}")
        try:
            from seed_demo import seed_if_empty
            seed_if_empty(db)
        except Exception as e:
            print(f"[demo-seed] ERROR: {e}")
""",
    )
    print("[demo-overlay] Applied DEMO patches inside the image")


if __name__ == "__main__":
    main()
