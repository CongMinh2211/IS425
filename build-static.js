const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const output = path.join(root, "public");
const staticFiles = ["index.html", "styles.css", "script.js", "fallback-data.js", "sitemap.xml", "robots.txt"];
const clientRoutes = [
  "products",
  "products/ca-phe-rang-moc-buon-ma-thuot",
  "products/arabica-cau-dat-rang-vua",
  "products/mac-ca-dak-lak-rang-moc",
  "products/mat-ong-hoa-ca-phe",
  "products/tieu-den-dak-nong",
  "products/mang-kho-gia-lai",
  "products/bo-mot-nang-muoi-kien-vang",
  "products/combo-qua-tang-dai-ngan",
  "products/sau-rieng-say-lanh-krong-pac",
  "products/ca-phe-honey-process-cau-dat",
  "products/mat-ong-rung-tay-nguyen",
  "story",
  "journal",
  "contact",
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

staticFiles.forEach((file) => fs.copyFileSync(path.join(root, file), path.join(output, file)));
fs.readdirSync(root)
  .filter((file) => /^google[a-z0-9]+\.html$/i.test(file))
  .forEach((file) => fs.copyFileSync(path.join(root, file), path.join(output, file)));
clientRoutes.forEach((route) => {
  const outputFile = path.join(output, `${route}.html`);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.copyFileSync(path.join(root, "index.html"), outputFile);
});
fs.cpSync(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });

console.log("Static Vercel bundle created in public/");
