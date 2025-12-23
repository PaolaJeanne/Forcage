// src/middlewares/cache.middleware.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 });

const dashboardCache = (duration = 300) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl}_${req.user?.role}_${req.user?.id}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {

      return res.json(cachedResponse);
    }

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(key, data, duration);
      res.set('X-Cache', 'MISS');
      res.set('Cache-Control', `public, max-age=${duration}`);
      return originalJson(data);
    };

    next();
  };
};

module.exports = dashboardCache;