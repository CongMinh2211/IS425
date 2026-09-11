const state = {
  products: [],
  categories: [],
  posts: [],
  cart: readStorage("tnf-cart", []),
  wishlist: new Set(readStorage("tnf-wishlist", [])),
  category: "all",
  query: "",
  sort: "featured",
  showingWishlist: false,
  quickViewProductId: null,
  user: null,
  orders: [],
  ordersLoading: false,
  authMode: "login",
  dataSource: "sqlite",
  lastFocusedElement: null,
};

const fallbackData = window.TNF_FALLBACK_DATA || { categories: [], products: [], posts: [] };

const elements = {
  categoryStrip: document.querySelector("#categoryStrip"),
  categoryFilters: document.querySelector("#categoryFilters"),
  productGrid: document.querySelector("#productGrid"),
  postGrid: document.querySelector("#postGrid"),
  resultsMeta: document.querySelector("#resultsMeta"),
  productSearch: document.querySelector("#productSearch"),
  clearSearch: document.querySelector("#clearSearch"),
  sortSelect: document.querySelector("#sortSelect"),
  wishlistCount: document.querySelector("#wishlistCount"),
  cartCount: document.querySelector("#cartCount"),
  cartSummary: document.querySelector("#cartSummary"),
  wishlistButton: document.querySelector("#wishlistButton"),
  wishlistTextButton: document.querySelector("#wishlistTextButton"),
  accountButton: document.querySelector("#accountButton"),
  accountCopy: document.querySelector("#accountCopy"),
  cartButton: document.querySelector("#cartButton"),
  cartDrawer: document.querySelector("#cartDrawer"),
  cartItems: document.querySelector("#cartItems"),
  cartProgress: document.querySelector("#cartProgress"),
  cartSummaryPanel: document.querySelector("#cartSummaryPanel"),
  checkoutButton: document.querySelector("#checkoutButton"),
  clearCartButton: document.querySelector("#clearCartButton"),
  productDialog: document.querySelector("#productDialog"),
  quickViewContent: document.querySelector("#quickViewContent"),
  checkoutDialog: document.querySelector("#checkoutDialog"),
  checkoutForm: document.querySelector("#checkoutForm"),
  checkoutOrderPreview: document.querySelector("#checkoutOrderPreview"),
  checkoutStatus: document.querySelector("#checkoutStatus"),
  accountDialog: document.querySelector("#accountDialog"),
  accountDialogContent: document.querySelector("#accountDialogContent"),
  orderDialog: document.querySelector("#orderDialog"),
  orderDetailContent: document.querySelector("#orderDetailContent"),
  contactForm: document.querySelector("#contactForm"),
  contactStatus: document.querySelector("#contactStatus"),
  newsletterForm: document.querySelector("#newsletterForm"),
  newsletterStatus: document.querySelector("#newsletterStatus"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toastMessage"),
  menuToggle: document.querySelector("#menuToggle"),
  primaryNav: document.querySelector("#primaryNav"),
  sectionLinks: Array.from(document.querySelectorAll("[data-section-link]")),
};

function readStorage(key, fallback) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key));
    return stored ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function saveLocalRecord(key, value) {
  const records = readStorage(key, []);
  records.unshift({ ...value, createdAt: new Date().toISOString() });
  writeStorage(key, records.slice(0, 30));
}

function escapeHTML(value) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => replacements[character]);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long" }).format(new Date(value));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa tạo";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function imageHTML(src, alt, loading = "lazy") {
  return "<img src='" + escapeHTML(src) + "' alt='" + escapeHTML(alt) + "' loading='" + loading + "' data-image-fallback />";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Không thể kết nối với dữ liệu lúc này.");
  return payload;
}

function getProduct(productId) {
  return state.products.find((product) => product.id === Number(productId));
}

function getCartLines() {
  return state.cart
    .map((item) => {
      const product = getProduct(item.productId);
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter(Boolean);
}

function getCartTotals() {
  const lines = getCartLines();
  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const shipping = lines.length === 0 ? 0 : subtotal >= 399000 ? 0 : 30000;
  return { lines, subtotal, shipping, total: subtotal + shipping };
}

function sanitizeClientState() {
  const productIds = new Set(state.products.map((product) => product.id));
  state.cart = state.cart
    .map((item) => ({
      productId: Number(item?.productId),
      quantity: Math.min(10, Math.max(1, Number(item?.quantity) || 1)),
    }))
    .filter((item) => productIds.has(item.productId));
  state.wishlist = new Set([...state.wishlist].map(Number).filter((id) => productIds.has(id)));
  writeStorage("tnf-cart", state.cart);
  writeStorage("tnf-wishlist", [...state.wishlist]);
}

function persistCart() {
  writeStorage("tnf-cart", state.cart);
}

function persistWishlist() {
  writeStorage("tnf-wishlist", [...state.wishlist]);
}

function showToast(message, type = "success") {
  elements.toastMessage.textContent = message;
  elements.toast.classList.toggle("is-error", type === "error");
  elements.toast.classList.add("is-show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("is-show"), 3400);
}

function setFormStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "<i class='bi bi-arrow-repeat'></i> " + busyLabel;
    return;
  }
  button.disabled = false;
  if (button.dataset.originalLabel) button.innerHTML = button.dataset.originalLabel;
}

function isStaticMode() {
  return state.dataSource === "fallback";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function ensureClientEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Vui lòng nhập email hợp lệ.");
}

function ensureClientPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("Mật khẩu cần từ 8 đến 128 ký tự.");
  }
}

function toSafeUser(user) {
  if (!user || !user.id || !user.name || !user.email) return null;
  return {
    id: user.id,
    name: String(user.name).trim(),
    email: normalizeEmail(user.email),
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

function localPasswordHash(password) {
  let hash = 2166136261;
  for (let index = 0; index < password.length; index += 1) {
    hash ^= password.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "demo-" + (hash >>> 0).toString(16) + "-" + password.length;
}

function restoreLocalUser() {
  const session = toSafeUser(readStorage("tnf-local-current-user", null));
  if (!session) return null;
  const exists = readStorage("tnf-local-users", []).some((user) => String(user.id) === String(session.id));
  return exists ? session : null;
}

function registerLocalUser(data) {
  const name = String(data.name || "").trim().slice(0, 80);
  const email = normalizeEmail(data.email);
  const password = String(data.password || "");
  if (!name) throw new Error("Vui lòng nhập họ và tên.");
  ensureClientEmail(email);
  ensureClientPassword(password);

  const users = readStorage("tnf-local-users", []);
  if (users.some((user) => normalizeEmail(user.email) === email)) {
    throw new Error("Email này đã được đăng ký trên thiết bị. Hãy đăng nhập để tiếp tục.");
  }

  const user = {
    id: "local-" + Date.now().toString(36),
    name,
    email,
    createdAt: new Date().toISOString(),
  };
  users.push({ ...user, passwordHash: localPasswordHash(password) });
  writeStorage("tnf-local-users", users.slice(-30));
  writeStorage("tnf-local-current-user", user);
  return user;
}

function loginLocalUser(data) {
  const email = normalizeEmail(data.email);
  const password = String(data.password || "");
  ensureClientEmail(email);
  ensureClientPassword(password);
  const user = readStorage("tnf-local-users", []).find((item) => normalizeEmail(item.email) === email);
  if (!user || user.passwordHash !== localPasswordHash(password)) {
    throw new Error("Email hoặc mật khẩu chưa chính xác.");
  }
  const safeUser = toSafeUser(user);
  writeStorage("tnf-local-current-user", safeUser);
  return safeUser;
}

function getLocalOrdersForUser() {
  if (!state.user) return [];
  return readStorage("tnf-local-orders", [])
    .filter((order) => String(order.userId || "") === String(state.user.id))
    .map((order) => ({
      code: order.code,
      status: order.status || "pending",
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shippingFee || 0),
      total: Number(order.total || 0),
      itemCount: Array.isArray(order.items) ? order.items.length : 0,
      unitCount: Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0,
      createdAt: order.createdAt,
    }))
    .sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)));
}

function getLocalOrderForUser(code) {
  if (!state.user) return null;
  const order = readStorage("tnf-local-orders", []).find(
    (item) => item.code === code && String(item.userId || "") === String(state.user.id),
  );
  if (!order) return null;
  return {
    code: order.code,
    status: order.status || "pending",
    subtotal: Number(order.subtotal || 0),
    shippingFee: Number(order.shippingFee || 0),
    total: Number(order.total || 0),
    createdAt: order.createdAt,
    customer: order.customer || {},
    note: order.note || "",
    items: (order.items || []).map((item) => ({
      productId: Number(item.productId),
      name: item.name || getProduct(item.productId)?.name || "Sản phẩm Tây Nguyên",
      unitPrice: Number(item.unitPrice || getProduct(item.productId)?.price || 0),
      quantity: Number(item.quantity || 0),
      lineTotal: Number(item.lineTotal || 0),
    })),
  };
}

function orderStatusMeta(status) {
  const statusMap = {
    pending: { label: "Chờ xác nhận", icon: "bi-hourglass-split", tone: "pending" },
    confirmed: { label: "Đã xác nhận", icon: "bi-patch-check-fill", tone: "confirmed" },
    shipping: { label: "Đang giao", icon: "bi-truck", tone: "shipping" },
    completed: { label: "Hoàn thành", icon: "bi-check2-circle", tone: "completed" },
    cancelled: { label: "Đã hủy", icon: "bi-x-circle", tone: "cancelled" },
  };
  return statusMap[status] || statusMap.pending;
}

function renderAccountButton() {
  if (!elements.accountButton || !elements.accountCopy) return;
  const user = state.user;
  elements.accountButton.classList.toggle("is-authenticated", Boolean(user));
  elements.accountButton.setAttribute("aria-label", user ? "Mở tài khoản của " + user.name : "Đăng nhập hoặc đăng ký tài khoản");
  elements.accountCopy.innerHTML = user
    ? "<b>" + escapeHTML(user.name.split(/\s+/).at(-1)) + "</b><small>Đơn hàng của tôi</small>"
    : "<b>Tài khoản</b><small>Đăng nhập</small>";
}

function orderSummaryHTML(order) {
  const status = orderStatusMeta(order.status);
  return [
    "<button class='order-summary-card' type='button' data-action='open-order-detail' data-order-code='", escapeHTML(order.code), "'>",
    "<span class='order-summary-top'><strong>", escapeHTML(order.code), "</strong><span class='order-status is-", status.tone, "'><i class='bi ", status.icon, "'></i> ", status.label, "</span></span>",
    "<span class='order-summary-bottom'><span>", order.unitCount, " sản phẩm · ", escapeHTML(formatDateTime(order.createdAt)), "</span><b>", formatPrice(order.total), " <i class='bi bi-arrow-right'></i></b></span>",
    "</button>",
  ].join("");
}

function renderAccountDialog() {
  if (!elements.accountDialogContent) return;
  const staticNote = isStaticMode()
    ? "<p class='account-mode-note'><i class='bi bi-device-ssd-fill'></i> Bản HTML lưu tài khoản và đơn demo trên chính thiết bị này.</p>"
    : "<p class='account-mode-note'><i class='bi bi-shield-check'></i> Phiên đăng nhập được bảo vệ bằng cookie; mật khẩu được mã hóa trong CSDL.</p>";

  if (!state.user) {
    const isRegister = state.authMode === "register";
    elements.accountDialogContent.innerHTML = [
      "<div class='account-shell'>",
      "<aside class='account-aside'><span class='account-aside-mark'><i class='bi bi-flower1'></i></span><p class='eyebrow light'>Một tài khoản, nhiều tiện ích</p>",
      "<h2>Giữ lại những hương vị bạn yêu.</h2><p>Đăng nhập để theo dõi đơn hàng, lưu địa chỉ nhận quà và quay lại nhanh hơn.</p>",
      "<ul><li><i class='bi bi-bag-check-fill'></i> Xem chi tiết từng đơn</li><li><i class='bi bi-heart-fill'></i> Giữ sản phẩm yêu thích</li><li><i class='bi bi-box2-heart-fill'></i> Đặt lại món quen thuộc</li></ul></aside>",
      "<section class='auth-panel'><p class='eyebrow'><i class='bi bi-person-heart'></i> Chào bạn</p><h2 id='accountDialogTitle'>", isRegister ? "Tạo tài khoản mới" : "Đăng nhập", "</h2>",
      "<div class='auth-tabs' role='tablist' aria-label='Tài khoản'><button type='button' class='", isRegister ? "" : "is-active", "' data-action='set-auth-mode' data-auth-mode='login' aria-selected='", String(!isRegister), "'>Đăng nhập</button><button type='button' class='", isRegister ? "is-active" : "", "' data-action='set-auth-mode' data-auth-mode='register' aria-selected='", String(isRegister), "'>Đăng ký</button></div>",
      "<form class='auth-form' id='loginForm'", isRegister ? " hidden" : "", "><label>Email<input id='loginEmail' name='email' type='email' autocomplete='email' required maxlength='120' placeholder='email@cuaban.com' /></label><label>Mật khẩu<input name='password' type='password' autocomplete='current-password' required minlength='8' maxlength='128' placeholder='Tối thiểu 8 ký tự' /></label><button class='button button-forest form-submit' type='submit'><i class='bi bi-box-arrow-in-right'></i> Đăng nhập</button></form>",
      "<form class='auth-form' id='registerForm'", isRegister ? "" : " hidden", "><label>Họ và tên<input name='name' type='text' autocomplete='name' required maxlength='80' placeholder='Nguyễn Minh Anh' /></label><label>Email<input name='email' type='email' autocomplete='email' required maxlength='120' placeholder='email@cuaban.com' /></label><label>Mật khẩu<input name='password' type='password' autocomplete='new-password' required minlength='8' maxlength='128' placeholder='Tối thiểu 8 ký tự' /></label><label>Nhập lại mật khẩu<input name='confirmPassword' type='password' autocomplete='new-password' required minlength='8' maxlength='128' placeholder='Nhập lại mật khẩu' /></label><button class='button button-forest form-submit' type='submit'><i class='bi bi-person-plus-fill'></i> Tạo tài khoản</button></form>",
      "<p class='form-note' id='authStatus' aria-live='polite'></p>", staticNote,
      "</section></div>",
    ].join("");
    return;
  }

  const user = state.user;
  const ordersContent = state.ordersLoading
    ? "<div class='orders-loading'><i class='bi bi-arrow-repeat'></i> Đang tải đơn hàng...</div>"
    : state.orders.length
      ? state.orders.map(orderSummaryHTML).join("")
      : "<div class='orders-empty'><i class='bi bi-bag-heart-fill'></i><div><strong>Chưa có đơn nào trong tài khoản.</strong><span>Chọn một món đặc sản để bắt đầu hành trình.</span></div><button class='text-link' type='button' data-action='continue-shopping'>Khám phá sản phẩm <i class='bi bi-arrow-down-right'></i></button></div>";

  elements.accountDialogContent.innerHTML = [
    "<div class='account-shell account-shell-profile'>",
    "<aside class='account-aside'><span class='account-aside-mark'><i class='bi bi-person-check-fill'></i></span><p class='eyebrow light'>Tài khoản của bạn</p><h2>Chào, ", escapeHTML(user.name.split(/\s+/).at(-1)), ".</h2><p>Mọi đơn đặt hàng khi bạn đăng nhập sẽ được lưu tại đây để tiện theo dõi.</p><ul><li><i class='bi bi-shield-check'></i> Thông tin đơn hàng riêng tư</li><li><i class='bi bi-clock-history'></i> Tra cứu bất cứ lúc nào</li></ul></aside>",
    "<section class='account-panel'><div class='account-panel-head'><div><p class='eyebrow'><i class='bi bi-bag-check-fill'></i> Lịch sử mua sắm</p><h2 id='accountDialogTitle'>Đơn hàng của tôi</h2></div><button class='round-action refresh-orders' type='button' data-action='refresh-orders' aria-label='Làm mới đơn hàng'><i class='bi bi-arrow-clockwise'></i></button></div>",
    "<div class='account-user-meta'><span class='account-avatar'>", escapeHTML(user.name.charAt(0).toUpperCase()), "</span><div><strong>", escapeHTML(user.name), "</strong><span>", escapeHTML(user.email), "</span></div><i class='bi bi-patch-check-fill'></i></div>",
    "<div class='account-orders'>", ordersContent, "</div>",
    "<button class='logout-button' type='button' data-action='logout'><i class='bi bi-box-arrow-right'></i> Đăng xuất</button>", staticNote,
    "</section></div>",
  ].join("");
}

function renderOrderDetail(order) {
  const status = orderStatusMeta(order.status);
  const items = (order.items || []).map((item) => [
    "<article class='order-item'><div><strong>", escapeHTML(item.name), "</strong><span>", item.quantity, " x ", formatPrice(item.unitPrice), "</span></div><b>", formatPrice(item.lineTotal), "</b></article>",
  ].join("")).join("");
  elements.orderDetailContent.innerHTML = [
    "<div class='order-detail'><div class='order-detail-heading'><p class='eyebrow'><i class='bi bi-receipt-cutoff'></i> Chi tiết đơn hàng</p><h2 id='orderDialogTitle'>", escapeHTML(order.code), "</h2><div class='order-detail-status'><span class='order-status is-", status.tone, "'><i class='bi ", status.icon, "'></i> ", status.label, "</span><span>", escapeHTML(formatDateTime(order.createdAt)), "</span></div></div>",
    "<div class='order-item-list'>", items, "</div>",
    "<div class='order-detail-total'><div><span>Tạm tính</span><b>", formatPrice(order.subtotal), "</b></div><div><span>Giao hàng</span><b>", order.shippingFee ? formatPrice(order.shippingFee) : "Miễn phí", "</b></div><div class='grand-total'><span>Tổng thanh toán</span><b>", formatPrice(order.total), "</b></div></div>",
    "<div class='delivery-detail'><div><i class='bi bi-geo-alt-fill'></i><span>Giao đến</span></div><strong>", escapeHTML(order.customer?.name || ""), "</strong><p>", escapeHTML(order.customer?.phone || ""), " · ", escapeHTML(order.customer?.address || ""), "</p>", order.note ? "<p class='order-note'><i class='bi bi-chat-left-text-fill'></i> " + escapeHTML(order.note) + "</p>" : "", "</div>",
    "<button class='text-link order-back' type='button' data-action='back-to-account'><i class='bi bi-arrow-left'></i> Quay lại đơn hàng của tôi</button></div>",
  ].join("");
}

async function refreshOrders() {
  if (!state.user) {
    state.orders = [];
    return [];
  }
  state.ordersLoading = true;
  if (elements.accountDialog?.open) renderAccountDialog();
  try {
    state.orders = isStaticMode()
      ? getLocalOrdersForUser()
      : (await api("/api/orders/mine")).items;
    return state.orders;
  } finally {
    state.ordersLoading = false;
  }
}

async function openAccount() {
  renderAccountDialog();
  openDialog(elements.accountDialog);
  if (state.user) {
    try {
      await refreshOrders();
    } catch (error) {
      showToast(error.message, "error");
    }
    renderAccountDialog();
  }
  window.setTimeout(() => {
    const focusTarget = state.user
      ? elements.accountDialog.querySelector(".refresh-orders")
      : elements.accountDialog.querySelector("#loginEmail, input[name=name]");
    focusTarget?.focus();
  }, 100);
}

async function openOrderDetail(code) {
  if (!state.user) {
    showToast("Hãy đăng nhập để xem chi tiết đơn hàng.", "error");
    return;
  }
  if (elements.accountDialog.open) closeDialog(elements.accountDialog);
  elements.orderDetailContent.innerHTML = "<div class='account-loading'><i class='bi bi-arrow-repeat'></i><span>Đang tải đơn hàng...</span></div>";
  openDialog(elements.orderDialog);
  try {
    const order = isStaticMode()
      ? getLocalOrderForUser(code)
      : (await api("/api/orders/" + encodeURIComponent(code))).item;
    if (!order) throw new Error("Không tìm thấy đơn hàng này trên thiết bị.");
    renderOrderDetail(order);
  } catch (error) {
    elements.orderDetailContent.innerHTML = "<div class='orders-empty'><i class='bi bi-exclamation-circle'></i><div><strong>Chưa mở được đơn hàng.</strong><span>" + escapeHTML(error.message) + "</span></div></div>";
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector("button[type=submit]");
  const status = document.querySelector("#authStatus");
  const data = Object.fromEntries(new FormData(form));
  setFormStatus(status, "");
  setButtonBusy(submit, true, "Đang đăng nhập...");
  try {
    const response = isStaticMode()
      ? { user: loginLocalUser(data), message: "Đã đăng nhập trên thiết bị này." }
      : await api("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
    state.user = toSafeUser(response.user);
    state.orders = [];
    renderAll();
    await refreshOrders();
    renderAccountDialog();
    showToast(response.message || "Đăng nhập thành công.");
  } catch (error) {
    setFormStatus(status, error.message, true);
  } finally {
    setButtonBusy(submit, false);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector("button[type=submit]");
  const status = document.querySelector("#authStatus");
  const data = Object.fromEntries(new FormData(form));
  setFormStatus(status, "");
  if (data.password !== data.confirmPassword) {
    setFormStatus(status, "Mật khẩu nhập lại chưa khớp.", true);
    return;
  }
  setButtonBusy(submit, true, "Đang tạo tài khoản...");
  try {
    const response = isStaticMode()
      ? { user: registerLocalUser(data), message: "Đã tạo tài khoản trên thiết bị này." }
      : await api("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
    state.user = toSafeUser(response.user);
    state.orders = [];
    renderAll();
    await refreshOrders();
    renderAccountDialog();
    showToast(response.message || "Tạo tài khoản thành công.");
  } catch (error) {
    setFormStatus(status, error.message, true);
  } finally {
    setButtonBusy(submit, false);
  }
}

async function logoutUser() {
  try {
    if (isStaticMode()) {
      window.localStorage.removeItem("tnf-local-current-user");
    } else {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    }
    state.user = null;
    state.orders = [];
    state.authMode = "login";
    renderAll();
    renderAccountDialog();
    showToast("Bạn đã đăng xuất an toàn.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function visibleProducts() {
  const search = normalizeText(state.query);
  const products = state.products.filter((product) => {
    const matchesCategory = state.category === "all" || product.category === state.category;
    const matchesWishlist = !state.showingWishlist || state.wishlist.has(product.id);
    const searchable = normalizeText(product.name + " " + product.description + " " + product.origin + " " + product.categoryName);
    return matchesCategory && matchesWishlist && (!search || searchable.includes(search));
  });

  return [...products].sort((a, b) => {
    if (state.sort === "price-asc") return a.price - b.price;
    if (state.sort === "price-desc") return b.price - a.price;
    if (state.sort === "rating") return b.rating - a.rating || b.reviewCount - a.reviewCount;
    if (state.sort === "newest") return b.id - a.id;
    return Number(b.featured) - Number(a.featured) || b.rating - a.rating || b.id - a.id;
  });
}

function renderCategories() {
  elements.categoryStrip.innerHTML = state.categories
    .map((category) => [
      "<a class='category-link' href='#products' data-category='", escapeHTML(category.id), "'>",
      "<i class='bi ", escapeHTML(category.icon), "'></i>",
      "<span><strong>", escapeHTML(category.name), "</strong><small>", escapeHTML(category.description), "</small></span>",
      "</a>",
    ].join(""))
    .join("");

  const allActive = state.category === "all" && !state.showingWishlist;
  const buttons = [
    "<button class='filter-chip ", allActive ? "is-active" : "", "' type='button' data-category='all' aria-pressed='", String(allActive), "'>Tất cả</button>",
  ];
  state.categories.forEach((category) => {
    const active = state.category === category.id && !state.showingWishlist;
    buttons.push([
      "<button class='filter-chip ", active ? "is-active" : "", "' type='button' data-category='", escapeHTML(category.id), "' aria-pressed='", String(active), "'>",
      "<i class='bi ", escapeHTML(category.icon), "'></i> ", escapeHTML(category.name), "</button>",
    ].join(""));
  });
  elements.categoryFilters.innerHTML = buttons.join("");
}

function productCardHTML(product) {
  const saved = state.wishlist.has(product.id);
  const stockLabel = product.stock <= 8 ? "Sắp hết" : product.weight;
  const comparePrice = product.compareAtPrice ? "<del class='compare-price'>" + formatPrice(product.compareAtPrice) + "</del>" : "";
  const heartIcon = saved ? "-fill" : "";
  const savedClass = saved ? " is-saved" : "";
  const wishLabel = saved ? "Bỏ lưu" : "Lưu";
  const detailHref = "/chi-tiet-san-pham/" + encodeURIComponent(product.slug || product.id);

  return [
    "<article class='product-card'>",
    "<div class='product-image'>",
    imageHTML(product.image, product.name),
    "<span class='product-badge'>", escapeHTML(product.badge || "Tuyển chọn"), "</span>",
    "<span class='stock-badge'>", escapeHTML(stockLabel), "</span>",
    "<button class='wishlist-control", savedClass, "' type='button' data-action='toggle-wishlist' data-product-id='", product.id, "' aria-label='", wishLabel, " ", escapeHTML(product.name), "' aria-pressed='", String(saved), "'>",
    "<i class='bi bi-heart", heartIcon, "'></i></button>",
    "</div>",
    "<div class='product-content'>",
    "<div class='product-topline'><span class='product-origin'><i class='bi bi-geo-alt-fill'></i> ", escapeHTML(product.origin), "</span>",
    "<span class='rating'><i class='bi bi-star-fill'></i> ", product.rating.toFixed(1), " (", product.reviewCount, ")</span></div>",
    "<h3 class='product-title'>", escapeHTML(product.name), "</h3>",
    "<p class='product-description'>", escapeHTML(product.description), "</p>",
    "<div class='product-price-row'><span class='price-stack'><strong class='price'>", formatPrice(product.price), "</strong>", comparePrice, "</span>",
    "<span class='product-weight'>", escapeHTML(product.weight), "</span></div>",
    "<div class='product-actions'>",
    "<button class='card-button' type='button' data-action='add-cart' data-product-id='", product.id, "'><i class='bi bi-bag-plus-fill'></i> Thêm giỏ</button>",
    "<a class='card-button secondary detail-link' href='", detailHref, "' data-action='quick-view' data-product-id='", product.id, "' aria-label='Xem chi tiết ", escapeHTML(product.name), "' title='Mở link chi tiết sản phẩm'><i class='bi bi-arrow-up-right'></i></a>",
    "</div></div></article>",
  ].join("");
}

function renderProducts() {
  const products = visibleProducts();
  const currentCategory = state.categories.find((category) => category.id === state.category);
  const source = state.showingWishlist
    ? "đã lưu"
    : state.category === "all"
      ? "đặc sản"
      : (currentCategory?.name || "sản phẩm").toLowerCase();

  elements.resultsMeta.textContent = products.length
    ? "Có " + products.length + " " + source + " phù hợp với lựa chọn của bạn."
    : "Chưa tìm thấy sản phẩm phù hợp.";
  if (state.dataSource === "fallback") {
    elements.resultsMeta.textContent += " Đang hiển thị dữ liệu demo trên thiết bị.";
  }

  if (products.length === 0) {
    const title = state.showingWishlist ? "Wishlist đang trống." : "Chưa có kết quả phù hợp.";
    const description = state.showingWishlist
      ? "Hãy chạm vào biểu tượng trái tim ở sản phẩm bạn yêu thích."
      : "Thử đổi từ khóa, danh mục hoặc xem lại toàn bộ đặc sản.";
    elements.productGrid.innerHTML = [
      "<div class='empty-state'><div><i class='bi bi-search-heart'></i><h3>", title, "</h3><p>", description, "</p>",
      "<button class='button button-forest' type='button' data-action='reset-filters'>Xem tất cả sản phẩm</button>",
      "</div></div>",
    ].join("");
    return;
  }
  elements.productGrid.innerHTML = products.map(productCardHTML).join("");
}

function renderPosts() {
  elements.postGrid.innerHTML = state.posts
    .map((post) => [
      "<article class='post-card'><div class='post-image'>", imageHTML(post.image, post.title), "</div>",
      "<div class='post-content'><div class='post-meta'><span>", escapeHTML(post.tag), "</span><span>", post.readTime, " phút đọc</span></div>",
      "<h3>", escapeHTML(post.title), "</h3><p>", escapeHTML(post.excerpt), "</p></div></article>",
    ].join(""))
    .join("");
}

function renderCart() {
  const totals = getCartTotals();
  const unitCount = totals.lines.reduce((count, line) => count + line.quantity, 0);
  elements.cartCount.textContent = unitCount;
  elements.wishlistCount.textContent = state.wishlist.size;
  elements.cartSummary.textContent = unitCount ? formatPrice(totals.total) : "Trống";
  elements.wishlistTextButton.innerHTML = "<i class='bi bi-heart" + (state.showingWishlist ? "-fill" : "") + "'></i> " + (state.showingWishlist ? "Đang xem đã lưu" : "Sản phẩm đã lưu");

  if (totals.lines.length === 0) {
    elements.cartProgress.classList.remove("is-free");
    elements.cartProgress.innerHTML = "<i class='bi bi-truck'></i><span>Thêm <b>399.000đ</b> để được miễn phí giao hàng.</span>";
    elements.cartItems.innerHTML = "<div class='cart-empty'><div><i class='bi bi-bag-heart'></i><p>Giỏ hàng đang chờ một món đặc sản đầu tiên.</p></div></div>";
    elements.cartSummaryPanel.innerHTML = "";
    elements.checkoutButton.disabled = true;
    elements.clearCartButton.disabled = true;
    return;
  }

  const remaining = Math.max(0, 399000 - totals.subtotal);
  elements.cartProgress.classList.toggle("is-free", remaining === 0);
  elements.cartProgress.innerHTML = remaining
    ? "<i class='bi bi-truck'></i><span>Thêm <b>" + formatPrice(remaining) + "</b> để được miễn phí giao hàng.</span>"
    : "<i class='bi bi-patch-check-fill'></i><span>Đơn hàng của bạn đã được <b>miễn phí giao hàng</b>.</span>";

  elements.cartItems.innerHTML = totals.lines
    .map((line) => [
      "<article class='cart-line'>", imageHTML(line.product.image, line.product.name, "eager"),
      "<div><h3>", escapeHTML(line.product.name), "</h3><p>", formatPrice(line.product.price), "</p>",
      "<div class='quantity-control' aria-label='Số lượng ", escapeHTML(line.product.name), "'>",
      "<button type='button' data-action='change-quantity' data-product-id='", line.product.id, "' data-delta='-1' aria-label='Giảm số lượng'>−</button>",
      "<span>", line.quantity, "</span>",
      "<button type='button' data-action='change-quantity' data-product-id='", line.product.id, "' data-delta='1' aria-label='Tăng số lượng'>+</button>",
      "</div></div>",
      "<button class='cart-remove' type='button' data-action='remove-cart' data-product-id='", line.product.id, "' aria-label='Xóa ", escapeHTML(line.product.name), "'><i class='bi bi-trash3'></i></button></article>",
    ].join(""))
    .join("");

  elements.cartSummaryPanel.innerHTML = [
    "<div class='summary-line'><span>Tạm tính</span><strong>", formatPrice(totals.subtotal), "</strong></div>",
    "<div class='summary-line'><span>Giao hàng</span><strong>", totals.shipping ? formatPrice(totals.shipping) : "Miễn phí", "</strong></div>",
    "<div class='summary-line total'><span>Tổng cộng</span><strong>", formatPrice(totals.total), "</strong></div>",
  ].join("");
  elements.checkoutButton.disabled = false;
  elements.clearCartButton.disabled = false;
}

function renderCheckoutPreview() {
  const totals = getCartTotals();
  const count = totals.lines.reduce((total, line) => total + line.quantity, 0);
  const accountNote = state.user
    ? "<p class='checkout-account-note'><i class='bi bi-person-check-fill'></i> Đơn hàng sẽ được lưu vào tài khoản <b>" + escapeHTML(state.user.email) + "</b>.</p>"
    : "<p class='checkout-account-note'><i class='bi bi-person-plus-fill'></i> <button type='button' data-action='open-account-from-checkout'>Đăng nhập</button> để theo dõi đơn hàng sau khi đặt.</p>";
  elements.checkoutOrderPreview.innerHTML = [
    "<div><span>", count, " sản phẩm</span><strong>", formatPrice(totals.subtotal), "</strong></div>",
    "<div><span>Giao hàng</span><strong>", totals.shipping ? formatPrice(totals.shipping) : "Miễn phí", "</strong></div>",
    "<div class='total'><span>Tổng đơn</span><strong>", formatPrice(totals.total), "</strong></div>",
    accountNote,
  ].join("");
}

function renderAll() {
  renderCategories();
  renderProducts();
  renderPosts();
  renderCart();
  renderAccountButton();
}

function addToCart(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const existing = state.cart.find((item) => item.productId === product.id);
  const maximum = Math.min(product.stock, 10);

  if (existing) {
    if (existing.quantity >= maximum) {
      showToast("Bạn đã chọn số lượng tối đa có thể đặt cho " + product.name + ".", "error");
      return;
    }
    existing.quantity += 1;
  } else {
    state.cart.push({ productId: product.id, quantity: 1 });
  }
  persistCart();
  renderCart();
  showToast("Đã thêm " + product.name + " vào giỏ hàng.");
}

function changeQuantity(productId, delta) {
  const product = getProduct(productId);
  const line = state.cart.find((item) => item.productId === Number(productId));
  if (!product || !line) return;
  const nextQuantity = line.quantity + Number(delta);

  if (nextQuantity < 1) {
    state.cart = state.cart.filter((item) => item.productId !== product.id);
    showToast("Đã bỏ " + product.name + " khỏi giỏ hàng.");
  } else if (nextQuantity > Math.min(product.stock, 10)) {
    showToast("Số lượng tối đa cho " + product.name + " là " + Math.min(product.stock, 10) + ".", "error");
    return;
  } else {
    line.quantity = nextQuantity;
  }
  persistCart();
  renderCart();
}

function removeFromCart(productId) {
  const product = getProduct(productId);
  state.cart = state.cart.filter((item) => item.productId !== Number(productId));
  persistCart();
  renderCart();
  if (product) showToast("Đã xóa " + product.name + " khỏi giỏ hàng.");
}

function clearCart() {
  if (state.cart.length === 0) return;
  state.cart = [];
  persistCart();
  renderCart();
  showToast("Đã xóa toàn bộ sản phẩm khỏi giỏ hàng.");
}

function toggleWishlist(productId) {
  const product = getProduct(productId);
  if (!product) return;
  if (state.wishlist.has(product.id)) {
    state.wishlist.delete(product.id);
    showToast("Đã bỏ lưu " + product.name + ".");
  } else {
    state.wishlist.add(product.id);
    showToast("Đã lưu " + product.name + " vào wishlist.");
  }
  persistWishlist();
  renderProducts();
  renderCart();
  if (elements.productDialog.open && state.quickViewProductId === product.id) renderQuickView(product);
}

function setCategory(category) {
  state.category = category;
  state.showingWishlist = false;
  renderCategories();
  renderProducts();
  renderCart();
}

function resetFilters() {
  state.category = "all";
  state.query = "";
  state.sort = "featured";
  state.showingWishlist = false;
  elements.productSearch.value = "";
  elements.sortSelect.value = "featured";
  elements.clearSearch.hidden = true;
  renderCategories();
  renderProducts();
  renderCart();
}

function hasOpenDialog() {
  return [elements.productDialog, elements.checkoutDialog, elements.accountDialog, elements.orderDialog]
    .some((dialog) => Boolean(dialog?.open));
}

function openCart() {
  state.lastFocusedElement = document.activeElement;
  elements.cartDrawer.classList.add("is-open");
  elements.cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-overlay");
  window.setTimeout(() => elements.cartDrawer.querySelector("[data-close-cart]")?.focus(), 100);
}

function closeCart() {
  elements.cartDrawer.classList.remove("is-open");
  elements.cartDrawer.setAttribute("aria-hidden", "true");
  if (!hasOpenDialog()) document.body.classList.remove("has-overlay");
  state.lastFocusedElement?.focus?.();
}

function openDialog(dialog) {
  state.lastFocusedElement = document.activeElement;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("has-overlay");
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
  if (!elements.cartDrawer.classList.contains("is-open") && !hasOpenDialog()) document.body.classList.remove("has-overlay");
  state.lastFocusedElement?.focus?.();
}

function renderQuickView(product) {
  const saved = state.wishlist.has(product.id);
  const comparePrice = product.compareAtPrice ? "<del>" + formatPrice(product.compareAtPrice) + "</del>" : "";
  const heartIcon = saved ? "-fill" : "";

  elements.quickViewContent.innerHTML = [
    "<div class='quick-view'><div class='quick-view-image'>", imageHTML(product.image, product.name, "eager"), "</div>",
    "<div class='quick-view-content'><p class='eyebrow'><i class='bi bi-geo-alt-fill'></i> ", escapeHTML(product.origin), "</p>",
    "<h2 id='quickViewTitle'>", escapeHTML(product.name), "</h2>",
    "<p class='quick-view-rating'><i class='bi bi-star-fill'></i> ", product.rating.toFixed(1), " / 5 · ", product.reviewCount, " lượt đánh giá</p>",
    "<p class='quick-view-description'>", escapeHTML(product.description), "</p>",
    "<div class='quick-view-facts'><span>Khối lượng<b>", escapeHTML(product.weight), "</b></span>",
    "<span>Tình trạng<b>", product.stock > 8 ? "Còn hàng" : "Còn " + product.stock + " sản phẩm", "</b></span>",
    "<span>Danh mục<b>", escapeHTML(product.categoryName), "</b></span><span>Gợi ý<b>Phù hợp làm quà</b></span></div>",
    "<div class='quick-view-price'><strong>", formatPrice(product.price), "</strong>", comparePrice, "</div>",
    "<div class='quick-view-actions'><button class='button button-forest' type='button' data-action='add-cart' data-product-id='", product.id, "'><i class='bi bi-bag-plus-fill'></i> Thêm vào giỏ</button>",
    "<button class='wishlist-control", saved ? " is-saved" : "", "' type='button' data-action='toggle-wishlist' data-product-id='", product.id, "' aria-label='Lưu sản phẩm' aria-pressed='", String(saved), "'><i class='bi bi-heart", heartIcon, "'></i></button></div>",
    "</div></div>",
  ].join("");
}

function openQuickView(productId) {
  const product = getProduct(productId);
  if (!product) return;
  state.quickViewProductId = product.id;
  renderQuickView(product);
  openDialog(elements.productDialog);
}

function openCheckout() {
  if (state.cart.length === 0) {
    showToast("Hãy thêm ít nhất một sản phẩm trước khi thanh toán.", "error");
    return;
  }
  closeCart();
  if (state.user) {
    const nameField = elements.checkoutForm.querySelector("[name=name]");
    const emailField = elements.checkoutForm.querySelector("[name=email]");
    if (!nameField.value) nameField.value = state.user.name;
    if (!emailField.value) emailField.value = state.user.email;
  }
  renderCheckoutPreview();
  setFormStatus(elements.checkoutStatus, "");
  openDialog(elements.checkoutDialog);
  window.setTimeout(() => elements.checkoutForm.querySelector("[name=name]")?.focus(), 100);
}

async function handleContactSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector("button[type=submit]");
  const data = Object.fromEntries(new FormData(form));
  setFormStatus(elements.contactStatus, "");
  setButtonBusy(submit, true, "Đang gửi...");
  try {
    const response = await api("/api/contact", { method: "POST", body: JSON.stringify(data) });
    form.reset();
    setFormStatus(elements.contactStatus, response.message);
    showToast("Lời nhắn đã được lưu. Cảm ơn bạn!");
  } catch (error) {
    if (state.dataSource === "fallback") {
      saveLocalRecord("tnf-local-contacts", data);
      form.reset();
      setFormStatus(elements.contactStatus, "Đã lưu tạm trên thiết bị. Chạy npm start để ghi vào SQLite.");
      showToast("Đã lưu lời nhắn tạm trên thiết bị.");
    } else {
      setFormStatus(elements.contactStatus, error.message, true);
    }
  } finally {
    setButtonBusy(submit, false);
  }
}

async function handleNewsletterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector("button[type=submit]");
  const data = Object.fromEntries(new FormData(form));
  setFormStatus(elements.newsletterStatus, "");
  setButtonBusy(submit, true, "...");
  try {
    const response = await api("/api/newsletter", { method: "POST", body: JSON.stringify(data) });
    form.reset();
    setFormStatus(elements.newsletterStatus, response.message);
    showToast("Đã đăng ký nhận thư từ đại ngàn.");
  } catch (error) {
    if (state.dataSource === "fallback") {
      saveLocalRecord("tnf-local-newsletter", data);
      form.reset();
      setFormStatus(elements.newsletterStatus, "Đã lưu email tạm trên thiết bị. Chạy npm start để ghi SQLite.");
      showToast("Đã lưu email tạm trên thiết bị.");
    } else {
      setFormStatus(elements.newsletterStatus, error.message, true);
    }
  } finally {
    setButtonBusy(submit, false);
  }
}

async function handleCheckoutSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector("button[type=submit]");
  const customer = Object.fromEntries(new FormData(form));
  const orderPayload = { customer, note: customer.note, items: state.cart };
  setFormStatus(elements.checkoutStatus, "");
  setButtonBusy(submit, true, "Đang tạo đơn...");
  try {
    const response = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });
    state.cart = [];
    persistCart();
    try {
      const productsResponse = await api("/api/products");
      state.products = productsResponse.items;
      sanitizeClientState();
    } catch {
      // The order is already stored; a later reload will refresh the current stock.
    }
    renderProducts();
    renderCart();
    renderCheckoutPreview();
    if (state.user) {
      try {
        await refreshOrders();
      } catch {
        // The order has been created; history can be refreshed the next time the account opens.
      }
    }
    form.reset();
    setFormStatus(elements.checkoutStatus, "Đơn " + response.order.code + " đã được lưu thành công.");
    showToast("Đặt hàng thành công. Mã đơn: " + response.order.code);
    window.setTimeout(() => closeDialog(elements.checkoutDialog), 2200);
  } catch (error) {
    if (state.dataSource === "fallback") {
      const totals = getCartTotals();
      const code = "TNF-LOCAL-" + Date.now().toString(36).toUpperCase();
      const orderItems = totals.lines.map((line) => ({
        productId: line.product.id,
        name: line.product.name,
        unitPrice: line.product.price,
        quantity: line.quantity,
        lineTotal: line.product.price * line.quantity,
      }));
      saveLocalRecord("tnf-local-orders", {
        code,
        userId: state.user?.id || null,
        customer,
        note: customer.note,
        items: orderItems,
        subtotal: totals.subtotal,
        shippingFee: totals.shipping,
        total: totals.total,
        status: "pending",
      });
      state.cart = [];
      persistCart();
      renderCart();
      renderCheckoutPreview();
      if (state.user) {
        await refreshOrders();
      }
      form.reset();
      setFormStatus(elements.checkoutStatus, "Đơn " + code + " đã lưu tạm trên thiết bị. Chạy npm start để ghi SQLite.");
      showToast("Đã tạo đơn demo trên thiết bị. Mã đơn: " + code);
      window.setTimeout(() => closeDialog(elements.checkoutDialog), 2600);
    } else {
      setFormStatus(elements.checkoutStatus, error.message, true);
    }
  } finally {
    setButtonBusy(submit, false);
  }
}

function getSectionIdFromLocation(location = window.location) {
  const sectionIds = ["home", "products", "story", "journal", "contact"];
  const hashSection = decodeURIComponent(String(location.hash || "").replace(/^#/, ""));
  if (sectionIds.includes(hashSection)) return hashSection;

  const pathSection = decodeURIComponent(String(location.pathname || "").replace(/^\/+|\/+$/g, ""));
  if (pathSection.startsWith("chi-tiet-san-pham/")) return "products";
  return sectionIds.includes(pathSection) ? pathSection : "home";
}

function getCategoryFromLocation(location = window.location) {
  const category = new URLSearchParams(location.search).get("category");
  if (!category || category === "all") return "all";
  return state.categories.some((item) => item.id === category) ? category : "all";
}

function getSectionHref(sectionId) {
  return sectionId === "home" ? "/" : "/" + sectionId;
}

function setActiveSection(sectionId) {
  elements.sectionLinks.forEach((link) => {
    const isActive = link.dataset.section === sectionId;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function initializeSectionNavigation() {
  const sectionIds = ["home", "products", "story", "journal", "contact"];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function scrollToSection(sectionId, behavior = "smooth") {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : behavior, block: "start" });
  }

  elements.sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const sectionId = link.dataset.section || "home";
      event.preventDefault();
      setActiveSection(sectionId);
      window.history.pushState(null, "", getSectionHref(sectionId));
      document.body.classList.remove("is-section-changing");
      void document.body.offsetWidth;
      document.body.classList.add("is-section-changing");
      window.setTimeout(() => document.body.classList.remove("is-section-changing"), 650);
      scrollToSection(sectionId);
    });
  });

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    },
    { rootMargin: "-28% 0px -58% 0px", threshold: [0.08, 0.25, 0.55] },
  );
  sectionIds.forEach((sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) sectionObserver.observe(section);
  });

  window.addEventListener("popstate", () => {
    const sectionId = getSectionIdFromLocation();
    setActiveSection(sectionId);
    scrollToSection(sectionId, "auto");
  });
  window.addEventListener("hashchange", () => setActiveSection(getSectionIdFromLocation()));
  const initialSection = getSectionIdFromLocation();
  setActiveSection(initialSection);
  window.requestAnimationFrame(() => scrollToSection(initialSection, "auto"));
}

function openProductFromPath() {
  const path = decodeURIComponent(String(location.pathname || "").replace(/^\/+|\/+$/g, ""));
  if (!path.startsWith("chi-tiet-san-pham/")) return;
  const slug = path.split("/").slice(1).join("/");
  const product = state.products.find((item) => item.slug === slug || String(item.id) === slug);
  if (!product) return;
  window.setTimeout(() => openQuickView(product.id), 180);
}

function bindEvents() {
  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches("[data-image-fallback]") || image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = "true";
    image.src = "assets/product-fallback.svg";
  }, true);

  document.addEventListener("click", (event) => {
    const categoryTarget = event.target.closest("[data-category]");
    if (categoryTarget) {
      event.preventDefault();
      setCategory(categoryTarget.dataset.category);
      const category = categoryTarget.dataset.category || "all";
      window.history.pushState(null, "", category === "all" ? "/products" : "/products?category=" + encodeURIComponent(category));
      if (categoryTarget.classList.contains("category-link")) {
        document.querySelector("#products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    if (event.target.closest("#cartButton")) {
      openCart();
      return;
    }

    if (event.target.closest("#accountButton")) {
      void openAccount();
      return;
    }

    if (event.target.closest("#wishlistButton") || event.target.closest("#wishlistTextButton")) {
      state.showingWishlist = !state.showingWishlist;
      state.category = "all";
      window.history.pushState(null, "", "/products");
      renderCategories();
      renderProducts();
      document.querySelector("#products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (event.target.closest("[data-close-cart]")) {
      closeCart();
      return;
    }

    if (event.target.closest("#clearCartButton")) {
      clearCart();
      return;
    }

    if (event.target.closest("#checkoutButton")) {
      openCheckout();
      return;
    }

    if (event.target.closest("[data-close-dialog]")) {
      closeDialog(elements.productDialog);
      return;
    }

    if (event.target.closest("[data-close-checkout]")) {
      closeDialog(elements.checkoutDialog);
      return;
    }

    if (event.target.closest("[data-close-account]")) {
      closeDialog(elements.accountDialog);
      return;
    }

    if (event.target.closest("[data-close-order]")) {
      closeDialog(elements.orderDialog);
      return;
    }

    if (event.target.closest("[data-featured-gift]")) {
      const gift = state.products.find((product) => product.category === "gift");
      if (gift) openQuickView(gift.id);
      return;
    }

    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;

    if (action === "set-auth-mode") {
      state.authMode = actionTarget.dataset.authMode === "register" ? "register" : "login";
      renderAccountDialog();
      return;
    }
    if (action === "refresh-orders") {
      void refreshOrders()
        .catch((error) => showToast(error.message, "error"))
        .finally(() => renderAccountDialog());
      return;
    }
    if (action === "open-order-detail") {
      void openOrderDetail(actionTarget.dataset.orderCode);
      return;
    }
    if (action === "continue-shopping") {
      closeDialog(elements.accountDialog);
      document.querySelector("#products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "back-to-account") {
      closeDialog(elements.orderDialog);
      void openAccount();
      return;
    }
    if (action === "logout") {
      void logoutUser();
      return;
    }
    if (action === "open-account-from-checkout") {
      closeDialog(elements.checkoutDialog);
      void openAccount();
      return;
    }

    const productId = Number(actionTarget.dataset.productId);

    if (action === "add-cart") {
      addToCart(productId);
      return;
    }
    if (action === "toggle-wishlist") {
      toggleWishlist(productId);
      return;
    }
    if (action === "quick-view") {
      event.preventDefault();
      const product = getProduct(productId);
      if (product?.slug) window.history.pushState(null, "", "/chi-tiet-san-pham/" + product.slug);
      openQuickView(productId);
      return;
    }
    if (action === "change-quantity") {
      changeQuantity(productId, Number(actionTarget.dataset.delta));
      return;
    }
    if (action === "remove-cart") {
      removeFromCart(productId);
      return;
    }
    if (action === "reset-filters") resetFilters();
  });

  let searchTimer;
  elements.productSearch.addEventListener("input", (event) => {
    window.clearTimeout(searchTimer);
    elements.clearSearch.hidden = !event.target.value;
    searchTimer = window.setTimeout(() => {
      state.query = event.target.value;
      state.showingWishlist = false;
      renderProducts();
      renderCart();
    }, 130);
  });

  elements.clearSearch.addEventListener("click", () => {
    elements.productSearch.value = "";
    elements.clearSearch.hidden = true;
    state.query = "";
    renderProducts();
    elements.productSearch.focus();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderProducts();
  });

  elements.menuToggle.addEventListener("click", () => {
    const isOpen = elements.primaryNav.classList.toggle("is-open");
    elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
    elements.menuToggle.innerHTML = isOpen ? "<i class='bi bi-x-lg'></i>" : "<i class='bi bi-list'></i>";
  });

  elements.primaryNav.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    elements.primaryNav.classList.remove("is-open");
    elements.menuToggle.setAttribute("aria-expanded", "false");
    elements.menuToggle.innerHTML = "<i class='bi bi-list'></i>";
  });

  elements.contactForm.addEventListener("submit", handleContactSubmit);
  elements.newsletterForm.addEventListener("submit", handleNewsletterSubmit);
  elements.checkoutForm.addEventListener("submit", handleCheckoutSubmit);

  document.addEventListener("submit", (event) => {
    if (event.target.id === "loginForm") void handleLoginSubmit(event);
    if (event.target.id === "registerForm") void handleRegisterSubmit(event);
  });

  [elements.productDialog, elements.checkoutDialog, elements.accountDialog, elements.orderDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      if (!elements.cartDrawer.classList.contains("is-open") && !hasOpenDialog()) document.body.classList.remove("has-overlay");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.cartDrawer.classList.contains("is-open")) closeCart();
  });
}

async function initialize() {
  bindEvents();
  initializeSectionNavigation();
  try {
    const responses = await Promise.all([
      api("/api/categories"),
      api("/api/products"),
      api("/api/posts"),
      api("/api/auth/me"),
    ]);
    state.categories = responses[0].items;
    state.products = responses[1].items;
    state.posts = responses[2].items;
    state.user = toSafeUser(responses[3].user);
    state.dataSource = "sqlite";
    if (getSectionIdFromLocation() === "products") state.category = getCategoryFromLocation();
    sanitizeClientState();
    renderAll();
    openProductFromPath();
  } catch (error) {
    if (fallbackData.products.length) {
      state.categories = fallbackData.categories;
      state.products = fallbackData.products;
      state.posts = fallbackData.posts;
      state.user = restoreLocalUser();
      state.dataSource = "fallback";
      if (getSectionIdFromLocation() === "products") state.category = getCategoryFromLocation();
      sanitizeClientState();
      renderAll();
      openProductFromPath();
      showToast("Bản HTML đang dùng dữ liệu demo. Chạy npm start để kết nối SQLite.");
      return;
    }
    elements.productGrid.innerHTML = [
      "<div class='empty-state'><div><i class='bi bi-wifi-off'></i><h3>Chưa kết nối được dữ liệu.</h3>",
      "<p>", escapeHTML(error.message), " Hãy chạy website bằng lệnh <code>npm start</code> rồi tải lại trang.</p></div></div>",
    ].join("");
    elements.postGrid.innerHTML = "";
    elements.categoryStrip.innerHTML = "<span class='loading-chip'>Không thể tải danh mục.</span>";
    elements.resultsMeta.textContent = "CSDL chưa sẵn sàng.";
    showToast("Không kết nối được API dữ liệu. Hãy chạy npm start.", "error");
  }
}

document.addEventListener("DOMContentLoaded", initialize);
