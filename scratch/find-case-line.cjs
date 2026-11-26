const fs = require('fs');
const content = fs.readFileSync('src/ui/app-view.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes("case 'proctors':")) {
    console.log((idx+1) + ': ' + l);
    console.log(lines.slice(Math.max(0, idx - 5), idx + 10).join('\n'));
  }
});
