#!/usr/bin/env bash
# Ship the working tree to the server and (re)build the stack there. Run from the repo root:
#   SSH_KEY=~/key.pem deploy/deploy.sh ubuntu@<ip>
# Needs .env.prod in the repo root (deploy/init-env.sh creates it). Safe to re-run for every update.
set -euo pipefail

HOST=${1:?usage: deploy/deploy.sh user@host}
[ -f .env.prod ] || { echo "Missing .env.prod. Create it with: deploy/init-env.sh <hostname>"; exit 1; }
if grep -Eq '^(SITE_ADDRESS|PUBLIC_URL|POSTGRES_PASSWORD|JWT_ACCESS_SECRET|PAYMENT_WEBHOOK_SECRET)=$' .env.prod; then
  echo ".env.prod still has empty values. Fill them in, or recreate it with deploy/init-env.sh"; exit 1
fi
# accept-new trusts the server's fingerprint on the first connection only, so no yes/no prompt.
SSH=(ssh -o StrictHostKeyChecking=accept-new ${SSH_KEY:+-i "$SSH_KEY"})

rsync -az --delete -e "${SSH[*]}" \
  --exclude .git --exclude node_modules --exclude .next --exclude dist --exclude coverage \
  --exclude '.env*' --exclude .claude ./ "$HOST:ticketrush/"
scp -o StrictHostKeyChecking=accept-new ${SSH_KEY:+-i "$SSH_KEY"} .env.prod "$HOST:ticketrush/.env.prod"

# One build at a time: building the API and web images together can run a small server out of memory.
"${SSH[@]}" "$HOST" 'cd ticketrush && export COMPOSE_PARALLEL_LIMIT=1 &&
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build &&
  docker compose -f docker-compose.prod.yml --env-file .env.prod ps'
