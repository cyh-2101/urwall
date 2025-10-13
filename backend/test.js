console.log('Test file started');
require('dotenv').config();
console.log('After dotenv config');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('All keys:', Object.keys(process.env).filter(k => k.startsWith('DB_')));