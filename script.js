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
  cartButton: document.querySelector("#cartButton"),
  cartDrawer: document.querySelector("#cartDrawer"),
  cartItems: document.querySelector("#cartItems"),
  cartSummaryPanel: document.querySelector("#cartSummaryPanel"),
  checkoutButton: document.querySelector("#checkoutButton"),
  productDialog: document.querySelector("#productDialog"),
  quickViewContent: document.querySelector("#quickViewContent"),
  checkoutDialog: document.querySelector("#checkoutDialog"),
  checkoutForm: document.querySelector("#checkoutForm"),
  checkoutOrderPreview: document.querySelector("#checkoutOrderPreview"),
  checkoutStatus: document.querySelector("#checkoutStatus"),
  contactForm: document.querySelector("#contactForm"),
  contactStatus: document.querySelector("#contactStatus"),
  newsletterForm: document.querySelector("#newsletterForm"),
  newsletterStatus: document.querySelector("#newsletterStatus"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toastMessage"),
  menuToggle: document.querySelector("#menuToggle"),
  primaryNav: document.querySelector("#primaryNav"),
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

  return [
    "<article class='product-card'>",
    "<div class='product-image'>",
    "<img src='", escapeHTML(product.image), "' alt='", escapeHTML(product.name), "' loading='lazy' />",
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
    "<button class='card-button secondary' type='button' data-action='quick-view' data-product-id='", product.id, "' aria-label='Xem nhanh ", escapeHTML(product.name), "'><i class='bi bi-arrow-up-right'></i></button>",
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
      "<article class='post-card'><div class='post-image'><img src='", escapeHTML(post.image), "' alt='", escapeHTML(post.title), "' loading='lazy' /></div>",
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
    elements.cartItems.innerHTML = "<div class='cart-empty'><div><i class='bi bi-bag-heart'></i><p>Giỏ hàng đang chờ một món đặc sản đầu tiên.</p></div></div>";
    elements.cartSummaryPanel.innerHTML = "";
    elements.checkoutButton.disabled = true;
    return;
  }

  elements.cartItems.innerHTML = totals.lines
    .map((line) => [
      "<article class='cart-line'><img src='", escapeHTML(line.product.image), "' alt='", escapeHTML(line.product.name), "' />",
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
}

function renderCheckoutPreview() {
  const totals = getCartTotals();
  const count = totals.lines.reduce((total, line) => total + line.quantity, 0);
  elements.checkoutOrderPreview.innerHTML = [
    "<div><span>", count, " sản phẩm</span><strong>", formatPrice(totals.subtotal), "</strong></div>",
    "<div><span>Giao hàng</span><strong>", totals.shipping ? formatPrice(totals.shipping) : "Miễn phí", "</strong></div>",
    "<div class='total'><span>Tổng đơn</span><strong>", formatPrice(totals.total), "</strong></div>",
  ].join("");
}

function renderAll() {
  renderCategories();
  renderProducts();
  renderPosts();
  renderCart();
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
  if (!elements.productDialog.open && !elements.checkoutDialog.open) document.body.classList.remove("has-overlay");
  state.lastFocusedElement?.focus?.();
}

function openDialog(dialog) {
  state.lastFocusedElement = document.activeElement;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("has-overlay");
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
  if (!elements.cartDrawer.classList.contains("is-open")) document.body.classList.remove("has-overlay");
  state.lastFocusedElement?.focus?.();
}

function renderQuickView(product) {
  const saved = state.wishlist.has(product.id);
  const comparePrice = product.compareAtPrice ? "<del>" + formatPrice(product.compareAtPrice) + "</del>" : "";
  const heartIcon = saved ? "-fill" : "";

  elements.quickViewContent.innerHTML = [
    "<div class='quick-view'><div class='quick-view-image'><img src='", escapeHTML(product.image), "' alt='", escapeHTML(product.name), "' /></div>",
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
    form.reset();
    setFormStatus(elements.checkoutStatus, "Đơn " + response.order.code + " đã được lưu thành công.");
    showToast("Đặt hàng thành công. Mã đơn: " + response.order.code);
    window.setTimeout(() => closeDialog(elements.checkoutDialog), 2200);
  } catch (error) {
    if (state.dataSource === "fallback") {
      const totals = getCartTotals();
      const code = "TNF-LOCAL-" + Date.now().toString(36).toUpperCase();
      saveLocalRecord("tnf-local-orders", { code, ...orderPayload, total: totals.total });
      state.cart = [];
      persistCart();
      renderCart();
      renderCheckoutPreview();
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

function bindEvents() {
  document.addEventListener("click", (event) => {
    const categoryTarget = event.target.closest("[data-category]");
    if (categoryTarget) {
      event.preventDefault();
      setCategory(categoryTarget.dataset.category);
      if (categoryTarget.classList.contains("category-link")) {
        document.querySelector("#products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    if (event.target.closest("#cartButton")) {
      openCart();
      return;
    }

    if (event.target.closest("#wishlistButton") || event.target.closest("#wishlistTextButton")) {
      state.showingWishlist = !state.showingWishlist;
      state.category = "all";
      renderCategories();
      renderProducts();
      document.querySelector("#products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (event.target.closest("[data-close-cart]")) {
      closeCart();
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

    if (event.target.closest("[data-featured-gift]")) {
      const gift = state.products.find((product) => product.category === "gift");
      if (gift) openQuickView(gift.id);
      return;
    }

    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const productId = Number(actionTarget.dataset.productId);

    if (actionTarget.dataset.action === "add-cart") {
      addToCart(productId);
      return;
    }
    if (actionTarget.dataset.action === "toggle-wishlist") {
      toggleWishlist(productId);
      return;
    }
    if (actionTarget.dataset.action === "quick-view") {
      openQuickView(productId);
      return;
    }
    if (actionTarget.dataset.action === "change-quantity") {
      changeQuantity(productId, Number(actionTarget.dataset.delta));
      return;
    }
    if (actionTarget.dataset.action === "remove-cart") {
      removeFromCart(productId);
      return;
    }
    if (actionTarget.dataset.action === "reset-filters") resetFilters();
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

  [elements.productDialog, elements.checkoutDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      if (!elements.cartDrawer.classList.contains("is-open")) document.body.classList.remove("has-overlay");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.cartDrawer.classList.contains("is-open")) closeCart();
  });
}

async function initialize() {
  bindEvents();
  try {
    const responses = await Promise.all([
      api("/api/categories"),
      api("/api/products"),
      api("/api/posts"),
    ]);
    state.categories = responses[0].items;
    state.products = responses[1].items;
    state.posts = responses[2].items;
    state.dataSource = "sqlite";
    sanitizeClientState();
    renderAll();
  } catch (error) {
    if (fallbackData.products.length) {
      state.categories = fallbackData.categories;
      state.products = fallbackData.products;
      state.posts = fallbackData.posts;
      state.dataSource = "fallback";
      sanitizeClientState();
      renderAll();
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
