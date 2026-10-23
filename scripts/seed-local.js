const fs = require('fs');
const path = require('path');

const database = path.join(__dirname, '..', 'data', 'sanjeevani.json');
if (fs.existsSync(database)) fs.rmSync(database);
console.log('Local Sanjeevani seed cleared. Start the server once to recreate the deterministic demo dataset.');
