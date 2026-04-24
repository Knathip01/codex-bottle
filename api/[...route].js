const {
  createRequestHandler,
  createStore,
  resolveDataFile,
} = require("../server");

let requestHandlerPromise;

function getRequestHandler() {
  if (!requestHandlerPromise) {
    requestHandlerPromise = Promise.resolve().then(() => {
      const store = createStore(resolveDataFile(), {
        mode: "memory",
      });

      return createRequestHandler(store);
    });

    requestHandlerPromise = requestHandlerPromise.catch((error) => {
      requestHandlerPromise = null;
      throw error;
    });
  }

  return requestHandlerPromise;
}

async function apiHandler(req, res) {
  try {
    const handler = await getRequestHandler();
    await handler(req, res);
  } catch (error) {
    console.error("Bottleapp API invocation failed", error);

    if (res.headersSent) {
      return;
    }

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Server initialization failed" }));
  }
}

module.exports = apiHandler;
