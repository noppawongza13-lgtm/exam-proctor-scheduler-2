import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // API Route for multi-device state synchronization (PC <-> Mobile)
  if (reqPath === '/api/state') {
    const dataDir = path.join(__dirname, 'data');
    const stateFile = path.join(dataDir, 'shared_state.json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Length': '0'
      });
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const urlQuery = req.url.split('?')[1] || '';
      // เช็คการเปลี่ยนแปลงแบบ lightweight (เฉพาะ timestamp)
      if (urlQuery.includes('check=1')) {
        let updatedAt = 0;
        if (fs.existsSync(stateFile)) {
          try {
            const stat = fs.statSync(stateFile);
            updatedAt = Math.round(stat.mtimeMs);
          } catch (e) {}
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(JSON.stringify({ updatedAt }));
        return;
      }

      if (fs.existsSync(stateFile)) {
        try {
          const content = fs.readFileSync(stateFile, 'utf8');
          const stat = fs.statSync(stateFile);
          const stateObj = JSON.parse(content);
          if (!stateObj.updatedAt) {
            stateObj.updatedAt = Math.round(stat.mtimeMs);
          }
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          });
          res.end(JSON.stringify(stateObj));
          return;
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Failed to read shared state' }));
          return;
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'State not found' }));
        return;
      }
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 25 * 1024 * 1024) { // 25MB limit
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          parsed.updatedAt = Date.now();
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
          fs.writeFileSync(stateFile, JSON.stringify(parsed), 'utf8');
          const stat = fs.statSync(stateFile);
          const mtime = Math.round(stat.mtimeMs);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true, updatedAt: mtime }));
        } catch (e) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ error: 'Invalid JSON state' }));
        }
      });
      return;
    }
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // ป้องกัน Directory Traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h3>404 Not Found: ${reqPath}</h3><p><a href="/">กลับหน้าระบบจัดห้องคุมสอบ กพ. และคุรุสภา</a></p>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.log(`⚠️ พอร์ต ${PORT} กำลังถูกใช้งาน กำลังสลับไปพอร์ต ${nextPort}...`);
    server.listen(nextPort);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  const actualPort = server.address().port;
  const url = `http://localhost:${actualPort}/`;

  // ค้นหา Local IP สำหรับเปิดบนโทรศัพท์มือถือผ่าน Wi-Fi
  const networkInterfaces = os.networkInterfaces();
  const mobileIps = [];
  for (const interfaceName of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[interfaceName]) {
      if (net.family === 'IPv4' && !net.internal) {
        mobileIps.push(net.address);
      }
    }
  }

  console.log('============================================================');
  console.log('🎓 ระบบจัดห้องคุมสอบ กพ. และคุรุสภา (มหาวิทยาลัยราชภัฏบุรีรัมย์)');
  console.log(`💻 สำหรับคอมพิวเตอร์เครื่องนี้: ${url}`);
  if (mobileIps.length > 0) {
    console.log('------------------------------------------------------------');
    console.log('📱 สำหรับเปิดดูในโทรศัพท์มือถือ (เชื่อมต่อ Wi-Fi วงเดียวกัน):');
    mobileIps.forEach(ip => {
      console.log(`   👉 http://${ip}:${actualPort}/`);
    });
    console.log('💡 วิธีเปิดในมือถือ: เชื่อมต่อ Wi-Fi เดียวกัน แล้วเปิดเบราว์เซอร์พิมพ์ URL ด้านบน');
  }
  console.log('------------------------------------------------------------');
  console.log('💡 กำลังเปิดหน้าเว็บในเบราว์เซอร์ให้อัตโนมัติ... (กด Ctrl+C เพื่อหยุด)');
  console.log('============================================================\n');

  // เปิดเบราว์เซอร์ให้อัตโนมัติบน Windows
  try {
    exec(`start ${url}`);
  } catch (e) {}
});

