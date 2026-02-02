module.exports = {
  apps: [
    {
      name: "iescms",
      cwd: "/var/www/iesCMS-node",
      script: "app.js",
      interpreter: "/opt/node-v24/bin/node",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
