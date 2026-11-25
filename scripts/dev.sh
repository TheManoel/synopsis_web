#!/usr/bin/env bash
# Levanta la API (screener_core, :8899) y el front (Vite, :5180) juntos.
# Ctrl+C para los dos. Uso: npm run dev:all   (o: bash scripts/dev.sh)
#
# Variables opcionales:
#   CORE_DIR   ruta a screener_core           (por defecto ../screener_core)
#   API_PORT   puerto de la API               (por defecto 8899)
#   FRONT_PORT puerto del front               (por defecto 5180)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${CORE_DIR:-$HERE/../screener_core}"
API_PORT="${API_PORT:-8899}"
FRONT_PORT="${FRONT_PORT:-5180}"

if [ ! -d "$CORE_DIR" ]; then
  echo "No encuentro screener_core en $CORE_DIR (usa CORE_DIR=...)" >&2
  exit 1
fi
for port in "$API_PORT" "$FRONT_PORT"; do
  if ss -ltn 2>/dev/null | grep -q ":$port "; then
    echo "El puerto $port ya está en uso: para el proceso que lo ocupa antes de arrancar." >&2
    exit 1
  fi
done

# Al salir (Ctrl+C o caída de uno de los dos) se para todo el grupo de procesos.
trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT

(
  cd "$CORE_DIR"
  # --reload: la API se reinicia sola al cambiar el código del core (solo src/,
  # no config/: guardar una estrategia o la watchlist no la reinicia).
  API_ONLY=1 poetry run uvicorn src.applications.signal_lab.web.app:create_app \
    --factory --port "$API_PORT" --reload --reload-dir src 2>&1 | sed -u 's/^/[api]   /'
) &

(
  cd "$HERE"
  SYNOPSIS_API="http://localhost:$API_PORT" npx vite --port "$FRONT_PORT" --strictPort 2>&1 | sed -u 's/^/[front] /'
) &

echo "API http://localhost:$API_PORT · front http://localhost:$FRONT_PORT · Ctrl+C para parar"
# Si cualquiera de los dos muere, se para el otro.
wait -n
