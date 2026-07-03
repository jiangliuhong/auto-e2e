// 最小 HTTP server,供 local-node-environment 测试使用。
// 监听 PORT 环境变量指定端口(默认 4321),启动即就绪。
import http from 'node:http'

const port = Number(process.env.PORT ?? 4321)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ok')
})

server.listen(port, () => {
  // 写一行到 stdout 让父进程知道正在监听
  process.stdout.write(`mini-server listening on ${port}\n`)
})

// 优雅退出
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
