const mongo = require('./db');

(async function () {
    await mongo.connect();

    let db = mongo.db("test");
    let collection =  db.collection("test");

    collection.find().toArray(function(err, result) {
        console.log(result);
        mongo.close();
    });
}())

