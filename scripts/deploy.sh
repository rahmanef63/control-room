#!/bin/bash
set -e
cd /home/rahman/projects/vps-rahmanef
git pull origin main
cd frontend && npm install && npm run build && cd ..
cd agent && npm install && npm run build && cd ..
cd convex && npx convex deploy && cd ..
sudo systemctl restart vps-control-room-frontend
sudo systemctl restart vps-control-room-agent
echo "Deployment complete"
