const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    ["/login", "/callback", "/api"],
    createProxyMiddleware({
      target: "http://localhost:8888",
      changeOrigin: true,
    })
  );
};
