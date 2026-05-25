# TradeFloor — Complete AWS Deployment Guide
### From Zero to Live Production (Ubuntu 22.04 + FastAPI + PostgreSQL + React + Nginx)

---

## PART 1 — Create Your AWS Account & Launch EC2 Instance

### Step 1.1 — Sign in to AWS Console
1. Go to **https://aws.amazon.com**
2. Click **"Sign in to the Console"** (top right)
3. Sign in with your account that has the $100 credit

---

### Step 1.2 — Launch an EC2 Instance

1. In the top search bar, type **EC2** and click it
2. In the left sidebar, click **"Instances"**
3. Click the orange **"Launch instances"** button (top right)

---

### Step 1.3 — Configure the Instance (Fill in each section)

#### Name
```
TradeFloor-Server
```

#### Application and OS Images (AMI)
- Click **"Ubuntu"** from the quick-select row
- The box should automatically select **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
- Architecture: **64-bit (x86)**
- ✅ Make sure it says **"Free tier eligible"** below it

#### Instance Type
- Select **t2.micro**
- ✅ It will say **"Free tier eligible"** — this gives you **750 hours/month free**

#### Key Pair (Login) — VERY IMPORTANT
This is the password to SSH into your server. You only get it once.

1. Click **"Create new key pair"**
2. Key pair name: `tradefloor-key`
3. Key pair type: **RSA**
4. Private key file format: **`.pem`** (for all systems)
5. Click **"Create key pair"**
6. A file called `tradefloor-key.pem` will automatically download to your PC
7. **⚠️ Save this file somewhere safe. If you lose it, you cannot access your server.**

#### Network Settings — Click "Edit"
Leave VPC and Subnet as default. Configure the firewall rules:

1. **Rule 1** (already exists): SSH — Port 22 — Source: **Anywhere (0.0.0.0/0)**
2. Click **"Add security group rule"** → HTTP — Port 80 — Source: **Anywhere (0.0.0.0/0)**
3. Click **"Add security group rule"** → HTTPS — Port 443 — Source: **Anywhere (0.0.0.0/0)**

> Note: Do NOT add port 8000 publicly. Your backend will only be accessible internally through Nginx.

#### Configure Storage
- Change the default **8 GB** to **20 GB**
- Volume type: **gp2** (General Purpose SSD) — free tier eligible up to 30 GB

#### Summary
- Number of instances: **1**
- Click the orange **"Launch instance"** button

---

### Step 1.4 — Allocate a Static (Elastic) IP Address

By default, your server gets a new IP every time it restarts. Fix this now.

1. In the left sidebar, scroll down to **"Network & Security"** → click **"Elastic IPs"**
2. Click **"Allocate Elastic IP address"** (top right)
3. Leave everything as default → Click **"Allocate"**
4. You will see a new IP address appear (e.g., `13.234.xx.xx`) — **note this down, this is your permanent server IP**
5. Select the IP by checking its checkbox
6. Click **"Actions"** → **"Associate Elastic IP address"**
7. Under **"Instance"**, select **TradeFloor-Server**
8. Click **"Associate"**

Your server now has a **permanent IP address** that never changes, even after restarts.

---

## PART 2 — Connect to Your Server via SSH

### Step 2.1 — Move and Set Permissions on Your Key File

Open PowerShell on your Windows machine and run:

```powershell
# Move the key to a safe location (adjust path if needed)
Move-Item "$env:USERPROFILE\Downloads\tradefloor-key.pem" "$env:USERPROFILE\.ssh\tradefloor-key.pem"
```

> On Windows, the key file permissions don't matter as much as on Linux/Mac. You can skip chmod.

### Step 2.2 — Connect via SSH

Replace `YOUR_ELASTIC_IP` with the IP you noted down:

```powershell
ssh -i "C:\Users\abdul\tradefloor-key.pem" ubuntu@13.51.112.183
```

If it asks **"Are you sure you want to continue connecting?"** → type `yes` and press Enter.

You are now inside your AWS server. Every command from here runs ON the server.

---

## PART 3 — Install All Required Software on the Server

Run these commands one by one. Copy each block and paste it into the SSH terminal.

### Step 3.1 — Update the System
```bash
sudo apt update && sudo apt upgrade -y
```
This may take 2-3 minutes.

### Step 3.2 — Install Python, Pip, and Venv
```bash
sudo apt install python3-pip python3-venv python3-dev build-essential -y
```

### Step 3.3 — Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
```

### Step 3.4 — Install Nginx (Web Server)
```bash
sudo apt install nginx -y
```

### Step 3.5 — Install Node.js 20 (for building React frontend)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify everything installed:
```bash
python3 --version     # Should show Python 3.10.x
psql --version        # Should show PostgreSQL 14.x
nginx -v              # Should show nginx version
node --version        # Should show v20.x.x
npm --version         # Should show 10.x.x
```

---

## PART 4 — Set Up PostgreSQL Database

### Step 4.1 — Create the Database and App User
```bash
sudo -u postgres psql
```

You are now inside the PostgreSQL terminal. Run these SQL commands:

```sql
CREATE DATABASE tradefloor;
CREATE ROLE tf_app WITH LOGIN PASSWORD 'tf_secure_pass_2026';
GRANT ALL PRIVILEGES ON DATABASE tradefloor TO tf_app;
\q
```

### Step 4.2 — Install pgcrypto Extension (needed by matching engine)
```bash
sudo -u postgres psql -d tradefloor -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

---

## PART 5 — Upload Your Project to the Server

### Step 5.1 — Push Your Project to GitHub (Do this on your Windows machine)

If your project is not already on GitHub, open PowerShell on your Windows PC and run:

```powershell
cd d:\Antigravity_Coding\ADBMS_4th_sem\Project

# Initialize git if not already done
git init
git add .
git commit -m "Production deployment"

# Create a repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/TradeFloor.git
git push -u origin main
```

### Step 5.2 — Clone the Project on the Server

Back in your SSH terminal on the server:

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/TradeFloor.git
cd TradeFloor
```

---

## PART 6 — Set Up the Backend (FastAPI)

### Step 6.1 — Create Python Virtual Environment
```bash
cd ~/TradeFloor/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 6.2 — Create the Production `.env` File

```bash
nano ~/TradeFloor/backend/.env
```

Paste the following (replacing all placeholder values):

```ini
DATABASE_URL=postgresql+asyncpg://tf_app:tf_secure_pass_2026@localhost:5432/tradefloor
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING_AT_LEAST_64_CHARS
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_NEW_SENDGRID_API_KEY_HERE
SMTP_FROM=upclick1214@gmail.com

APP_NAME=TradeFloor
FRONTEND_URL=http://YOUR_ELASTIC_IP
```

> To generate a secure JWT secret, run: `python3 -c "import secrets; print(secrets.token_hex(32))"`

Save and exit: Press `Ctrl+X` → `Y` → `Enter`

### Step 6.3 — Run the Database Setup Scripts

```bash
cd ~/TradeFloor
export PGPASSWORD='your_postgres_superuser_password'

# If you didn't set a password, use sudo -u postgres psql instead
sudo -u postgres psql -d tradefloor -f database/01_create_tables.sql
sudo -u postgres psql -d tradefloor -f database/02_triggers_and_rules.sql
sudo -u postgres psql -d tradefloor -f database/03_stored_procedures.sql
sudo -u postgres psql -d tradefloor -f database/04_materialized_views.sql
sudo -u postgres psql -d tradefloor -f database/05_permissions.sql
```

Grant permissions (needed for the app user to use sequences):
```bash
sudo -u postgres psql -d tradefloor -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tf_app;"
sudo -u postgres psql -d tradefloor -c "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO tf_app;"
```

### Step 6.4 — Seed Items and Test Users
```bash
sudo -u postgres psql -d tradefloor -f database/seed_items_only.sql
sudo -u postgres psql -d tradefloor -f database/seed_test_users.sql
```

### Step 6.5 — Test the Backend Manually
```bash
cd ~/TradeFloor/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

You should see `Application startup complete.` with no errors. Press `Ctrl+C` to stop it.

### Step 6.6 — Create a Systemd Service (Keeps backend running 24/7)

```bash
sudo nano /etc/systemd/system/tradefloor.service
```

Paste this exactly:
```ini
[Unit]
Description=TradeFloor FastAPI Backend
After=network.target postgresql.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/TradeFloor/backend
Environment="PATH=/home/ubuntu/TradeFloor/backend/venv/bin"
ExecStart=/home/ubuntu/TradeFloor/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tradefloor
sudo systemctl start tradefloor
```

Check it is running:
```bash
sudo systemctl status tradefloor
```
You should see **`active (running)`** in green.

---

## PART 7 — Build and Deploy the Frontend (React)

### Step 7.1 — Create Frontend Environment File

```bash
nano ~/TradeFloor/frontend/.env
```

Paste:
```ini
VITE_API_URL=http://YOUR_ELASTIC_IP/api
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

### Step 7.2 — Check Your Vite Config Uses the Env Variable

Your frontend `vite.config.js` proxy needs to point to the backend. But on production, the frontend talks directly to `/api` via Nginx — no proxy needed. Just make sure your `axios.js` uses:

```bash
cat ~/TradeFloor/frontend/src/api/axios.js
```

It should have something like:
```js
baseURL: import.meta.env.VITE_API_URL || '/api'
```

If it still has `http://localhost:8000/api` hardcoded, edit it:
```bash
nano ~/TradeFloor/frontend/src/api/axios.js
```

### Step 7.3 — Install Dependencies and Build

```bash
cd ~/TradeFloor/frontend
npm install
npm run build
```

This creates a `dist/` folder with your compiled React app. It takes 1-2 minutes.

---

## PART 8 — Configure Nginx

### Step 8.1 — Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/tradefloor
```

Paste this (replace `YOUR_ELASTIC_IP`):

```nginx
server {
    listen 80;
    server_name YOUR_ELASTIC_IP;

    # ── Serve React Frontend ──────────────────────────────────
    location / {
        root /home/ubuntu/TradeFloor/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # ── Proxy API calls to FastAPI backend ────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

### Step 8.2 — Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/tradefloor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### Step 8.3 — Test and Restart Nginx

```bash
sudo nginx -t
```
You should see: `syntax is ok` and `test is successful`

```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## PART 9 — Verify Everything is Live

Open your browser and go to:

```
http://YOUR_ELASTIC_IP
```

You should see your TradeFloor frontend. Test:
- ✅ Register a new user with an `@itu.edu.pk` email
- ✅ Check your inbox for the verification email from SendGrid
- ✅ Click the verification link — it should redirect to your server IP
- ✅ Log in and access the dashboard
- ✅ Go to `/api/docs` — you should see the FastAPI Swagger UI

---

## PART 10 — Useful Commands for After Deployment

### Restart the backend after code changes
```bash
sudo systemctl restart tradefloor
sudo systemctl status tradefloor
```

### View backend logs (errors, requests)
```bash
sudo journalctl -u tradefloor -f
```

### Update the project after pushing new code to GitHub
```bash
cd ~/TradeFloor
git pull origin main

# Restart backend
sudo systemctl restart tradefloor

# Rebuild frontend if you changed React code
cd frontend
npm run build
```

### Check if backend is running on port 8000
```bash
curl http://127.0.0.1:8000/
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

---

## PART 11 — Summary of What Lives Where

| Component | Location on Server | How it runs |
|---|---|---|
| PostgreSQL Database | `localhost:5432` | Managed by `postgresql` systemd service |
| FastAPI Backend | `localhost:8000` | Managed by `tradefloor` systemd service |
| React Frontend | `/home/ubuntu/TradeFloor/frontend/dist` | Served as static files by Nginx |
| Nginx | Port 80 (public) | Routes `/api/` → backend, `/` → frontend |
| `.env` file | `/home/ubuntu/TradeFloor/backend/.env` | Read by FastAPI on startup |

---

## PART 12 — Final `.env` Checklist

Before going live, confirm these values in your server's `.env`:

| Key | Value | Status |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://tf_app:tf_secure_pass_2026@localhost:5432/tradefloor` | ✅ Ready |
| `JWT_SECRET` | At least 64 random characters | ⚠️ Must generate new |
| `SMTP_HOST` | `smtp.sendgrid.net` | ✅ Ready |
| `SMTP_USER` | `apikey` | ✅ Ready |
| `SMTP_PASS` | Your new SendGrid API key | ⚠️ Must replace (old one was exposed) |
| `SMTP_FROM` | `upclick1214@gmail.com` | ✅ Ready (if verified in SendGrid) |
| `FRONTEND_URL` | `http://YOUR_ELASTIC_IP` | ⚠️ Must update to real IP |
| `APP_NAME` | `TradeFloor` | ✅ Ready |
