// src/services/cache.service.js
const redis = require('redis');
const client = redis.createClient();

const cache = {
  set: async (key, value, ttl = 3600) => {
    await client.setEx(key, ttl, JSON.stringify(value));
  },
  get: async (key) => {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }
};