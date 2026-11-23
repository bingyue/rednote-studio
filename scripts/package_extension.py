from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
out = root / "apps/extension/rednote-extension.zip"
with ZipFile(out, "w", ZIP_DEFLATED) as z:
    for p in (root / "apps/extension").iterdir():
        if p.suffix in [".json", ".html", ".css", ".js"]:
            z.write(p, p.name)
print(out)
