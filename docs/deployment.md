# Deploying TicketRush on one AWS server

One EC2 instance runs the whole stack with Docker Compose: Postgres, Redis, the API, the worker,
the Next.js site and Caddy. Caddy serves HTTPS and puts the site and the API on **one origin**, so
the `SameSite=Strict` refresh cookie, SSE and CORS all work with no extra configuration.
There are no cold starts, and the database is on the same machine as the API.

```
browser ──https──▶ Caddy ──/api/*──▶ api ──▶ postgres, redis ◀── worker
                     └─────everything else──▶ web (Next.js)
```

You do the AWS and DNS clicks (steps 1 to 4); the rest is three commands. Allow about 30 minutes.
Console labels change now and then, so treat the wording below as a guide.

## 1. Launch the server

1. Sign in to the AWS console. Top right, set the region to **Asia Pacific (Mumbai) `ap-south-1`**
   (or whichever region is closest to the people who will use the site).
2. Search for **EC2**, open it, and click **Launch instance**. Fill in:

   | Field                                   | Value                                                                                                                                                                                       |
   | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Name                                    | `ticketrush`                                                                                                                                                                                |
   | Application and OS Images               | Quick Start → **Ubuntu**. The wizard preselects 26.04: open the AMI dropdown and pick **Ubuntu Server 24.04 LTS** instead (the scripts are tested against it). Keep **64-bit (x86)**.       |
   | Instance type                           | `c7i-flex.large` (4 GB) if listed, otherwise `t3.small` (2 GB). At least 2 GB; avoid `micro`. On the AWS Free Plan the console only allows a short list of types: pick from that list.      |
   | Key pair                                | **Create new key pair** → name `ticketrush-key`, type RSA, format **.pem** → Create. The file downloads to `~/Downloads/ticketrush-key.pem`. You cannot download it again, so keep it safe. |
   | Network settings → Firewall             | **Create security group**, then tick **Allow SSH traffic from** → **My IP**, tick **Allow HTTPS traffic from the internet**, and tick **Allow HTTP traffic from the internet**              |
   | Network settings → Subnet and public IP | Subnet: pick any subnet (it must not say "Select"). Auto-assign public IP: **Enable**. If the subnet list is empty, see Troubleshooting.                                                    |
   | Configure storage                       | Change 8 GiB to **30 GiB** (gp3). The default is too small for Docker images.                                                                                                               |

   Nothing else is exposed: Postgres and Redis only listen inside the Docker network.

3. Click **Launch instance**, then **View all instances** and wait for **Instance state: Running**
   and **Status check: 2/2 checks passed** (a minute or two).

## 2. Give it a fixed address (Elastic IP)

Without this the public IP changes whenever you stop and start the instance.

1. EC2 left menu → **Network & Security → Elastic IPs → Allocate Elastic IP address → Allocate**.
2. Select the new address → **Actions → Associate Elastic IP address** → Resource type **Instance**
   → choose `ticketrush` → **Associate**.
3. Copy the address (it looks like `13.233.10.20`). This is your **server IP**.

## 3. Point a hostname at it

Caddy needs a hostname to get a free HTTPS certificate. Do this **before** the first deploy.

1. Go to duckdns.org and sign in with Google or GitHub.
2. Under **domains**, type a name such as `ticketrush-yash` and click **add domain**.
3. In that row, put your **server IP** in the **current ip** box and click **update ip**.

Your hostname is now `ticketrush-yash.duckdns.org`. Check that it resolves (it can take a minute):

```bash
dig +short ticketrush-yash.duckdns.org     # must print your server IP
```

No sign-up alternative: `<ip-with-dashes>.sslip.io`, e.g. `13-233-10-20.sslip.io`. It is shared with
many other people, so Let's Encrypt's rate limits can occasionally block it.

## 4. Deploy (three commands from the repo root)

Set two variables once per terminal window, using your own IP and key path:

```bash
export HOST=ubuntu@13.233.10.20
export SSH_KEY=~/Downloads/ticketrush-key.pem
chmod 400 "$SSH_KEY"
ssh -o StrictHostKeyChecking=accept-new -i "$SSH_KEY" "$HOST" 'echo connected'
```

That last line must print `connected`. If it does not, see **Troubleshooting**.

```bash
# a) create .env.prod with random secrets for your hostname (never commit it; it is gitignored)
deploy/init-env.sh ticketrush-yash.duckdns.org

# b) once: installs Docker, rsync and a swap file on the server (1 to 3 minutes)
ssh -i "$SSH_KEY" "$HOST" 'bash -s' < deploy/bootstrap-vm.sh

# c) ship the code and build everything on the server (5 to 10 minutes the first time)
deploy/deploy.sh "$HOST"

# d) once: create the demo venue and shows (admin: admin@ticketrush.dev, password in .env.prod)
ssh -i "$SSH_KEY" "$HOST" 'cd ticketrush && docker compose -f docker-compose.prod.yml --env-file .env.prod --profile tools run --rm seed'
```

Open `https://ticketrush-yash.duckdns.org`. The very first request can take 10 to 30 seconds while
Caddy obtains the certificate; after that it is instant.

After any later code change, just run `deploy/deploy.sh "$HOST"` again.

## 5. Check it works

- Register, pick seats, hold, continue to payment, pay. Mock payments fail 10% of the time on
  purpose (`MOCK_PAYMENT_FAILURE_RATE`); the page shows the failure and lets you retry.
- Open the show in two browsers: a hold in one turns the seats grey in the other.
- Reload the page while signed in: you stay signed in (refresh cookie).

## Troubleshooting

| Symptom                                                             | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wizard says `No subnets found` under Subnet                         | The default VPC has no subnets (someone deleted them). Open a **new tab**, go to the **VPC** console → **Subnets → Actions → Create default subnet** → Availability Zone `ap-south-1a` → Create. Back in the wizard click the ↻ next to Subnet and pick it. If the SSH test later times out even with the right security group, open VPC → Your VPCs → your VPC → **Resource map** and check that an Internet gateway is attached to the route table. |
| `Auto assign public IP must be set`                                 | Set **Auto-assign public IP** to **Enable**.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Launch fails: instance type not supported in this Availability Zone | Create a default subnet in another zone (`ap-south-1b`) and pick that subnet.                                                                                                                                                                                                                                                                                                                                                                         |
| `ssh: ... Operation timed out`                                      | The security group does not allow SSH from your current IP (home IPs change). EC2 → Security Groups → your group → Edit inbound rules → SSH → Source **My IP** → Save.                                                                                                                                                                                                                                                                                |
| `Permission denied (publickey)`                                     | Wrong key file, or the user is not `ubuntu`. Use `ubuntu@<ip>` and the `.pem` you created for this instance.                                                                                                                                                                                                                                                                                                                                          |
| `UNPROTECTED PRIVATE KEY FILE`                                      | Run `chmod 400 "$SSH_KEY"`.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Browser says the certificate is invalid, or cannot connect          | DNS does not point at the server yet, or ports 80/443 are closed. Fix, then `ssh ... 'cd ticketrush && docker compose -f docker-compose.prod.yml --env-file .env.prod restart caddy'`. Logs: `... logs caddy`.                                                                                                                                                                                                                                        |
| 502 Bad Gateway right after a deploy                                | The API is still starting. Wait 20 seconds and reload. Check with `... ps` and `... logs api`.                                                                                                                                                                                                                                                                                                                                                        |
| Build fails or the server freezes while building                    | Out of memory on a 2 GB instance. The bootstrap adds swap; if it still fails, use a bigger instance type (stop it, change the type, start it).                                                                                                                                                                                                                                                                                                        |
| `Already seeded`                                                    | Fine: the seed is idempotent, the data exists.                                                                                                                                                                                                                                                                                                                                                                                                        |

## Operating it

```bash
ssh -i "$SSH_KEY" "$HOST"
cd ticketrush
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api worker
docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres pg_dump -U ticketrush ticketrush > backup.sql
```

Every container restarts on its own after a reboot. The demo shows start three weeks after the
seed; to refresh them, wipe the data (`docker compose ... down -v`), deploy and seed again.

## Cost and shutting down

The credits cover this comfortably: the instance, its disk and the public IPv4 address together
cost from a few dollars a month for a `t3.small` to a few dollars a day for the 4 to 8 GB types.
Check Billing → Credits for what your credits cover and when they expire, and add a budget alert
(Billing → Budgets → Create budget → monthly cost) so nothing surprises you.

- **Pause:** stop the instance. Compute billing stops; the disk and the Elastic IP still cost a little.
- **Stop paying entirely:** terminate the instance, release the Elastic IP, delete leftover volumes.

## If the server is not an option on interview day

The exact same stack runs on your laptop, so you can demo it from there. Create `.env.prod` with
`deploy/init-env.sh localhost`, then edit it to `SITE_ADDRESS=:80` and `PUBLIC_URL=http://localhost:8080`,
and add a line `HTTP_PORT=8080`. Then:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile tools run --rm seed
```

Open <http://localhost:8080> in Chrome or Firefox (Safari does not keep the `Secure` login cookie on
plain `http://localhost`).
