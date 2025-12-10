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
# Use numeric uid/gid (5050 is the default pgadmin user in the official image)
# Name resolution may fail on some hosts/volumes, so avoid user/group names here.
chown 5050:5050 "$TARGET" 2>/dev/null || echo "chown skipped (not supported on this filesystem)"
chmod 600 "$TARGET"
echo "pgAdmin servers.json installed."
