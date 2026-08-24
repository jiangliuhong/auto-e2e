import http from 'node:http';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const HTML_BODY = `<!DOCTYPE html>
<html>
<head><title>Demo App</title></head>
<body>
  <h1 data-testid="welcome-message">欢迎使用 auto-e2e Demo</h1>
  <div role="status" aria-label="正常">正常</div>
  <button type="button">禁用</button>
  <button type="button">确认</button>
  <button type="button">取消</button>
  <form action="/" method="GET">
    <div><label>用户名: <input name="username" type="text" data-testid="username-input" /></label></div>
    <div><label>密码: <input name="password" type="password" data-testid="password-input" /></label></div>
    <button type="submit" data-testid="login-submit">登录</button>
  </form>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OK');
    return;
  }

  if (url.pathname === '/admin') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML_BODY);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Demo server listening on http://127.0.0.1:${port}`);
});
