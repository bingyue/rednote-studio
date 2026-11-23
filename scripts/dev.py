import os, signal, subprocess, sys, time, socket
from pathlib import Path

root = Path(__file__).resolve().parents[1]
os.chdir(root)
python = str(root / ".venv/bin/python")
for port in [8010, 5174]:
    with socket.socket() as sock:
        if sock.connect_ex(("127.0.0.1", port)) == 0:
            raise SystemExit(
                f"Port {port} is in use. Existing services were not stopped. See README for alternate port commands."
            )
subprocess.run(
    [python, "-m", "alembic", "-c", "apps/api/alembic.ini", "upgrade", "head"],
    check=True,
)
subprocess.run([python, "scripts/seed_demo.py"], check=True)
children = []


def stop(*_):
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
    raise SystemExit(0)


signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
children.append(
    subprocess.Popen(
        [
            python,
            "-m",
            "uvicorn",
            "studio.main:app",
            "--app-dir",
            "apps/api",
            "--host",
            "127.0.0.1",
            "--port",
            "8010",
            "--reload",
            "--reload-dir",
            "apps/api",
        ]
    )
)
children.append(subprocess.Popen(["npm", "--prefix", "apps/web", "run", "dev"]))
print(
    "\nRedNote Studio → http://127.0.0.1:5174/create\nAPI docs → http://127.0.0.1:8010/docs\n",
    flush=True,
)
try:
    while all(p.poll() is None for p in children):
        time.sleep(0.5)
finally:
    stop()
