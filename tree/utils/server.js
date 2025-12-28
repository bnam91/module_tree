const fs = require('fs');
const http = require('http');

function startServer(html, options) {
  const {
    cssFile,
    preferPort = 0,
    buildTree,
    loadState,
    saveState,
    openInBrowser,
  } = options;

  const server = http.createServer((req, res) => {
    if (req.url === '/style.css') {
      try {
        const css = fs.readFileSync(cssFile, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        res.end(css);
      } catch (_) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found');
      }
      return;
    }

    if (req.url === '/state' && req.method === 'GET') {
      Promise.resolve()
        .then(() => loadState())
        .then((state) => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(state));
        })
        .catch(() => {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'failed to load state' }));
        });
      return;
    }

    if (req.url === '/state' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body || '{}');
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'invalid JSON' }));
          return;
        }

        Promise.resolve()
          .then(() => saveState(parsed || {}))
          .then(() => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
          })
          .catch(() => {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'failed to save state' }));
          });
      });
      return;
    }

    if (req.url === '/tree' && req.method === 'GET') {
      try {
        const fresh = buildTree();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(fresh));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'failed to build tree' }));
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  server.listen(preferPort, () => {
    const { port } = server.address();
    const url = `http://localhost:${port}/`;
    console.log(`[INFO] 트리 서버 시작: ${url}`);
    if (typeof openInBrowser === 'function') {
      openInBrowser(url);
    }
  });
}

module.exports = { startServer };

