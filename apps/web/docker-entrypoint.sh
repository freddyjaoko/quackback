#!/bin/sh
set -e

# If the process manager passed a command, run it instead of the default
# start path. Release-phase tasks (migrate once per deploy) and one-off
# dynos land here. A single argument is often the whole command line.
if [ "$#" -gt 0 ]; then
  echo "========================================"
  echo "  Quackback process command..."
  echo "========================================"
  if [ "$#" -eq 1 ]; then
    exec /bin/sh -c "$1"
  fi
  exec "$@"
fi

echo "========================================"
echo "  Quackback starting..."
echo "========================================"

# Migrations: skipped when a release/pre-upgrade job already ran them.
# Set SKIP_MIGRATIONS=true to opt out of the on-start migration step.
# Default behavior matches `docker run` ergonomics.
if [ "$SKIP_MIGRATIONS" = "true" ]; then
  echo ""
  echo "SKIP_MIGRATIONS=true — skipping startup migration (handled out-of-band)"
else
  echo ""
  echo "Running database migrations..."
  bun /app/migrate.mjs
  echo "Migrations complete."
fi

# Optionally seed the database
if [ "$SEED_DATABASE" = "true" ]; then
  echo ""
  echo "Seeding database..."
  bun /app/seed.mjs
  echo "Seeding complete."
fi

# Start the application
echo ""
echo "Starting Quackback server on port ${PORT:-3000}..."
echo "========================================"
exec bun .output/server/index.mjs
