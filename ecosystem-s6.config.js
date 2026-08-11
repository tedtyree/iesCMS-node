module.exports = {
  apps: [
    {
      name: "iescms",
      cwd: "/var/www/iescms",
      script: "app.js",
      interpreter: "/usr/bin/node",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
