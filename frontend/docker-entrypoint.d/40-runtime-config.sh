#!/bin/sh
# Genera runtime-config.js con las variables VITE_* del contenedor (factor III).
# Así la MISMA imagen sirve en local y en OCI sin recompilar (factor X).
set -eu

esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

cat > /usr/share/nginx/html/runtime-config.js <<JS
window.__TIENDA_CONFIG__ = {
  VITE_API_URL: "$(esc "${VITE_API_URL:-}")",
  VITE_FIREBASE_API_KEY: "$(esc "${VITE_FIREBASE_API_KEY:-}")",
  VITE_FIREBASE_AUTH_DOMAIN: "$(esc "${VITE_FIREBASE_AUTH_DOMAIN:-}")",
  VITE_FIREBASE_PROJECT_ID: "$(esc "${VITE_FIREBASE_PROJECT_ID:-}")",
  VITE_FIREBASE_APP_ID: "$(esc "${VITE_FIREBASE_APP_ID:-}")"
};
JS
echo "runtime-config.js generado (API: ${VITE_API_URL:-sin definir})"
