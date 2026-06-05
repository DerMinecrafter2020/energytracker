const Redis = require('ioredis');
const redis = new Redis('redis://127.0.0.1:6379');
redis.get('koffein:translations').then(data => {
  console.log(data ? data.slice(0, 500) + '...' : 'null');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
