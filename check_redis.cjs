const Redis = require('ioredis');
const redis = new Redis();
redis.get('koffein:translations').then(console.log).finally(() => redis.quit());
