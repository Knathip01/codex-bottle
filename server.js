const http = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PUBLIC_DIR = path.join(__dirname, "public");
const LOCAL_DATA_FILE = path.join(__dirname, "data", "store.json");
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8);
const TOKEN_SECRET = process.env.TOKEN_SECRET || "bottleapp-demo-token-secret";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function encodeBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(input) {
  const normalized = String(input).replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signTokenPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function createSessionToken(userId) {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const encodedPayload = encodeBase64Url(payload);
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  const [encodedPayload, providedSignature] = String(token || "").split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));

    if (!payload.userId || !payload.exp || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function resolveDataFile(dataFile) {
  if (dataFile) {
    return path.resolve(dataFile);
  }

  if (process.env.DATA_FILE) {
    return path.resolve(process.env.DATA_FILE);
  }

  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "bottleapp-store.json");
  }

  return LOCAL_DATA_FILE;
}

const DEFAULT_DATA_FILE = resolveDataFile();

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function createPasswordRecord(password) {
  const salt = crypto.randomUUID();
  return {
    salt,
    passwordHash: hashPassword(password, salt),
  };
}

function createSeedData() {
  const userRecord = createPasswordRecord("demo123");
  const userRecord2 = createPasswordRecord("member123");
  const adminRecord = createPasswordRecord("admin123");

  return {
    users: [
      {
        id: "user_demo",
        username: "demo",
        fullName: "Nina Shopper",
        role: "user",
        salt: userRecord.salt,
        passwordHash: userRecord.passwordHash,
      },
      {
        id: "user_member",
        username: "member",
        fullName: "Pond Retail",
        role: "user",
        salt: userRecord2.salt,
        passwordHash: userRecord2.passwordHash,
      },
      {
        id: "admin_root",
        username: "admin",
        fullName: "Store Admin",
        role: "admin",
        salt: adminRecord.salt,
        passwordHash: adminRecord.passwordHash,
      },
    ],
    products: [
      {
        id: "prod_aero_flask",
        name: "Aero Flask 650ml",
        category: "Outdoor",
        price: 490,
        stock: 18,
        tone: "ember",
        featured: true,
        description: "ขวดน้ำสเตนเลสเก็บเย็น เหมาะกับวันทำงานและออกทริป",
      },
      {
        id: "prod_studio_tumbler",
        name: "Studio Tumbler 420ml",
        category: "Office",
        price: 350,
        stock: 25,
        tone: "lagoon",
        featured: true,
        description: "แก้วพกพาทรงเรียบสำหรับโต๊ะทำงานและร้านกาแฟ",
      },
      {
        id: "prod_kids_splash",
        name: "Kids Splash Bottle",
        category: "Family",
        price: 290,
        stock: 12,
        tone: "berry",
        featured: false,
        description: "ขวดน้ำเด็กน้ำหนักเบา เปิดง่าย พร้อมสายคล้อง",
      },
      {
        id: "prod_cold_brew",
        name: "Cold Brew Canister",
        category: "Kitchen",
        price: 560,
        stock: 9,
        tone: "cobalt",
        featured: false,
        description: "ภาชนะชงชาและกาแฟเย็นแบบกรองในตัว สำหรับใช้งานในบ้าน",
      },
      {
        id: "prod_trail_thermos",
        name: "Trail Thermos 900ml",
        category: "Travel",
        price: 690,
        stock: 7,
        tone: "mint",
        featured: true,
        description: "กระติกเก็บร้อนเก็บเย็นขนาดใหญ่ สำหรับเดินทางไกล",
      },
      {
        id: "prod_glass_bottle",
        name: "Minimal Glass Bottle",
        category: "Lifestyle",
        price: 410,
        stock: 16,
        tone: "sand",
        featured: false,
        description: "ขวดแก้วลุคมินิมอล พร้อมปลอกซิลิโคนกันลื่น",
      },
    ],
    orders: [
      {
        id: "order_seed_001",
        userId: "user_demo",
        customerName: "Nina Shopper",
        phone: "0812345678",
        address: "88 ถนนสุขุมวิท กรุงเทพฯ 10110",
        note: "ฝากส่งช่วงบ่าย",
        status: "shipped",
        createdAt: "2026-04-18T10:30:00.000Z",
        updatedAt: "2026-04-19T05:45:00.000Z",
        total: 980,
        items: [
          {
            productId: "prod_aero_flask",
            name: "Aero Flask 650ml",
            quantity: 2,
            price: 490,
          },
        ],
      },
    ],
  };
}

async function ensureSeedFile(dataFile) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(createSeedData(), null, 2), "utf8");
  }
}

function createStore(dataFile) {
  let writeQueue = Promise.resolve();

  async function read() {
    await ensureSeedFile(dataFile);
    const raw = await fs.readFile(dataFile, "utf8");
    return JSON.parse(raw);
  }

  async function write(data) {
    await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
  }

  function update(mutator) {
    const next = writeQueue.then(async () => {
      const data = await read();
      const result = await mutator(data);
      await write(data);
      return result;
    });

    writeQueue = next.catch(() => {});
    return next;
  }

  return { read, update, dataFile };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  };
}

function nowIso() {
  return new Date().toISOString();
}

async function getAuthContext(req, store) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice(7);
  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const data = await store.read();
  const user = data.users.find((entry) => entry.id === payload.userId);

  if (!user) {
    return null;
  }

  return { token, user };
}

async function parseJsonBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        throw createHttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
      }
    }

    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString("utf8"));
      } catch {
        throw createHttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
      }
    }

    if (typeof req.body === "object" && req.body !== null) {
      return req.body;
    }
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw createHttpError(413, "Request body too large");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createHttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function verifyRole(auth, role) {
  if (!auth) {
    throw createHttpError(401, "กรุณาเข้าสู่ระบบก่อน");
  }

  if (role && auth.user.role !== role) {
    throw createHttpError(403, "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้");
  }
}

function normalizeProductInput(body) {
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock);
  const tone = String(body.tone || "lagoon").trim();
  const featured = Boolean(body.featured);

  if (!name || !category || !description) {
    throw createHttpError(400, "กรุณากรอกชื่อสินค้า หมวดหมู่ และรายละเอียด");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw createHttpError(400, "ราคาสินค้าต้องมากกว่า 0");
  }

  if (!Number.isInteger(stock) || stock < 0) {
    throw createHttpError(400, "จำนวนสต๊อกต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
  }

  return {
    name,
    category,
    description,
    price,
    stock,
    tone,
    featured,
  };
}

function buildAdminSummary(data) {
  const totalSales = data.orders.reduce((sum, order) => sum + order.total, 0);
  const pendingOrders = data.orders.filter((order) =>
    ["pending", "paid", "packing"].includes(order.status)
  ).length;
  const lowStockCount = data.products.filter((product) => product.stock <= 8).length;

  return {
    productCount: data.products.length,
    orderCount: data.orders.length,
    pendingOrders,
    lowStockCount,
    totalSales,
  };
}

function safeProductSnapshot(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    price: product.price,
    stock: product.stock,
    tone: product.tone,
    featured: product.featured,
  };
}

async function handleApiRequest(req, res, url, store) {
  const pathname = url.pathname;
  const method = req.method || "GET";
  const auth = await getAuthContext(req, store);

  if (method === "GET" && pathname === "/api/products") {
    const data = await store.read();
    sendJson(res, 200, data.products.map(safeProductSnapshot));
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await parseJsonBody(req);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const requestedRole = String(body.role || "").trim();

    if (!username || !password) {
      throw createHttpError(400, "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    }

    const data = await store.read();
    const user = data.users.find((entry) => entry.username.toLowerCase() === username);

    if (!user) {
      throw createHttpError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }

    if (requestedRole && requestedRole !== user.role) {
      throw createHttpError(403, "บัญชีนี้ไม่ตรงกับสิทธิ์ที่เลือก");
    }

    const incomingHash = hashPassword(password, user.salt);
    if (incomingHash !== user.passwordHash) {
      throw createHttpError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }

    const token = createSessionToken(user.id);

    sendJson(res, 200, {
      token,
      user: sanitizeUser(user),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    sendNoContent(res);
    return;
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    verifyRole(auth);
    sendJson(res, 200, {
      user: sanitizeUser(auth.user),
    });
    return;
  }

  if (method === "GET" && pathname === "/api/orders") {
    verifyRole(auth);
    const data = await store.read();
    const orders =
      auth.user.role === "admin"
        ? data.orders
        : data.orders.filter((order) => order.userId === auth.user.id);

    sendJson(res, 200, orders);
    return;
  }

  if (method === "POST" && pathname === "/api/orders") {
    verifyRole(auth, "user");
    const body = await parseJsonBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    const customerName = String(body.customerName || auth.user.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const note = String(body.note || "").trim();

    if (!items.length) {
      throw createHttpError(400, "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
    }

    if (!customerName || !phone || !address) {
      throw createHttpError(400, "กรุณากรอกชื่อผู้รับ เบอร์โทร และที่อยู่");
    }

    const order = await store.update(async (data) => {
      const productsById = new Map(data.products.map((product) => [product.id, product]));
      const normalizedItems = items.map((entry) => {
        const product = productsById.get(String(entry.productId || ""));
        const quantity = Number(entry.quantity);

        if (!product) {
          throw createHttpError(400, "พบสินค้าที่ไม่มีอยู่ในระบบ");
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw createHttpError(400, "จำนวนสินค้าไม่ถูกต้อง");
        }

        if (product.stock < quantity) {
          throw createHttpError(400, `${product.name} มีสต๊อกไม่เพียงพอ`);
        }

        return {
          product,
          quantity,
        };
      });

      const preparedItems = normalizedItems.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        quantity,
        price: product.price,
      }));

      const total = preparedItems.reduce(
        (sum, entry) => sum + entry.price * entry.quantity,
        0
      );

      normalizedItems.forEach(({ product, quantity }) => {
        product.stock -= quantity;
      });

      const createdAt = nowIso();
      const newOrder = {
        id: `order_${crypto.randomUUID()}`,
        userId: auth.user.id,
        customerName,
        phone,
        address,
        note,
        status: "pending",
        createdAt,
        updatedAt: createdAt,
        total,
        items: preparedItems,
      };

      data.orders.unshift(newOrder);
      return newOrder;
    });

    sendJson(res, 201, order);
    return;
  }

  if (method === "PATCH" && pathname.startsWith("/api/orders/")) {
    verifyRole(auth, "admin");
    const orderId = pathname.split("/").pop();
    const body = await parseJsonBody(req);
    const nextStatus = String(body.status || "").trim();
    const allowedStatuses = ["pending", "paid", "packing", "shipped", "completed"];

    if (!allowedStatuses.includes(nextStatus)) {
      throw createHttpError(400, "สถานะออเดอร์ไม่ถูกต้อง");
    }

    const updatedOrder = await store.update(async (data) => {
      const order = data.orders.find((entry) => entry.id === orderId);

      if (!order) {
        throw createHttpError(404, "ไม่พบออเดอร์ที่ต้องการอัปเดต");
      }

      order.status = nextStatus;
      order.updatedAt = nowIso();
      return order;
    });

    sendJson(res, 200, updatedOrder);
    return;
  }

  if (method === "GET" && pathname === "/api/admin/summary") {
    verifyRole(auth, "admin");
    const data = await store.read();
    sendJson(res, 200, buildAdminSummary(data));
    return;
  }

  if (method === "POST" && pathname === "/api/products") {
    verifyRole(auth, "admin");
    const body = await parseJsonBody(req);
    const input = normalizeProductInput(body);

    const product = await store.update(async (data) => {
      const nextProduct = {
        id: `prod_${crypto.randomUUID()}`,
        ...input,
      };
      data.products.unshift(nextProduct);
      return nextProduct;
    });

    sendJson(res, 201, product);
    return;
  }

  if (method === "PUT" && pathname.startsWith("/api/products/")) {
    verifyRole(auth, "admin");
    const productId = pathname.split("/").pop();
    const body = await parseJsonBody(req);
    const input = normalizeProductInput(body);

    const product = await store.update(async (data) => {
      const existing = data.products.find((entry) => entry.id === productId);

      if (!existing) {
        throw createHttpError(404, "ไม่พบสินค้าที่ต้องการแก้ไข");
      }

      Object.assign(existing, input);
      return existing;
    });

    sendJson(res, 200, product);
    return;
  }

  if (method === "DELETE" && pathname.startsWith("/api/products/")) {
    verifyRole(auth, "admin");
    const productId = pathname.split("/").pop();

    const deleted = await store.update(async (data) => {
      const index = data.products.findIndex((entry) => entry.id === productId);

      if (index === -1) {
        throw createHttpError(404, "ไม่พบสินค้าที่ต้องการลบ");
      }

      const [removed] = data.products.splice(index, 1);
      return removed;
    });

    sendJson(res, 200, deleted);
    return;
  }

  throw createHttpError(404, "ไม่พบ API ที่ร้องขอ");
}

async function sendStaticFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const content = await fs.readFile(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": content.length,
  });
  res.end(content);
}

async function handleStaticRequest(req, res, url) {
  const normalizedPath = decodeURIComponent(url.pathname);
  const requested = normalizedPath === "/" ? "/index.html" : normalizedPath;
  const cleanPath = path.normalize(requested).replace(/^[/\\]+/, "");
  let filePath = path.resolve(PUBLIC_DIR, cleanPath);
  const relativeToPublic = path.relative(PUBLIC_DIR, filePath);

  if (relativeToPublic.startsWith("..") || path.isAbsolute(relativeToPublic)) {
    throw createHttpError(403, "ไม่พบไฟล์ที่ร้องขอ");
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    await sendStaticFile(res, filePath);
    return;
  } catch (error) {
    const wantsHtml =
      !path.extname(cleanPath) ||
      String(req.headers.accept || "").includes("text/html");

    if (wantsHtml) {
      await sendStaticFile(res, path.join(PUBLIC_DIR, "index.html"));
      return;
    }

    throw error;
  }
}

function createRequestHandler(store) {
  return async (req, res) => {
    const origin = `http://${req.headers.host || "localhost"}`;
    const url = new URL(req.url || "/", origin);

    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApiRequest(req, res, url, store);
        return;
      }

      await handleStaticRequest(req, res, url);
    } catch (error) {
      const status = error.status || (error.code === "ENOENT" ? 404 : 500);
      const message =
        status === 500 ? "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" : error.message;

      if (url.pathname.startsWith("/api/")) {
        sendJson(res, status, { error: message });
        return;
      }

      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(message);
    }
  };
}

async function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const dataFile = resolveDataFile(options.dataFile);
  const store = createStore(dataFile);
  const server = http.createServer(createRequestHandler(store));

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });

  return {
    port: server.address().port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
    server,
    store,
  };
}

if (require.main === module) {
  startServer()
    .then(({ port, store }) => {
      console.log(`Bottleapp Store running on http://localhost:${port}`);
      console.log(`Data file: ${store.dataFile}`);
      console.log("User login: demo / demo123");
      console.log("Admin login: admin / admin123");
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_DATA_FILE,
  createRequestHandler,
  createStore,
  createSeedData,
  resolveDataFile,
  startServer,
};
