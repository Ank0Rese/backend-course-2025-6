const { program } = require('commander');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

program
  .option('-h, --host <address>', 'адреса сервера')
  .option('-p, --port <number>', 'порт сервера')
  .option('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

if (!options.host) {
  console.error("Помилка: не задано обов'язковий параметр --host");
  process.exit(1);
}
if (!options.port) {
  console.error("Помилка: не задано обов'язковий параметр --port");
  process.exit(1);
}
if (!options.cache) {
  console.error("Помилка: не задано обов'язковий параметр --cache");
  process.exit(1);
}

fs.mkdir(options.cache, { recursive: true }).catch(err => {
  console.error('Помилка створення директорії кешу:', err);
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Сервіс інвентаризації - сервер працює!');
});

server.listen(options.port, options.host, () => {
  console.log(`Сервіс інвентаризації запущено на http://${options.host}:${options.port}`);
  console.log(`Директорія кешу: ${options.cache}`);
});