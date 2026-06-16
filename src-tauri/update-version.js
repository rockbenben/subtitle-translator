/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
const confPath = path.resolve(__dirname, "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
conf.version = pkg.version;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n", "utf8");
console.log(`Updated tauri.conf.json version -> ${pkg.version}`);
