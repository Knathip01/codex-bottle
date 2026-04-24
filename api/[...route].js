const {
  createRequestHandler,
  createStore,
  resolveDataFile,
} = require("../server");

const store = createStore(resolveDataFile());
const handler = createRequestHandler(store);

module.exports = async (req, res) => handler(req, res);
