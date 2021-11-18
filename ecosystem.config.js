module.exports = {
  apps : [{
    name: 'diarybot',
    script: 'npm',

    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: ["bin"],
    exec_mode: "fork",
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }],

  deploy : {
    production : {
      user : 'std',
      host : 'std-1482.ist.mospolytech.ru',
      path : '/home/std/rp-bot',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
