# Deploy and operate the Shengshi website

This how-to is for the maintainer of the Ubuntu host serving
`ss.xiuxianjyj.xin`. It covers a single Node.js process behind Nginx. It does
not cover cloud provisioning or CI/CD.

## Prerequisites

- Ubuntu with Node.js 22 or newer, Nginx, and Certbot
- The project installed at `/var/www/shengshi`
- DNS for `ss.xiuxianjyj.xin` pointing to the host
- A TLS certificate in `/etc/letsencrypt/live/ss.xiuxianjyj.xin/`

## Install the application

```bash
cd /var/www/shengshi
npm ci --omit=dev
sudo install -d -o www-data -g www-data data public/uploads
```

Create the runtime environment file from `.env.example`. Set
`NODE_ENV=production`, set `PORT=8080`, and use unique, randomly generated
values for every secret. PM2 reads the project `.env` file:

```dotenv
NODE_ENV=production
PORT=8080
```

Port `8080` is the production upstream used by `nginx.conf`; local development
continues to use port `3000`.

```bash
cp .env.example .env
chmod 600 .env
```

The systemd units instead read `/etc/shengshi.env`:

```bash
sudo cp .env.example /etc/shengshi.env
sudo chown root:www-data /etc/shengshi.env
sudo chmod 640 /etc/shengshi.env
```

## Run with PM2

Use this option on hosts that already manage Node.js applications with PM2. Do
not enable the systemd application service at the same time.

```bash
cd /var/www/shengshi
sudo mkdir -p /var/backups/shengshi
pm2 startOrReload ecosystem.config.cjs --only shengshi
pm2 start ecosystem.config.cjs --only shengshi-backup
pm2 save
```

The backup process exits after each run and PM2 starts it again every day at
03:30 server time. It retains 30 backups in `/var/backups/shengshi`.

## Run with systemd

Install and start the application service:

```bash
sudo cp deploy/guild-website.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now guild-website.service
sudo systemctl status guild-website.service
```

## Configure Nginx

Install `nginx.conf` as the site configuration, validate it, and reload Nginx:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/shengshi
sudo ln -sfn /etc/nginx/sites-available/shengshi /etc/nginx/sites-enabled/shengshi
sudo nginx -t
sudo systemctl reload nginx
```

For a new host without a certificate, obtain the certificate before enabling
the HTTPS server block. Certbot standalone mode is one option:

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone -d ss.xiuxianjyj.xin
sudo systemctl start nginx
```

## Verify a release

```bash
curl --fail --silent https://ss.xiuxianjyj.xin/api/health
curl --head https://ss.xiuxianjyj.xin/
pm2 logs shengshi --lines 100 --nostream
sudo journalctl -u guild-website.service -n 100 --no-pager
```

The health endpoint must return `{"ok":true}`. The home page must return
`Cache-Control: no-cache`; versioned CSS and JavaScript may use a seven-day
cache.

## Enable backups

The backup command creates a consistent SQLite backup, copies album uploads,
writes a manifest, and removes backups beyond `BACKUP_RETENTION`.

```bash
sudo cp deploy/guild-website-backup.service /etc/systemd/system/
sudo cp deploy/guild-website-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now guild-website-backup.timer
sudo systemctl start guild-website-backup.service
sudo systemctl status guild-website-backup.service
```

Store `BACKUP_DIR` on a separate disk or replicate it off-host. A backup on the
same disk does not protect against disk loss.

## Restore a backup

Stop the application so SQLite cannot create new WAL data during the restore:

```bash
sudo systemctl stop guild-website.service
sudo cp -a data/guild.db data/guild.db.before-restore
sudo cp -a /path/to/backup/guild.db data/guild.db
sudo rm -f data/guild.db-wal data/guild.db-shm
sudo rsync -a --delete /path/to/backup/uploads/albums/ public/uploads/albums/
sudo chown -R www-data:www-data data public/uploads
sudo systemctl start guild-website.service
curl --fail --silent https://ss.xiuxianjyj.xin/api/health
```

## Release and rollback

Before replacing application files, run `npm test` and create a backup. After
the files are installed, run `npm ci --omit=dev`, restart the service, and run
the verification commands above.

Code rollback is safe only when the older code supports the current database
schema. If a migration is not backward compatible, restore the matching
database backup together with the older code.
