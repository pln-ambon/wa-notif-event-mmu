module.exports = {
  apps: [
    {
      name: 'wa-notif-event-mmu',
      script: 'dist/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
