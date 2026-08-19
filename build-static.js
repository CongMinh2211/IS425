const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const output = path.join(root, "public");
const staticFiles = ["index.html", "styles.css", "script.js", "fallback-data.js"];
const clientRoutes = ["products", "story", "journal", "contact"];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

staticFiles.forEach((file) => fs.copyFileSync(path.join(root, file), path.join(output, file)));
clientRoutes.forEach((route) => {
  fs.copyFileSync(path.join(root, "index.html"), path.join(output, `${route}.html`));
});
fs.cpSync(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });

console.log("Static Vercel bundle created in public/");
