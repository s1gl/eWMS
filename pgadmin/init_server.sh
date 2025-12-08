#!/bin/sh
set -e

TARGET="/var/lib/pgadmin/servers.json"
SOURCE="/pgadmin-init/Servers.json"

if [ ! -f "$SOURCE" ]; then
  echo "Servers.json not found at $SOURCE" >&2
  exit 1
fi

echo "Installing pgAdmin servers configuration..."
cp "$SOURCE" "$TARGET"
chown pgadmin:pgadmin "$TARGET"
chmod 600 "$TARGET"
echo "pgAdmin servers.json installed."
