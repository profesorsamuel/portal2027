#!/usr/bin/env bash
# portal2027-respaldo-db.sh — copia de la base (esquema public + usuarios de Auth) a una carpeta LOCAL.
# NO la suba a GitHub con datos reales. La clave va en una variable de entorno, nunca escrita aquí.
#
# Uso:   export SUPABASE_DB_URL='postgresql://postgres.xxxx:CLAVE@host:5432/postgres'
#        ./portal2027-respaldo-db.sh [carpeta_destino] [etiqueta]
# Etiquetas útiles: diaria | previa_importacion | previa_cierre | manual
# Requiere pg_dump (PostgreSQL client) de versión igual o mayor a la de Supabase.
set -euo pipefail

: "${SUPABASE_DB_URL:?Defina SUPABASE_DB_URL (Supabase > Connect > cadena de conexión; use «Session pooler» si la directa no conecta)}"
DEST="${1:-./respaldos}"
ETIQ="${2:-manual}"
FECHA="$(date +%Y%m%d-%H%M%S)"
DIR="$DEST/portal2027-$FECHA-$ETIQ"
mkdir -p "$DIR"
umask 077

echo "1/2 Esquema public (estructura + datos)..."
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges --format=custom --file="$DIR/public.dump"
echo "2/2 Usuarios de Auth (solo datos)..."
pg_dump "$SUPABASE_DB_URL" --schema=auth --data-only --no-owner --no-privileges --format=custom --file="$DIR/auth-datos.dump"

# Comprobación real: que el archivo se pueda leer y tenga contenido.
for f in public auth-datos; do
  pg_restore --list "$DIR/$f.dump" > "$DIR/$f.lista.txt"
  [ -s "$DIR/$f.lista.txt" ] || { echo "FALLÓ: $f.dump no tiene contenido legible"; exit 1; }
done
( cd "$DIR" && sha256sum public.dump auth-datos.dump > SHA256.txt )
TAM="$(du -sb "$DIR" | cut -f1)"
echo "LISTO: $DIR  ($TAM bytes)"
echo "Ahora anótelo en el portal (Respaldos) con el resultado REAL. Copie la carpeta a un lugar fuera de este equipo."
