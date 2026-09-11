const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATABASE_PATH = path.join(DATA_DIR, "tay-nguyen-food.sqlite");
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "tnf_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const CLIENT_ROUTES = new Set(["/products", "/story", "/journal", "/contact"]);

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DATABASE_PATH);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price >= 0),
      compare_at_price INTEGER,
      badge TEXT,
      rating REAL NOT NULL DEFAULT 4.8,
      review_count INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL,
      description TEXT NOT NULL,
      origin TEXT NOT NULL,
      weight TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      tag TEXT NOT NULL,
      image TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      read_time INTEGER NOT NULL DEFAULT 5,
      published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      note TEXT,
      subtotal INTEGER NOT NULL,
      shipping_fee INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);

  const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
  if (!orderColumns.some((column) => column.name === "user_id")) {
    db.exec("ALTER TABLE orders ADD COLUMN user_id INTEGER");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  `);

  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (id, name, icon, description) VALUES (?, ?, ?, ?)",
  );
  [
    ["coffee", "Cà phê", "bi-cup-hot-fill", "Hạt cà phê đậm vị cao nguyên"],
    ["nuts", "Mắc ca", "bi-brightness-alt-high-fill", "Béo bùi, tiện dùng mỗi ngày"],
    ["honey", "Mật ong", "bi-flower1", "Ngọt thanh từ mùa hoa rừng"],
    ["durian", "Sầu riêng", "bi-stars", "Hương vị Krông Pắc theo mùa"],
    ["pepper", "Tiêu", "bi-fire", "Cay ấm, thơm rõ từng hạt"],
    ["dry", "Đặc sản khô", "bi-basket2-fill", "Dễ bảo quản, đậm vị vùng cao"],
    ["gift", "Quà tặng", "bi-gift-fill", "Gói trọn câu chuyện Tây Nguyên"],
  ].forEach((category) => insertCategory.run(...category));

  const productCount = Number(db.prepare("SELECT COUNT(*) AS count FROM products").get().count);
  if (productCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, slug, name, category_id, price, compare_at_price, badge, rating,
        review_count, image, description, origin, weight, stock, featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    [
      [
        1,
        "ca-phe-rang-moc-buon-ma-thuot",
        "Cà phê rang mộc Buôn Ma Thuột",
        "coffee",
        189000,
        219000,
        "Bán chạy",
        4.9,
        128,
        "assets/product-coffee.jpg",
        "Robusta rang mộc vị đậm, hậu ngọt, hợp pha phin hoặc máy.",
        "Buôn Ma Thuột, Đắk Lắk",
        "500g",
        42,
        1,
      ],
      [
        2,
        "arabica-cau-dat-rang-vua",
        "Arabica Cầu Đất rang vừa",
        "coffee",
        225000,
        255000,
        "Hương hoa quả",
        4.8,
        74,
        "assets/product-coffee-honey.jpg",
        "Hương cam chín và caramel nhẹ, cân bằng cho pha thủ công.",
        "Cầu Đất, Lâm Đồng",
        "340g",
        28,
        1,
      ],
      [
        3,
        "mac-ca-dak-lak-rang-moc",
        "Mắc ca Đắk Lắk rang mộc",
        "nuts",
        165000,
        185000,
        "Mới về",
        4.9,
        93,
        "assets/product-macadamia.jpg",
        "Hạt béo bùi, tách vỏ tiện dụng, không phụ gia.",
        "Ea H'leo, Đắk Lắk",
        "250g",
        36,
        1,
      ],
      [
        4,
        "mat-ong-hoa-ca-phe",
        "Mật ong hoa cà phê",
        "honey",
        220000,
        null,
        "Theo mùa",
        4.9,
        81,
        "assets/product-honey-new.png",
        "Mật ngọt thanh, thơm dịu, dùng pha trà hoặc làm quà.",
        "Cư M'gar, Đắk Lắk",
        "500ml",
        23,
        1,
      ],
      [
        5,
        "tieu-den-dak-nong",
        "Tiêu đen Đắk Nông tuyển hạt",
        "pepper",
        99000,
        null,
        "Đậm vị",
        4.8,
        66,
        "assets/product-pepper-new.png",
        "Tiêu hạt thơm ấm, phù hợp cho căn bếp hằng ngày.",
        "Đắk Song, Đắk Nông",
        "200g",
        54,
        0,
      ],
      [
        6,
        "mang-kho-gia-lai",
        "Măng khô Gia Lai",
        "dry",
        129000,
        145000,
        "Đặc sản vùng",
        4.7,
        42,
        "assets/product-dried-new.png",
        "Măng khô thơm, dễ bảo quản cho món canh và món hầm.",
        "Kbang, Gia Lai",
        "300g",
        31,
        0,
      ],
      [
        7,
        "bo-mot-nang-muoi-kien-vang",
        "Bò một nắng muối kiến vàng",
        "dry",
        319000,
        349000,
        "Quà vùng cao",
        4.9,
        57,
        "assets/product-beef-new.png",
        "Đặc sản khô đậm đà, gợi ý dùng cùng muối kiến vàng.",
        "Krông Pa, Gia Lai",
        "300g",
        16,
        0,
      ],
      [
        8,
        "combo-qua-tang-dai-ngan",
        "Combo quà tặng Đại Ngàn",
        "gift",
        499000,
        565000,
        "Gói quà sẵn",
        5.0,
        46,
        "assets/product-gift.jpg",
        "Hộp quà gồm cà phê, mắc ca, mật ong và tiêu tuyển chọn.",
        "Tây Nguyên",
        "01 hộp",
        19,
        1,
      ],
    ].forEach((product) => insertProduct.run(...product));
  }

  const insertNewProduct = db.prepare(
    "INSERT OR IGNORE INTO products (" +
      "id, slug, name, category_id, price, compare_at_price, badge, rating, " +
      "review_count, image, description, origin, weight, stock, featured" +
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  [
    [
      9,
      "sau-rieng-say-lanh-krong-pac",
      "Sầu riêng sấy lạnh Krông Pắc",
      "durian",
      235000,
      265000,
      "Đúng mùa",
      4.9,
      69,
      "assets/product-durian-new.png",
      "Miếng sầu riêng sấy lạnh thơm béo, giữ trọn vị trái cây chín.",
      "Krông Pắc, Đắk Lắk",
      "200g",
      24,
      1,
    ],
    [
      10,
      "ca-phe-honey-process-cau-dat",
      "Cà phê Honey Process Cầu Đất",
      "coffee",
      269000,
      299000,
      "Tuyển chọn",
      4.9,
      51,
      "assets/product-coffee-honey.jpg",
      "Sơ chế mật ong cho hương ngọt trái cây và hậu vị mượt mà.",
      "Cầu Đất, Lâm Đồng",
      "250g",
      18,
      1,
    ],
    [
      11,
      "mat-ong-rung-tay-nguyen",
      "Mật ong rừng Tây Nguyên",
      "honey",
      245000,
      275000,
      "Nguyên chất",
      4.8,
      88,
      "assets/product-honey-new.png",
      "Mật ong rừng hương đậm, phù hợp pha nước ấm và làm quà.",
      "Chư Păh, Gia Lai",
      "500ml",
      22,
      1,
    ],
  ].forEach((product) => insertNewProduct.run(...product));

  const updateProductImage = db.prepare("UPDATE products SET image = ? WHERE id = ?");
  [
    ["assets/product-coffee.jpg", 1],
    ["assets/product-coffee-honey.jpg", 2],
    ["assets/product-macadamia.jpg", 3],
    ["assets/product-honey-new.png", 4],
    ["assets/product-pepper-new.png", 5],
    ["assets/product-dried-new.png", 6],
    ["assets/product-beef-new.png", 7],
    ["assets/product-gift.jpg", 8],
    ["assets/product-durian-new.png", 9],
    ["assets/product-coffee-honey.jpg", 10],
    ["assets/product-honey-new.png", 11],
  ].forEach((image) => updateProductImage.run(...image));

  const postCount = Number(db.prepare("SELECT COUNT(*) AS count FROM posts").get().count);
  if (postCount === 0) {
    const insertPost = db.prepare(
      "INSERT INTO posts (id, slug, title, tag, image, excerpt, read_time, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    [
      [
        1,
        "ca-phe-buon-ma-thuot-co-gi-dac-biet",
        "Cà phê Buôn Ma Thuột có gì đặc biệt?",
        "Cà phê Tây Nguyên",
        "assets/product-coffee.jpg",
        "Từ độ cao, thổ nhưỡng đến kiểu rang, cùng khám phá lý do hạt cà phê vùng này có hậu vị riêng.",
        6,
        "2026-08-10",
      ],
      [
        2,
        "dac-san-tay-nguyen-lam-qua",
        "Đặc sản Tây Nguyên làm quà: chọn gì cho tinh tế?",
        "Cẩm nang mua đặc sản",
        "assets/product-gift.jpg",
        "Gợi ý cách chọn quà theo dịp, người nhận và ngân sách để hộp quà có câu chuyện hơn.",
        5,
        "2026-08-07",
      ],
      [
        3,
        "mac-ca-dak-lak-tu-hat-den-qua-tang",
        "Mắc ca Đắk Lắk: từ hạt béo bùi đến món quà sức khỏe",
        "Kiến thức sản phẩm",
        "assets/product-macadamia.jpg",
        "Mẹo chọn hạt, bảo quản và sử dụng mắc ca để giữ được độ giòn thơm tự nhiên.",
        4,
        "2026-08-03",
      ],
    ].forEach((post) => insertPost.run(...post));
  }

  const updatePostImage = db.prepare("UPDATE posts SET image = ? WHERE id = ?");
  [
    ["assets/product-coffee.jpg", 1],
    ["assets/product-gift.jpg", 2],
    ["assets/product-macadamia.jpg", 3],
  ].forEach((image) => updatePostImage.run(...image));
}

function toProduct(row) {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    category: row.category_id,
    categoryName: row.category_name,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null ? null : Number(row.compare_at_price),
    badge: row.badge,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    image: row.image,
    description: row.description,
    origin: row.origin,
    weight: row.weight,
    stock: Number(row.stock),
    featured: Boolean(row.featured),
  };
}

function toPost(row) {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    tag: row.tag,
    image: row.image,
    excerpt: row.excerpt,
    readTime: Number(row.read_time),
    publishedAt: row.published_at,
  };
}

function getProducts(searchParams) {
  const category = searchParams.get("category");
  const query = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort") || "featured";
  const where = [];
  const values = [];

  if (category && category !== "all") {
    where.push("p.category_id = ?");
    values.push(category);
  }

  if (query) {
    where.push("(p.name LIKE ? OR p.description LIKE ? OR p.origin LIKE ?)");
    const searchValue = `%${query}%`;
    values.push(searchValue, searchValue, searchValue);
  }

  const orderBy = {
    featured: "p.featured DESC, p.id DESC",
    "price-asc": "p.price ASC, p.id DESC",
    "price-desc": "p.price DESC, p.id DESC",
    rating: "p.rating DESC, p.review_count DESC",
    newest: "p.id DESC",
  }[sort] || "p.featured DESC, p.id DESC";

  const rows = db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${orderBy}
    `)
    .all(...values);

  return rows.map(toProduct);
}

function getProduct(identifier) {
  const condition = /^\d+$/.test(identifier) ? "p.id = ?" : "p.slug = ?";
  const row = db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE ${condition}
    `)
    .get(identifier);
  return row ? toProduct(row) : null;
}

function sendJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, "Dữ liệu gửi lên quá lớn.");
    chunks.push(chunk);
  }

  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Dữ liệu JSON không hợp lệ.");
  }
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function ensureEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Vui lòng nhập email hợp lệ.");
  }
}

function toUser(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

function cleanPassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new HttpError(400, "Mật khẩu cần từ 8 đến 128 ký tự.");
  }
  return value;
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64);
}

function getUserByEmail(email) {
  return db.prepare(`
    SELECT id, name, email, password_hash, password_salt, created_at
    FROM users
    WHERE email = ?
  `).get(email);
}

function getUserById(id) {
  const row = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(id);
  return row ? toUser(row) : null;
}

function registerUser(payload) {
  const name = cleanText(payload.name, 80);
  const email = cleanText(payload.email, 120).toLowerCase();
  const password = cleanPassword(payload.password);
  if (!name) throw new HttpError(400, "Vui lòng nhập họ và tên.");
  ensureEmail(email);
  if (getUserByEmail(email)) throw new HttpError(409, "Email này đã được đăng ký. Hãy đăng nhập để tiếp tục.");

  const salt = randomBytes(16).toString("base64");
  const passwordHash = hashPassword(password, salt).toString("base64");
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)")
    .run(name, email, passwordHash, salt);
  return getUserById(Number(result.lastInsertRowid));
}

function authenticateUser(payload) {
  const email = cleanText(payload.email, 120).toLowerCase();
  const password = cleanPassword(payload.password);
  ensureEmail(email);
  const user = getUserByEmail(email);
  if (!user) throw new HttpError(401, "Email hoặc mật khẩu chưa chính xác.");

  const expected = Buffer.from(user.password_hash, "base64");
  const received = hashPassword(password, user.password_salt);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new HttpError(401, "Email hoặc mật khẩu chưa chính xác.");
  }
  return toUser(user);
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function createSession(userId) {
  const now = Date.now();
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM user_sessions WHERE expires_at <= ?").run(now);
  db.prepare("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, now + SESSION_MAX_AGE_SECONDS * 1000);
  return token;
}

function getAuthenticatedUser(request) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length > 128) return null;
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.created_at
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, Date.now());
  return row ? toUser(row) : null;
}

function requireAuthenticatedUser(request) {
  const user = getAuthenticatedUser(request);
  if (!user) throw new HttpError(401, "Vui lòng đăng nhập để xem đơn hàng của bạn.");
  return user;
}

function deleteSession(request) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (token) db.prepare("DELETE FROM user_sessions WHERE token = ?").run(token);
}

function toOrderSummary(row) {
  return {
    code: row.code,
    status: row.status,
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    total: Number(row.total),
    itemCount: Number(row.item_count),
    unitCount: Number(row.unit_count),
    createdAt: row.created_at,
  };
}

function getOrdersForUser(userId) {
  const rows = db.prepare(`
    SELECT o.code, o.status, o.subtotal, o.shipping_fee, o.total, o.created_at,
      COUNT(oi.id) AS item_count, COALESCE(SUM(oi.quantity), 0) AS unit_count
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC, o.id DESC
  `).all(userId);
  return rows.map(toOrderSummary);
}

function getOrderForUser(userId, code) {
  const row = db.prepare(`
    SELECT id, code, customer_name, email, phone, address, note, subtotal, shipping_fee, total, status, created_at
    FROM orders
    WHERE user_id = ? AND code = ?
  `).get(userId, code);
  if (!row) throw new HttpError(404, "Không tìm thấy đơn hàng này trong tài khoản của bạn.");

  const items = db.prepare(`
    SELECT product_id, product_name, unit_price, quantity, line_total
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `).all(row.id).map((item) => ({
    productId: Number(item.product_id),
    name: item.product_name,
    unitPrice: Number(item.unit_price),
    quantity: Number(item.quantity),
    lineTotal: Number(item.line_total),
  }));

  return {
    code: row.code,
    status: row.status,
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    total: Number(row.total),
    createdAt: row.created_at,
    customer: {
      name: row.customer_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
    },
    note: row.note || "",
    items,
  };
}

function createOrder(payload, userId = null) {
  const customer = payload.customer || {};
  const name = cleanText(customer.name, 80);
  const email = cleanText(customer.email, 120).toLowerCase();
  const phone = cleanText(customer.phone, 25);
  const address = cleanText(customer.address, 260);
  const note = cleanText(payload.note, 500);

  if (!name || !phone || !address) {
    throw new HttpError(400, "Vui lòng điền họ tên, số điện thoại và địa chỉ nhận hàng.");
  }
  ensureEmail(email);

  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 20) {
    throw new HttpError(400, "Giỏ hàng cần có từ 1 đến 20 sản phẩm.");
  }

  const quantities = new Map();
  payload.items.forEach((item) => {
    const id = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new HttpError(400, "Số lượng sản phẩm không hợp lệ.");
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  });

  const ids = [...quantities.keys()];
  const products = db
    .prepare(`SELECT id, name, price, stock FROM products WHERE id IN (${ids.map(() => "?").join(", ")})`)
    .all(...ids);

  if (products.length !== ids.length) throw new HttpError(400, "Có sản phẩm không còn tồn tại.");

  const lines = products.map((product) => {
    const quantity = quantities.get(Number(product.id));
    if (quantity > Number(product.stock)) {
      throw new HttpError(400, `${product.name} không còn đủ hàng.`);
    }
    return {
      productId: Number(product.id),
      productName: product.name,
      unitPrice: Number(product.price),
      quantity,
      lineTotal: Number(product.price) * quantity,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shippingFee = subtotal >= 399000 ? 0 : 30000;
  const total = subtotal + shippingFee;
  const code = `TNF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;

  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare(`
        INSERT INTO orders (user_id, code, customer_name, email, phone, address, note, subtotal, shipping_fee, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(userId, code, name, email, phone, address, note || null, subtotal, shippingFee, total);

    const orderId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const reduceStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    lines.forEach((line) => {
      insertItem.run(orderId, line.productId, line.productName, line.unitPrice, line.quantity, line.lineTotal);
      reduceStock.run(line.quantity, line.productId);
    });
    db.exec("COMMIT");
    return { code, subtotal, shippingFee, total, itemCount: lines.length };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function handleApi(request, response, url) {
  const { pathname, searchParams } = url;
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    response.writeHead(204, { Allow: "GET, POST, OPTIONS" });
    response.end();
    return;
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    sendJson(response, 200, { user: getAuthenticatedUser(request) });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const user = registerUser(await readJson(request));
    const token = createSession(user.id);
    sendJson(
      response,
      201,
      { message: "Tài khoản đã được tạo. Chào mừng bạn đến với Tây Nguyên Food!", user },
      { "Set-Cookie": sessionCookie(token) },
    );
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const user = authenticateUser(await readJson(request));
    const token = createSession(user.id);
    sendJson(
      response,
      200,
      { message: "Đăng nhập thành công. Rất vui được gặp lại bạn!", user },
      { "Set-Cookie": sessionCookie(token) },
    );
    return;
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    deleteSession(request);
    sendJson(response, 200, { message: "Bạn đã đăng xuất an toàn." }, { "Set-Cookie": sessionCookie("", 0) });
    return;
  }

  if (method === "GET" && pathname === "/api/health") {
    const productCount = Number(db.prepare("SELECT COUNT(*) AS count FROM products").get().count);
    sendJson(response, 200, { ok: true, database: "sqlite", productCount });
    return;
  }

  if (method === "GET" && pathname === "/api/categories") {
    const categories = db.prepare("SELECT * FROM categories ORDER BY rowid").all();
    sendJson(response, 200, { items: categories });
    return;
  }

  if (method === "GET" && pathname === "/api/products") {
    sendJson(response, 200, { items: getProducts(searchParams) });
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/products/")) {
    const identifier = decodeURIComponent(pathname.slice("/api/products/".length));
    const product = getProduct(identifier);
    if (!product) throw new HttpError(404, "Không tìm thấy sản phẩm.");
    sendJson(response, 200, { item: product });
    return;
  }

  if (method === "GET" && pathname === "/api/posts") {
    const posts = db.prepare("SELECT * FROM posts ORDER BY published_at DESC").all().map(toPost);
    sendJson(response, 200, { items: posts });
    return;
  }

  if (method === "GET" && pathname === "/api/orders/mine") {
    const user = requireAuthenticatedUser(request);
    sendJson(response, 200, { items: getOrdersForUser(user.id) });
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/orders/")) {
    const user = requireAuthenticatedUser(request);
    const code = cleanText(decodeURIComponent(pathname.slice("/api/orders/".length)), 80);
    if (!code) throw new HttpError(400, "Mã đơn hàng không hợp lệ.");
    sendJson(response, 200, { item: getOrderForUser(user.id, code) });
    return;
  }

  if (method === "POST" && pathname === "/api/contact") {
    const body = await readJson(request);
    const name = cleanText(body.name, 80);
    const email = cleanText(body.email, 120).toLowerCase();
    const message = cleanText(body.message, 1500);
    if (!name || !message) throw new HttpError(400, "Vui lòng nhập họ tên và nội dung liên hệ.");
    ensureEmail(email);
    db.prepare("INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)").run(name, email, message);
    sendJson(response, 201, { message: "Đã ghi nhận liên hệ. Tây Nguyên Food sẽ phản hồi sớm." });
    return;
  }

  if (method === "POST" && pathname === "/api/newsletter") {
    const body = await readJson(request);
    const email = cleanText(body.email, 120).toLowerCase();
    ensureEmail(email);
    db.prepare(`
      INSERT INTO newsletter_subscribers (email) VALUES (?)
      ON CONFLICT(email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `).run(email);
    sendJson(response, 201, { message: "Bạn đã đăng ký nhận câu chuyện mới từ Tây Nguyên Food." });
    return;
  }

  if (method === "POST" && pathname === "/api/orders") {
    const user = getAuthenticatedUser(request);
    const order = createOrder(await readJson(request), user?.id || null);
    sendJson(response, 201, { message: "Đặt hàng thành công. Đây là đơn hàng demo, chưa kết nối cổng thanh toán.", order });
    return;
  }

  throw new HttpError(404, "Không tìm thấy API.");
}

function serveStatic(response, pathname) {
  const relativePath = pathname === "/" || CLIENT_ROUTES.has(pathname)
    ? "index.html"
    : decodeURIComponent(pathname).replace(/^\/+/, "");
  if (relativePath.startsWith("data/")) throw new HttpError(403, "Không được truy cập dữ liệu hệ thống.");

  const filePath = path.resolve(ROOT, relativePath);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) && filePath !== ROOT) {
    throw new HttpError(403, "Đường dẫn không hợp lệ.");
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    throw new HttpError(404, "Không tìm thấy tệp.");
  }

  if (!stat.isFile()) throw new HttpError(404, "Không tìm thấy tệp.");

  const contentType = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(filePath).pipe(response);
}

initializeDatabase();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else {
      serveStatic(response, url.pathname);
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Máy chủ gặp lỗi không mong muốn.";
    if (!response.headersSent) sendJson(response, status, { error: message });
    else response.end();
    if (status === 500) console.error(error);
  }
});

server.listen(PORT, () => {
  console.log(`Tây Nguyên Food đang chạy tại http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
