import sys, shutil, socket, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
print("Project:", root)
print("Python:", sys.version.split()[0], "(requires 3.12+)")
for name in ["node", "npm", "uv", "docker"]:
    print(name + ":", shutil.which(name) or "not installed (uv/docker optional)")
for port in [5174, 8010]:
    with socket.socket() as s:
        print(
            f"Port {port}:",
            "in use (may be an already-running Studio)"
            if s.connect_ex(("127.0.0.1", port)) == 0
            else "available",
        )
print("Demo mode needs no API key or platform login.")
if sys.version_info < (3, 12):
    raise SystemExit("Please use Python 3.12 or newer")
