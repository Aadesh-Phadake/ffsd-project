// filepath: d:\Documents\ffsd project\init\initOffers.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('offers.db');

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS offers (id INTEGER PRIMARY KEY, description TEXT, discountPercentage INTEGER, isActive INTEGER)");

  // Insert a sample offer
  db.run("INSERT INTO offers (description, discountPercentage, isActive) VALUES ('Spring Sale', 10, 1)");
});

db.close();