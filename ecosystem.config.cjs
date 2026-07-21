module.exports = {
  apps: [
    {
      name: 'shengshi',
      cwd: __dirname,
      script: 'server/index.js',
      args: '--port 8080',
      autorestart: true,
      kill_timeout: 30000,
      max_memory_restart: '300M',
      time: true
    },
    {
      name: 'shengshi-backup',
      cwd: __dirname,
      script: 'server/backup.js',
      autorestart: false,
      cron_restart: '30 3 * * *',
      time: true,
      env: {
        BACKUP_DIR: '/var/backups/shengshi',
        BACKUP_RETENTION: '30'
      }
    }
  ]
};
