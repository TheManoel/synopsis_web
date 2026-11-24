#!/usr/bin/env python3
"""Linter de la memoria persistente de Claude (`.claude/memory/`).

Existe porque el cold start de una sesión se paga en tokens: `MEMORY.md` se carga
entero SIEMPRE, y cada memoria que haya que abrir cuesta ~250 tok/KB. En julio de
2026 la memoria se había degradado hasta un cold start de ~38k tokens (índice de
18 KB, ficheros de 38 KB, 55% de los wikilinks rotos). Este script fija las
invariantes de [[project_memory_overhaul]] para que no vuelva a pasar.

Invariantes verificadas
-----------------------
ERROR (rompe el contrato de la memoria):
  * frontmatter presente y parseable
  * `name` == nombre del fichero sin `.md`  (si no, los `[[enlaces]]` no resuelven)
  * `description` no vacía            (es lo que decide si la memoria se recupera)
  * `metadata.type` en {project, feedback, reference, research}
  * todo `[[enlace]]` apunta a una memoria existente
  * toda memoria aparece en `MEMORY.md`, y todo enlace de `MEMORY.md` existe

WARN (presupuesto de tokens y legibilidad):
  * memoria > MAX_MEMORY_KB
  * `MEMORY.md` > MAX_INDEX_KB
  * falta la cabecera de estado (`**Estado**` / `**Leer si**`)
  * entradas duplicadas en el índice

Uso
---
    python scripts/memory_lint.py            # informe; exit 1 si hay errores
    python scripts/memory_lint.py --quiet    # solo problemas
    python scripts/memory_lint.py --warn-only  # nunca falla (para el hook Stop)
    python scripts/memory_lint.py --json

Stdlib-only a propósito: lo invoca un hook y un monitor jamás debe romper lo que
monitoriza (misma regla que `scripts/log_session_efficiency.py`).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

MEMORY_DIR = Path(__file__).resolve().parent.parent / ".claude" / "memory"
INDEX_NAME = "MEMORY.md"

# 12 KB ≈ 3k tokens: lo que cuesta abrir una memoria de dominio a propósito.
# El coste real del cold start no eran estos ficheros sino el índice (que se carga
# siempre) y los diarios de 25-38 KB; partir más un dominio empeora la navegación.
MAX_MEMORY_KB = 12
MAX_INDEX_KB = 6
VALID_TYPES = {"project", "feedback", "reference", "research"}

WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
INDEX_LINK_RE = re.compile(r"\]\(([A-Za-z0-9_\-]+)\.md\)")


class Report:
    def __init__(self) -> None:
        self.errors: list[tuple[str, str]] = []
        self.warnings: list[tuple[str, str]] = []

    def error(self, where: str, msg: str) -> None:
        self.errors.append((where, msg))

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append((where, msg))


def parse_frontmatter(text: str) -> dict | None:
    """Mini-parser del frontmatter YAML plano que usan las memorias.

    Solo soporta `clave: valor` y un nivel de anidamiento por indentación, que es
    todo lo que el formato necesita. Devuelve None si no hay frontmatter.
    """
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    block = text[3:end]
    data: dict = {}
    current_parent: str | None = None
    for raw in block.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indented = raw[:1].isspace()
        if ":" not in raw:
            continue
        key, _, value = raw.partition(":")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if indented and current_parent:
            data.setdefault(current_parent, {})
            if isinstance(data[current_parent], dict):
                data[current_parent][key] = value
        else:
            if value == "":
                data[key] = {}
                current_parent = key
            else:
                data[key] = value
                current_parent = None
    return data


def lint(memory_dir: Path) -> tuple[Report, dict]:
    rep = Report()
    index_path = memory_dir / INDEX_NAME
    files = sorted(p for p in memory_dir.glob("*.md") if p.name != INDEX_NAME)
    stems = {p.stem for p in files}

    stats = {
        "memories": len(files),
        "total_kb": round(sum(p.stat().st_size for p in files) / 1024, 1),
        "index_kb": round(index_path.stat().st_size / 1024, 1) if index_path.exists() else 0.0,
        "oversized": [],
        "types": {},
    }

    # --- índice -------------------------------------------------------------
    if not index_path.exists():
        rep.error(INDEX_NAME, "no existe el índice")
        indexed: list[str] = []
    else:
        index_text = index_path.read_text(encoding="utf-8")
        indexed = INDEX_LINK_RE.findall(index_text)
        if stats["index_kb"] > MAX_INDEX_KB:
            rep.warn(
                INDEX_NAME,
                f"{stats['index_kb']} KB > {MAX_INDEX_KB} KB — se carga en CADA sesión; "
                "mover contenido a las memorias y dejar solo el gancho",
            )
        seen: set[str] = set()
        for stem in indexed:
            if stem in seen:
                rep.warn(INDEX_NAME, f"entrada duplicada: {stem}.md")
            seen.add(stem)
            if stem not in stems:
                rep.error(INDEX_NAME, f"apunta a una memoria inexistente: {stem}.md")
        for stem in sorted(stems - seen):
            rep.error(INDEX_NAME, f"memoria sin entrada en el índice: {stem}.md")

    # --- memorias -----------------------------------------------------------
    for path in files:
        text = path.read_text(encoding="utf-8")
        where = path.name
        size_kb = round(path.stat().st_size / 1024, 1)

        fm = parse_frontmatter(text)
        if fm is None:
            rep.error(where, "sin frontmatter parseable")
            continue

        name = fm.get("name", "")
        if name != path.stem:
            rep.error(
                where,
                f"name='{name}' != nombre de fichero '{path.stem}' — los [[enlaces]] no resolverán",
            )
        if not fm.get("description"):
            rep.error(where, "sin `description` (es lo que decide si la memoria se recupera)")

        meta = fm.get("metadata") or {}
        mtype = meta.get("type") if isinstance(meta, dict) else None
        if mtype not in VALID_TYPES:
            rep.error(where, f"metadata.type inválido o ausente: {mtype!r}")
        else:
            stats["types"][mtype] = stats["types"].get(mtype, 0) + 1

        if size_kb > MAX_MEMORY_KB:
            stats["oversized"].append((where, size_kb))
            rep.warn(
                where,
                f"{size_kb} KB > {MAX_MEMORY_KB} KB — destilar y archivar el histórico "
                "en docs/memory_archive/",
            )

        body = text[text.find("\n---", 3) + 4 :]
        head = body[:1200]
        if "**Estado**" not in head:
            rep.warn(where, "falta `- **Estado**:` en la cabecera")
        if "**Leer si**" not in head:
            rep.warn(where, "falta `- **Leer si**:` en la cabecera")

        for link in WIKILINK_RE.findall(body):
            if link not in stems:
                rep.error(where, f"wikilink roto: [[{link}]]")

    return rep, stats


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--quiet", action="store_true", help="solo problemas, sin resumen")
    ap.add_argument("--warn-only", action="store_true", help="nunca devolver exit!=0")
    ap.add_argument("--json", action="store_true", help="salida JSON")
    ap.add_argument("--dir", type=Path, default=MEMORY_DIR)
    args = ap.parse_args()

    if not args.dir.exists():
        print(f"memory_lint: no existe {args.dir}", file=sys.stderr)
        return 0 if args.warn_only else 1

    rep, stats = lint(args.dir)

    if args.json:
        print(json.dumps({"stats": stats, "errors": rep.errors, "warnings": rep.warnings}, indent=2))
    else:
        if not args.quiet:
            print(
                f"memory_lint: {stats['memories']} memorias · {stats['total_kb']} KB "
                f"· índice {stats['index_kb']} KB · tipos {stats['types']}"
            )
        for where, msg in rep.errors:
            print(f"  ERROR  {where}: {msg}")
        for where, msg in rep.warnings:
            print(f"  warn   {where}: {msg}")
        if not rep.errors and not rep.warnings and not args.quiet:
            print("  todo en norma ✓")

    if args.warn_only:
        return 0
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
