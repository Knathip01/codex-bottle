const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { startServer } = require("../server");

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Request failed for ${pathname}`);
  }

  return payload;
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bottleapp-smoke-"));
  const dataFile = path.join(tempDir, "store.json");
  const runtime = await startServer({ port: 0, dataFile });
  const baseUrl = `http://127.0.0.1:${runtime.port}`;

  try {
    const products = await requestJson(baseUrl, "/api/products");
    assert.ok(Array.isArray(products) && products.length >= 3, "Should return seed products");

    const userLogin = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "demo",
        password: "demo123",
        role: "user",
      }),
    });

    assert.equal(userLogin.user.role, "user");

    const product = products.find((entry) => entry.stock > 1);
    assert.ok(product, "Should have an in-stock product");

    const order = await requestJson(baseUrl, "/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userLogin.token}`,
      },
      body: JSON.stringify({
        customerName: "Smoke Test",
        phone: "0800000000",
        address: "123 Test Street",
        note: "Automated order",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });

    assert.equal(order.status, "pending");

    const adminLogin = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "admin123",
        role: "admin",
      }),
    });

    const summary = await requestJson(baseUrl, "/api/admin/summary", {
      headers: {
        Authorization: `Bearer ${adminLogin.token}`,
      },
    });

    assert.ok(summary.orderCount >= 2, "Admin summary should include new order");

    const updatedOrder = await requestJson(baseUrl, `/api/orders/${order.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({ status: "paid" }),
    });

    assert.equal(updatedOrder.status, "paid");

    console.log("Smoke test passed");
  } finally {
    await runtime.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
