const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const output = path.join(root, "public");
const staticFiles = ["index.html", "styles.css", "script.js", "fallback-data.js", "sitemap.xml", "robots.txt"];
const clientRoutes = [
  "products",
  "chi-tiet-san-pham/ca-phe-rang-moc-buon-ma-thuot",
  "chi-tiet-san-pham/arabica-cau-dat-rang-vua",
  "chi-tiet-san-pham/mac-ca-dak-lak-rang-moc",
  "chi-tiet-san-pham/mat-ong-hoa-ca-phe",
  "chi-tiet-san-pham/tieu-den-dak-nong",
  "chi-tiet-san-pham/mang-kho-gia-lai",
  "chi-tiet-san-pham/bo-mot-nang-muoi-kien-vang",
  "chi-tiet-san-pham/combo-qua-tang-dai-ngan",
  "chi-tiet-san-pham/sau-rieng-say-lanh-krong-pac",
  "chi-tiet-san-pham/ca-phe-honey-process-cau-dat",
  "chi-tiet-san-pham/mat-ong-rung-tay-nguyen",
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
