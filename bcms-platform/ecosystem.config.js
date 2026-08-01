// PM2 process manager config — for deploying directly on a VPS (no Docker).
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: 'bcms-platform',
      script: 'app.js',
      instances: 'max',       // cluster mode — one process per CPU core
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
