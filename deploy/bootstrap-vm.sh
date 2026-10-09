#!/usr/bin/env bash
# Run ONCE on a fresh Ubuntu server:  ssh -i key.pem ubuntu@<ip> 'bash -s' < deploy/bootstrap-vm.sh
set -euo pipefail

# Everything lives in a function so bash has read the whole script before running it: a command
# that reads stdin (like apt) cannot swallow the rest of a script that arrives over `bash -s`.
main() {
  # rsync receives the files that deploy.sh sends.
  sudo apt-get update -y
  sudo apt-get install -y rsync

  # Docker Engine + the compose plugin, via Docker's official install script (starts on boot, so the
  # stack survives a reboot). A brand-new Ubuntu release may not be supported by it yet: then fall
  # back to Ubuntu's own packages.
  if ! curl -fsSL https://get.docker.com | sudo sh; then
    echo "Docker's installer failed; falling back to Ubuntu's packages"
    sudo apt-get install -y docker.io docker-compose-v2 docker-buildx
  fi
  sudo usermod -aG docker "$USER"

  # A 2 GB swap file: insurance for building the Next.js image on a small instance.
  if ! swapon --show | grep -q /swapfile; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi

  echo "Done. Docker, rsync and swap are ready."
}

main
