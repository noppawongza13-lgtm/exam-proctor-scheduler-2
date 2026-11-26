const fs = require('fs');
const c1 = fs.readFileSync('src/ui/app-view.js', 'utf8');
const c2 = fs.readFileSync('split/js/25-app-view.js', 'utf8');
console.log('src has case proctors?', c1.includes("case 'proctors':"));
console.log('split has case proctors?', c2.includes("case 'proctors':"));
