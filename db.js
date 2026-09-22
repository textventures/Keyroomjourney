const MongoClient = require('mongodb').MongoClient;

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI environment variable is not set');
}

const mongoClient = new MongoClient(process.env.MONGO_URI, {useUnifiedTopology: true});

module.exports = mongoClient;