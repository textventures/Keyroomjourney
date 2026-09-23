require('dotenv').config()
const db = require('./db');

const users = db.prepare('SELECT * FROM users').all();
console.log(users);
