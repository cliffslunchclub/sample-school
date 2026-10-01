#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null; then
  echo 'Install Node.js 24 LTS from https://nodejs.org, then run this again.'
  read -r -p 'Press Return to close.'
  exit 1
fi
npm start
read -r -p 'Press Return to close.'
