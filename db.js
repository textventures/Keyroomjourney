const MongoClient = require('mongodb').MongoClient;

const mongoClient = new MongoClient('mongodb+srv://unraujoe:cr34Mt34M@nifty-wizards.mnw9w.mongodb.net/', {useUnifiedTopology: true});

module.exports = mongoClient;