# TradeFloor Deployment Update Playbook

This guide covers what to do on the server when you change different parts of the project locally and push to GitHub.

## Server basics
- Repo path: /home/ubuntu/TradeFloor-ADBMS
- Backend service: tradefloor (systemd)
- Frontend build output: /home/ubuntu/TradeFloor-ADBMS/frontend/dist
- Web server: nginx
- Database: PostgreSQL (local)

## Always do this first
1) SSH into the server
2) Pull latest code:

```
cd ~/TradeFloor-ADBMS
git pull origin main
```

If you changed nothing beyond code, you can stop here for small frontend-only updates (see below).

## Change scenarios

### 1) Backend code only (no deps, no env, no DB changes)
```
cd ~/TradeFloor-ADBMS
sudo systemctl restart tradefloor
```

### 2) Backend dependencies changed (requirements.txt)
```
cd ~/TradeFloor-ADBMS/backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart tradefloor
```

### 3) Backend env vars changed (.env)
```
nano ~/TradeFloor-ADBMS/backend/.env
sudo systemctl restart tradefloor
```

### 4) Database schema changes (new tables/columns)
- Add a new SQL migration file under database/
- Run it:

```
cd ~/TradeFloor-ADBMS
sudo -u postgres psql -d tradefloor -f database/your_migration.sql
```

If data is important, take a backup first:
```
pg_dump -U postgres -d tradefloor > ~/tradefloor_backup.sql
```

### 5) Frontend code only (no deps)
```
cd ~/TradeFloor-ADBMS/frontend
npm run build
sudo systemctl restart nginx
```

### 6) Frontend dependencies changed (package.json)
```
cd ~/TradeFloor-ADBMS/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
sudo systemctl restart nginx
```

### 7) Nginx config changes
```
sudo nano /etc/nginx/sites-available/tradefloor
sudo nginx -t
sudo systemctl restart nginx
```

### 8) systemd service changes (tradefloor.service)
```
sudo nano /etc/systemd/system/tradefloor.service
sudo systemctl daemon-reload
sudo systemctl restart tradefloor
```

### 9) Full refresh (big changes everywhere)
```
cd ~/TradeFloor-ADBMS
git pull origin main

cd ~/TradeFloor-ADBMS/backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart tradefloor

cd ~/TradeFloor-ADBMS/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
sudo systemctl restart nginx
```

## Quick health checks
- Backend local:
```
curl http://127.0.0.1:8000/
```
- Frontend:
```
http://13.51.112.183
```
- Logs:
```
sudo journalctl -u tradefloor -f
sudo tail -n 50 /var/log/nginx/error.log
```

## Common errors
- 500 from nginx: usually file permissions or missing dist/
- 502/504 from nginx: backend service down or wrong proxy target
- DB errors: migration not applied or wrong DATABASE_URL

## Notes
- Only run npm install or pip install when dependencies change
- Do not commit secrets to GitHub; edit .env directly on server
- If you add WebSockets (chat), keep the /api/ block with Upgrade headers
