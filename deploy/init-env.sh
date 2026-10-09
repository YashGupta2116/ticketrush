#!/usr/bin/env bash
# Create .env.prod with fresh random secrets. Run from the repo root:
#   deploy/init-env.sh ticketrush-yash.duckdns.org
set -euo pipefail

SITE=${1:?usage: deploy/init-env.sh <hostname>   e.g. ticketrush-yash.duckdns.org}
case "$SITE" in
  *://* | */*) echo "Pass just the hostname (no https://, no path), e.g. ticketrush-yash.duckdns.org"; exit 1 ;;
esac
[ -e .env.prod ] && { echo ".env.prod already exists. Delete it first if you want fresh secrets."; exit 1; }

secret() { openssl rand -hex 24; } # hex only: the Postgres password goes inside a URL

sed -e "s|^SITE_ADDRESS=.*|SITE_ADDRESS=$SITE|" \
  -e "s|^PUBLIC_URL=.*|PUBLIC_URL=https://$SITE|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(secret)|" \
  -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(secret)|" \
  -e "s|^PAYMENT_WEBHOOK_SECRET=.*|PAYMENT_WEBHOOK_SECRET=$(secret)|" \
  -e "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=$(secret | cut -c1-20)|" \
  .env.prod.example > .env.prod
chmod 600 .env.prod

echo "Wrote .env.prod for https://$SITE with random secrets."
echo "The demo admin (admin@ticketrush.dev) password is the SEED_ADMIN_PASSWORD line in that file."
