const state = {
  token: window.localStorage.getItem("bottleapp_token") || "",
  user: null,
  products: [],
  orders: [],
  adminSummary: null,
  cart: loadCart(),
  flash: null,
  loading: true,
  editingProductId: null,
};

const appRoot = document.getElementById("app");
const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const toneOptions = ["ember", "lagoon", "berry", "cobalt", "mint", "sand"];
const statusOptions = ["pending", "paid", "packing", "shipped", "completed"];
const statusLabels = {
  pending: "รอยืนยัน",
  paid: "ชำระแล้ว",
  packing: "กำลังแพ็ก",
  shipped: "จัดส่งแล้ว",
  completed: "สำเร็จ",
};

window.addEventListener("hashchange", () => {
  syncRoute().catch(handleError);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const { action } = button.dataset;
  if (!action) {
    return;
  }

  event.preventDefault();

  const handlers = {
    navigate: () => navigate(button.dataset.route || "/"),
    logout: () => logout(),
    addCart: () => addToCart(button.dataset.productId),
    incCart: () => updateCartItem(button.dataset.productId, 1),
    decCart: () => updateCartItem(button.dataset.productId, -1),
    removeCart: () => removeCartItem(button.dataset.productId),
    prefillUser: () => prefillLogin("demo", "demo123"),
    prefillAdmin: () => prefillLogin("admin", "admin123"),
    editProduct: () => {
      state.editingProductId = button.dataset.productId || null;
      render();
      scrollToTop();
    },
    cancelEditProduct: () => {
      state.editingProductId = null;
      render();
    },
    deleteProduct: () => deleteProduct(button.dataset.productId),
  };

  const handler = handlers[action];
  if (handler) {
    Promise.resolve(handler()).catch(handleError);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  const formType = form.dataset.form;
  if (!formType) {
    return;
  }

  event.preventDefault();

  const handlers = {
    login: () => handleLogin(form),
    checkout: () => handleCheckout(form),
    product: () => handleProductSubmit(form),
    orderStatus: () => handleOrderStatus(form),
  };

  const handler = handlers[formType];
  if (handler) {
    Promise.resolve(handler()).catch(handleError);
  }
});

init().catch(handleError);

async function init() {
  await Promise.all([loadProducts(), loadCurrentUser()]);
  state.loading = false;
  await syncRoute();
}

async function syncRoute() {
  const route = getRoute();

  if (route === "/login/user" && state.user?.role === "user") {
    navigate("/account");
    return;
  }

  if (route === "/login/admin" && state.user?.role === "admin") {
    navigate("/admin");
    return;
  }

  if (route === "/account" && state.user?.role !== "user") {
    flash("เข้าสู่ระบบผู้ใช้ก่อนเพื่อดูประวัติการสั่งซื้อ", "error");
    navigate("/login/user");
    return;
  }

  if (route === "/admin" && state.user?.role !== "admin") {
    flash("เข้าสู่ระบบแอดมินก่อนเพื่อจัดการหลังบ้าน", "error");
    navigate("/login/admin");
    return;
  }

  if (route === "/account" && state.user?.role === "user") {
    await loadOrders();
  }

  if (route === "/admin" && state.user?.role === "admin") {
    await Promise.all([loadOrders(), loadAdminSummary()]);
  }

  render();
}

function getRoute() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function navigate(route) {
  window.location.hash = route;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleError(error) {
  console.error(error);
  flash(error.message || "เกิดข้อผิดพลาด", "error");
  render();
}

function flash(message, type = "success") {
  state.flash = { message, type };
  window.clearTimeout(flash._timer);
  flash._timer = window.setTimeout(() => {
    state.flash = null;
    render();
  }, 3500);
}

function loadCart() {
  try {
    const raw = window.localStorage.getItem("bottleapp_cart");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  window.localStorage.setItem("bottleapp_cart", JSON.stringify(state.cart));
}

function setToken(token) {
  state.token = token;
  if (token) {
    window.localStorage.setItem("bottleapp_token", token);
    return;
  }
  window.localStorage.removeItem("bottleapp_token");
}

async function api(path, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: {},
  };

  if (options.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(options.body);
  }

  if (state.token && options.auth !== false) {
    config.headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, config);
  const text = await response.text();
  const payload = text ? safeJson(text) : {};

  if (!response.ok) {
    if (response.status === 401) {
      setToken("");
      state.user = null;
    }
    throw new Error(payload.error || "ไม่สามารถดำเนินการได้");
  }

  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function loadProducts() {
  state.products = await api("/api/products", { auth: false });
}

async function loadCurrentUser() {
  if (!state.token) {
    state.user = null;
    return;
  }

  try {
    const response = await api("/api/auth/me");
    state.user = response.user;
  } catch {
    setToken("");
    state.user = null;
  }
}

async function loadOrders() {
  state.orders = await api("/api/orders");
}

async function loadAdminSummary() {
  state.adminSummary = await api("/api/admin/summary");
}

function prefillLogin(username, password) {
  const usernameInput = document.querySelector('input[name="username"]');
  const passwordInput = document.querySelector('input[name="password"]');

  if (usernameInput && passwordInput) {
    usernameInput.value = username;
    passwordInput.value = password;
  }
}

async function handleLogin(form) {
  const formData = new FormData(form);
  const role = String(formData.get("role") || "");
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  const response = await api("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { username, password, role },
  });

  setToken(response.token);
  state.user = response.user;
  flash(`ยินดีต้อนรับ ${response.user.fullName}`, "success");

  if (response.user.role === "admin") {
    navigate("/admin");
    return;
  }

  navigate("/account");
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore logout errors and clear session locally.
  }

  setToken("");
  state.user = null;
  state.orders = [];
  state.adminSummary = null;
  state.editingProductId = null;
  flash("ออกจากระบบแล้ว", "success");
  navigate("/");
}

function addToCart(productId) {
  const product = state.products.find((entry) => entry.id === productId);
  if (!product || product.stock <= 0) {
    flash("สินค้ารายการนี้หมดชั่วคราว", "error");
    return;
  }

  const existing = state.cart.find((entry) => entry.productId === productId);
  const nextQuantity = (existing?.quantity || 0) + 1;

  if (nextQuantity > product.stock) {
    flash("จำนวนในตะกร้าเกินสต๊อกที่มีอยู่", "error");
    return;
  }

  if (existing) {
    existing.quantity = nextQuantity;
  } else {
    state.cart.push({ productId, quantity: 1 });
  }

  saveCart();
  render();
}

function updateCartItem(productId, delta) {
  const product = state.products.find((entry) => entry.id === productId);
  const target = state.cart.find((entry) => entry.productId === productId);
  if (!product || !target) {
    return;
  }

  target.quantity += delta;
  if (target.quantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.productId !== productId);
  } else if (target.quantity > product.stock) {
    target.quantity = product.stock;
    flash("ปรับจำนวนตามสต๊อกล่าสุดแล้ว", "success");
  }

  saveCart();
  render();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter((entry) => entry.productId !== productId);
  saveCart();
  render();
}

function expandedCartItems() {
  return state.cart
    .map((entry) => {
      const product = state.products.find((item) => item.id === entry.productId);
      if (!product) {
        return null;
      }

      const quantity = Math.min(entry.quantity, product.stock);
      if (quantity <= 0) {
        return null;
      }
      return {
        productId: product.id,
        quantity,
        product,
        total: quantity * product.price,
      };
    })
    .filter(Boolean);
}

async function handleCheckout(form) {
  if (state.user?.role !== "user") {
    flash("กรุณาเข้าสู่ระบบผู้ใช้ก่อนสั่งซื้อ", "error");
    navigate("/login/user");
    return;
  }

  const items = expandedCartItems();
  if (!items.length) {
    flash("ตะกร้าสินค้ายังว่างอยู่", "error");
    return;
  }

  const formData = new FormData(form);
  const payload = {
    customerName: String(formData.get("customerName") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    note: String(formData.get("note") || "").trim(),
    items: items.map((entry) => ({
      productId: entry.productId,
      quantity: entry.quantity,
    })),
  };

  await api("/api/orders", {
    method: "POST",
    body: payload,
  });

  state.cart = [];
  saveCart();
  await Promise.all([loadProducts(), loadOrders()]);
  flash("สั่งซื้อเรียบร้อยแล้ว", "success");
  navigate("/account");
}

function currentEditingProduct() {
  return state.products.find((entry) => entry.id === state.editingProductId) || null;
}

async function handleProductSubmit(form) {
  if (state.user?.role !== "admin") {
    return;
  }

  const formData = new FormData(form);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    price: Number(formData.get("price")),
    stock: Number(formData.get("stock")),
    tone: String(formData.get("tone") || "lagoon"),
    featured: formData.get("featured") === "on",
  };

  if (state.editingProductId) {
    await api(`/api/products/${state.editingProductId}`, {
      method: "PUT",
      body: payload,
    });
    flash("อัปเดตสินค้าแล้ว", "success");
  } else {
    await api("/api/products", {
      method: "POST",
      body: payload,
    });
    flash("เพิ่มสินค้าใหม่แล้ว", "success");
  }

  state.editingProductId = null;
  await Promise.all([loadProducts(), loadAdminSummary()]);
  render();
}

async function deleteProduct(productId) {
  if (!productId) {
    return;
  }

  const product = state.products.find((entry) => entry.id === productId);
  if (!product) {
    return;
  }

  const confirmed = window.confirm(`ลบสินค้า ${product.name} ใช่หรือไม่`);
  if (!confirmed) {
    return;
  }

  await api(`/api/products/${productId}`, {
    method: "DELETE",
  });

  state.cart = state.cart.filter((entry) => entry.productId !== productId);
  saveCart();
  if (state.editingProductId === productId) {
    state.editingProductId = null;
  }

  await Promise.all([loadProducts(), loadAdminSummary()]);
  flash("ลบสินค้าแล้ว", "success");
  render();
}

async function handleOrderStatus(form) {
  const formData = new FormData(form);
  const orderId = String(formData.get("orderId") || "");
  const status = String(formData.get("status") || "");

  if (!orderId || !status) {
    return;
  }

  await api(`/api/orders/${orderId}`, {
    method: "PATCH",
    body: { status },
  });

  await Promise.all([loadOrders(), loadAdminSummary()]);
  flash("อัปเดตสถานะออเดอร์แล้ว", "success");
  render();
}

function totalCartAmount() {
  return expandedCartItems().reduce((sum, entry) => sum + entry.total, 0);
}

function render() {
  if (state.loading) {
    appRoot.innerHTML = `
      <div class="layout">
        <section class="panel">
          <h3>กำลังโหลดร้านค้า...</h3>
          <p class="soft-text">กำลังเตรียมข้อมูลสินค้าและสถานะการเข้าสู่ระบบ</p>
        </section>
      </div>
    `;
    return;
  }

  const route = getRoute();
  const page =
    route === "/login/user"
      ? renderLogin("user")
      : route === "/login/admin"
        ? renderLogin("admin")
        : route === "/account"
          ? renderAccount()
          : route === "/admin"
            ? renderAdmin()
            : renderHome();

  appRoot.innerHTML = `
    <div class="layout">
      ${renderHeader(route)}
      ${state.flash ? renderFlash() : ""}
      ${page}
      <p class="footer-note">
        Bottleapp Store พร้อมใช้งานทั้งหน้าร้านและหลังบ้านในโปรเจกต์เดียว
      </p>
    </div>
  `;
}

function renderHeader(route) {
  const active = (value) => (route === value ? "active" : "");

  return `
    <header class="site-header">
      <div class="brand">
        <div class="brand-mark">B</div>
        <div class="brand-copy">
          <h1>Bottleapp Store</h1>
          <p>ร้านขายสินค้า พร้อมระบบลูกค้าและแอดมิน</p>
        </div>
      </div>
      <nav class="header-nav">
        <a href="#/" class="nav-link ${active("/")}">หน้าร้าน</a>
        <a href="#/login/user" class="nav-link ${active("/login/user")}">ล็อกอินผู้ใช้</a>
        <a href="#/login/admin" class="nav-link ${active("/login/admin")}">ล็อกอินแอดมิน</a>
        ${state.user?.role === "user" ? `<a href="#/account" class="nav-link ${active("/account")}">บัญชีผู้ใช้</a>` : ""}
        ${state.user?.role === "admin" ? `<a href="#/admin" class="nav-link ${active("/admin")}">หลังบ้าน</a>` : ""}
      </nav>
      <div class="header-actions">
        ${
          state.user
            ? `
              <span class="user-chip">${escapeHtml(state.user.fullName)} · ${state.user.role}</span>
              <button class="ghost-button" data-action="logout">ออกจากระบบ</button>
            `
            : `<span class="user-chip">ยังไม่ได้เข้าสู่ระบบ</span>`
        }
      </div>
    </header>
  `;
}

function renderFlash() {
  return `
    <div class="notice ${state.flash.type}">
      <strong>${state.flash.type === "error" ? "แจ้งเตือน" : "สำเร็จ"}</strong>
      <p>${escapeHtml(state.flash.message)}</p>
    </div>
  `;
}

function renderHome() {
  const cartItems = expandedCartItems();
  const featured = state.products.filter((product) => product.featured);

  return `
    <section class="hero">
      <div class="hero-panel">
        <div class="hero-main">
          <div class="hero-copy">
            <span class="badge">Storefront + Admin Dashboard</span>
            <h2>ร้านค้าที่ขายได้จริง จัดการได้จริง</h2>
            <p>
              แอปนี้มีทั้งหน้าร้านสำหรับลูกค้า ระบบตะกร้าสินค้า ประวัติการสั่งซื้อ
              และหลังบ้านสำหรับแอดมินเพื่อเพิ่มสินค้า แก้ไขสต๊อก และอัปเดตสถานะออเดอร์
            </p>
            <div class="pill-row">
              <span class="pill">ผู้ใช้ทดลอง: demo / demo123</span>
              <span class="pill">แอดมิน: admin / admin123</span>
            </div>
            <div class="hero-actions">
              <a href="#/login/user" class="primary-button">เริ่มซื้อสินค้า</a>
              <a href="#/login/admin" class="secondary-button">เข้าหลังบ้าน</a>
            </div>
          </div>
          <div class="hero-rail">
            <div class="stat-card">
              <span class="soft-text">สินค้าทั้งหมด</span>
              <strong>${state.products.length}</strong>
              <p class="soft-text">พร้อมตัวอย่างสินค้าและสต๊อกเริ่มต้น</p>
            </div>
            <div class="mini-card">
              <h3>ไฮไลต์หน้าร้าน</h3>
              <div class="tag-row">
                ${featured
                  .slice(0, 3)
                  .map((product) => `<span class="tag">${escapeHtml(product.name)}</span>`)
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <h3>สถานะการใช้งาน</h3>
        <div class="two-column">
          <div class="helper-box">
            <strong>ลูกค้า</strong>
            <p class="helper-text">
              เลือกสินค้า ใส่ตะกร้า ล็อกอิน และสั่งซื้อได้จากหน้าร้าน
            </p>
          </div>
          <div class="helper-box">
            <strong>แอดมิน</strong>
            <p class="helper-text">
              จัดการสินค้า ดูออเดอร์ และอัปเดตสถานะจากหน้าหลังบ้าน
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="section-grid">
      <div>
        <div class="section-head">
          <div>
            <h2>สินค้าพร้อมขาย</h2>
            <p>ตัวอย่างหน้าร้านพร้อมการ์ดสินค้าและปุ่มเพิ่มลงตะกร้า</p>
          </div>
          <span class="badge-soft">${state.products.length} รายการ</span>
        </div>
        <div class="product-grid">
          ${state.products.map(renderProductCard).join("")}
        </div>
      </div>
      <aside class="cart-panel">
        <div class="section-head">
          <div>
            <h2>ตะกร้าสินค้า</h2>
            <p>พร้อมทำรายการสั่งซื้อทันที</p>
          </div>
        </div>
        ${
          cartItems.length
            ? `
              <div class="cart-list">
                ${cartItems.map(renderCartItem).join("")}
              </div>
              <div class="summary-box">
                <div class="summary-line">
                  <span>ยอดรวม</span>
                  <strong>${formatPrice(totalCartAmount())}</strong>
                </div>
                <div class="summary-line">
                  <span>สถานะลูกค้า</span>
                  <span>${state.user?.role === "user" ? "พร้อมสั่งซื้อ" : "ต้องล็อกอิน"}</span>
                </div>
              </div>
              <form data-form="checkout" class="field-grid">
                <div class="field-group">
                  <label for="customerName">ชื่อผู้รับ</label>
                  <input id="customerName" name="customerName" placeholder="ชื่อผู้รับสินค้า" value="${escapeAttr(state.user?.fullName || "")}" />
                </div>
                <div class="field-group">
                  <label for="phone">เบอร์โทร</label>
                  <input id="phone" name="phone" placeholder="08xxxxxxxx" />
                </div>
                <div class="field-group">
                  <label for="address">ที่อยู่จัดส่ง</label>
                  <textarea id="address" name="address" placeholder="บ้านเลขที่ ถนน แขวง เขต จังหวัด"></textarea>
                </div>
                <div class="field-group">
                  <label for="note">หมายเหตุ</label>
                  <textarea id="note" name="note" placeholder="เช่น ฝากไว้กับ รปภ."></textarea>
                </div>
                <button class="primary-button" type="submit">ยืนยันคำสั่งซื้อ</button>
              </form>
            `
            : `
              <div class="empty-state">
                <strong>ยังไม่มีสินค้าในตะกร้า</strong>
                <p>กดเพิ่มสินค้าจากการ์ดด้านซ้ายเพื่อเริ่มทดสอบระบบสั่งซื้อ</p>
              </div>
            `
        }
      </aside>
    </section>
  `;
}

function renderProductCard(product) {
  const stockPercent = Math.max(10, Math.min(100, Math.round((product.stock / 25) * 100)));

  return `
    <article class="product-card tone-${escapeAttr(product.tone)}">
      <div class="product-top">
        <span class="badge">${escapeHtml(product.category)}</span>
        <span class="soft-text">คงเหลือ ${product.stock}</span>
      </div>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-meta">${escapeHtml(product.description)}</p>
      <div class="product-price">${formatPrice(product.price)}</div>
      <div class="inventory-meter">
        <div class="inventory-fill" style="width:${stockPercent}%"></div>
      </div>
      <div class="row-actions">
        <button
          class="primary-button"
          data-action="addCart"
          data-product-id="${escapeAttr(product.id)}"
          ${product.stock <= 0 ? "disabled" : ""}
        >
          เพิ่มลงตะกร้า
        </button>
        ${product.featured ? `<span class="tag">แนะนำ</span>` : ""}
      </div>
    </article>
  `;
}

function renderCartItem(entry) {
  return `
    <div class="cart-item">
      <div>
        <strong>${escapeHtml(entry.product.name)}</strong>
        <p class="soft-text">${formatPrice(entry.product.price)} ต่อชิ้น</p>
      </div>
      <strong>${formatPrice(entry.total)}</strong>
      <div class="quantity-controls">
        <button class="tiny-button" data-action="decCart" data-product-id="${escapeAttr(entry.productId)}">-</button>
        <span>${entry.quantity}</span>
        <button class="tiny-button" data-action="incCart" data-product-id="${escapeAttr(entry.productId)}">+</button>
        <button class="ghost-button" data-action="removeCart" data-product-id="${escapeAttr(entry.productId)}">ลบ</button>
      </div>
    </div>
  `;
}

function renderLogin(role) {
  const isAdmin = role === "admin";

  return `
    <section class="login-shell">
      <div class="login-grid">
        <div class="login-side">
          <span class="badge">${isAdmin ? "Admin Access" : "User Sign In"}</span>
          <h2>${isAdmin ? "จัดการร้านจากหลังบ้าน" : "เข้าสู่ระบบเพื่อสั่งซื้อ"}</h2>
          <p>
            ${
              isAdmin
                ? "ดูภาพรวมยอดขาย เพิ่มและแก้ไขสินค้า รวมถึงอัปเดตสถานะออเดอร์จากแดชบอร์ดเดียว"
                : "เช็กเอาต์สินค้า ติดตามสถานะคำสั่งซื้อ และดูประวัติการซื้อได้ทันที"
            }
          </p>
          <div class="helper-box">
            <strong>บัญชีทดสอบ</strong>
            <p class="helper-text">
              ${isAdmin ? "admin / admin123" : "demo / demo123"}
            </p>
          </div>
        </div>
        <div class="login-content">
          <h3>${isAdmin ? "ล็อกอินแอดมิน" : "ล็อกอินผู้ใช้"}</h3>
          <p class="soft-text">
            กรอกข้อมูลเพื่อเข้าใช้งาน${isAdmin ? "หลังบ้าน" : "หน้าร้านและบัญชีผู้ใช้"}
          </p>
          <form data-form="login" class="field-grid">
            <input type="hidden" name="role" value="${role}" />
            <div class="field-group">
              <label for="username">ชื่อผู้ใช้</label>
              <input id="username" name="username" placeholder="${isAdmin ? "admin" : "demo"}" />
            </div>
            <div class="field-group">
              <label for="password">รหัสผ่าน</label>
              <input id="password" name="password" type="password" placeholder="••••••••" />
            </div>
            <div class="login-actions">
              <button type="submit" class="primary-button">เข้าสู่ระบบ</button>
              <button
                type="button"
                class="ghost-button"
                data-action="${isAdmin ? "prefillAdmin" : "prefillUser"}"
              >
                เติมข้อมูลทดสอบ
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderAccount() {
  const orders = state.orders || [];
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>บัญชีผู้ใช้</h2>
          <p>ประวัติคำสั่งซื้อและสถานะล่าสุดของคุณ</p>
        </div>
        <span class="pill">${escapeHtml(state.user?.fullName || "")}</span>
      </div>
      <div class="two-column">
        <div class="helper-box">
          <strong>ช้อปต่อได้เลย</strong>
          <p class="helper-text">
            กลับไปยังหน้าร้านเพื่อเพิ่มสินค้าใหม่ แล้วเช็กเอาต์จากตะกร้าด้านขวา
          </p>
          <div class="panel-actions">
            <a href="#/" class="primary-button">กลับไปหน้าร้าน</a>
          </div>
        </div>
        <div class="helper-box">
          <strong>ออเดอร์ทั้งหมด</strong>
          <p class="helper-text">${orders.length} รายการในบัญชีนี้</p>
        </div>
      </div>
      <div class="order-list">
        ${
          orders.length
            ? orders.map((order) => renderOrderCard(order, false)).join("")
            : `
              <div class="empty-state">
                <strong>ยังไม่มีคำสั่งซื้อ</strong>
                <p>สั่งสินค้าจากหน้าร้าน แล้วรายการจะมาแสดงที่หน้านี้</p>
              </div>
            `
        }
      </div>
    </section>
  `;
}

function renderAdmin() {
  const summary = state.adminSummary || {
    productCount: 0,
    orderCount: 0,
    pendingOrders: 0,
    lowStockCount: 0,
    totalSales: 0,
  };
  const editing = currentEditingProduct();

  return `
    <section>
      <div class="stat-grid">
        <div class="stat-card">
          <span class="soft-text">ยอดขายรวม</span>
          <strong>${formatPrice(summary.totalSales)}</strong>
        </div>
        <div class="stat-card">
          <span class="soft-text">ออเดอร์ทั้งหมด</span>
          <strong>${summary.orderCount}</strong>
        </div>
        <div class="stat-card">
          <span class="soft-text">รอดำเนินการ</span>
          <strong>${summary.pendingOrders}</strong>
        </div>
        <div class="stat-card">
          <span class="soft-text">สต๊อกต่ำ</span>
          <strong>${summary.lowStockCount}</strong>
        </div>
      </div>
      <div class="admin-grid">
        <section class="panel">
          <div class="section-head">
            <div>
              <h2>${editing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2>
              <p>จัดการรายการสินค้าในร้านจากฟอร์มเดียว</p>
            </div>
          </div>
          <form data-form="product" class="form-grid">
            <div class="field-group">
              <label for="productName">ชื่อสินค้า</label>
              <input id="productName" name="name" value="${escapeAttr(editing?.name || "")}" />
            </div>
            <div class="field-group">
              <label for="category">หมวดหมู่</label>
              <input id="category" name="category" value="${escapeAttr(editing?.category || "")}" />
            </div>
            <div class="field-group">
              <label for="price">ราคา</label>
              <input id="price" name="price" type="number" min="1" value="${escapeAttr(editing?.price || 390)}" />
            </div>
            <div class="field-group">
              <label for="stock">สต๊อก</label>
              <input id="stock" name="stock" type="number" min="0" value="${escapeAttr(editing?.stock || 10)}" />
            </div>
            <div class="field-group">
              <label for="tone">โทนสีสินค้า</label>
              <select id="tone" name="tone">
                ${toneOptions
                  .map(
                    (tone) => `
                      <option value="${tone}" ${editing?.tone === tone ? "selected" : ""}>${tone}</option>
                    `
                  )
                  .join("")}
              </select>
            </div>
            <div class="field-group">
              <label for="description">รายละเอียด</label>
              <textarea id="description" name="description">${escapeHtml(editing?.description || "")}</textarea>
            </div>
            <label class="checkbox-row">
              <input type="checkbox" name="featured" ${editing?.featured ? "checked" : ""} />
              <span>ทำเป็นสินค้าแนะนำ</span>
            </label>
            <div class="form-actions">
              <button type="submit" class="primary-button">${editing ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}</button>
              ${
                editing
                  ? `<button type="button" class="ghost-button" data-action="cancelEditProduct">ยกเลิกการแก้ไข</button>`
                  : ""
              }
            </div>
          </form>
        </section>
        <section class="panel">
          <div class="section-head">
            <div>
              <h2>จัดการสินค้าและออเดอร์</h2>
              <p>ตารางสินค้าและรายการสั่งซื้อทั้งหมดในระบบ</p>
            </div>
          </div>
          <div class="table-like">
            ${state.products
              .map(
                (product) => `
                  <div class="table-row">
                    <div>
                      <strong>${escapeHtml(product.name)}</strong>
                      <p class="soft-text">${escapeHtml(product.category)}</p>
                    </div>
                    <div>${formatPrice(product.price)}</div>
                    <div>สต๊อก ${product.stock}</div>
                    <div>${product.featured ? "แนะนำ" : "ทั่วไป"}</div>
                    <div class="row-actions">
                      <button class="ghost-button" data-action="editProduct" data-product-id="${escapeAttr(product.id)}">แก้ไข</button>
                      <button class="danger-button" data-action="deleteProduct" data-product-id="${escapeAttr(product.id)}">ลบ</button>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="order-list" style="margin-top:18px">
            ${state.orders.map((order) => renderOrderCard(order, true)).join("")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderOrderCard(order, isAdmin) {
  const items = Array.isArray(order.items) ? order.items : [];
  return `
    <article class="order-card">
      <div class="summary-line">
        <div>
          <h4>${escapeHtml(order.customerName)}</h4>
          <p class="order-meta">
            ${formatDate(order.createdAt)} · ${escapeHtml(order.id)}
          </p>
        </div>
        <span class="status-badge status-${escapeAttr(order.status)}">
          ${statusLabels[order.status] || order.status}
        </span>
      </div>
      <div class="line-items">
        ${items
          .map(
            (item) => `
              <div class="line-item">
                <span>${escapeHtml(item.name)} x ${item.quantity}</span>
                <strong>${formatPrice(item.price * item.quantity)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="two-column">
        <div class="helper-box">
          <strong>ที่อยู่จัดส่ง</strong>
          <p class="helper-text">${escapeHtml(order.address)}</p>
          <p class="helper-text">โทร ${escapeHtml(order.phone)}</p>
        </div>
        <div class="helper-box">
          <strong>ยอดรวม</strong>
          <p class="helper-text">${formatPrice(order.total)}</p>
          <p class="helper-text">${escapeHtml(order.note || "ไม่มีหมายเหตุ")}</p>
        </div>
      </div>
      ${
        isAdmin
          ? `
            <form data-form="orderStatus" class="field-grid">
              <input type="hidden" name="orderId" value="${escapeAttr(order.id)}" />
              <div class="field-group">
                <label>อัปเดตสถานะ</label>
                <select name="status">
                  ${statusOptions
                    .map(
                      (status) => `
                        <option value="${status}" ${order.status === status ? "selected" : ""}>
                          ${statusLabels[status]}
                        </option>
                      `
                    )
                    .join("")}
                </select>
              </div>
              <button type="submit" class="secondary-button">บันทึกสถานะ</button>
            </form>
          `
          : ""
      }
    </article>
  `;
}

function formatPrice(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
