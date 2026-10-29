// PM2 process file:  pm2 start ecosystem.config.js
module.exports = { apps: [{ name: 'avyaadwik', script: 'server.js', instances: 1, autorestart: true, max_memory_restart: '300M', env: { NODE_ENV: 'production' } }] };
