const { program } = require('commander');
const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

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

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, options.cache);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + '.jpg');
  }
});

const upload = multer({ storage: storage });

let inventory = [];
let nextId = 1;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Сервіс інвентаризації API',
      version: '1.0.0',
      description: 'API для управління інвентарем',
    },
    servers: [
      {
        url: `http://${options.host}:${options.port}`,
      },
    ],
  },
  apis: ['./main.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.post('/register', upload.single('photo'), (req, res) => {
  if (!req.body.inventory_name) {
    return res.status(400).send("Ім'я обов'язкове");
  }

  const item = {
    id: nextId++,
    name: req.body.inventory_name,
    description: req.body.description || '',
    photo: req.file ? req.file.filename : null
  };

  inventory.push(item);
  res.status(201).json(item);
});

app.get('/inventory', (req, res) => {
  const inventoryWithLinks = inventory.map(item => ({
    ...item,
    photo_link: item.photo ? `/inventory/${item.id}/photo` : null
  }));
  res.json(inventoryWithLinks);
});

app.get('/inventory/:id', (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).send('Річ не знайдена');
  }
  
  const itemWithLink = {
    ...item,
    photo_link: item.photo ? `/inventory/${item.id}/photo` : null
  };
  res.json(itemWithLink);
});

app.put('/inventory/:id', (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).send('Річ не знайдена');
  }

  if (req.body.name) item.name = req.body.name;
  if (req.body.description) item.description = req.body.description;
  
  res.json(item);
});

app.get('/inventory/:id/photo', async (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item || !item.photo) {
    return res.status(404).send('Фото не знайдено');
  }

  try {
    const photoPath = path.join(options.cache, item.photo);
    const image = await fs.readFile(photoPath);
    res.set('Content-Type', 'image/jpeg');
    res.send(image);
  } catch (err) {
    res.status(404).send('Фото не знайдено');
  }
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).send('Річ не знайдена');
  }

  if (!req.file) {
    return res.status(400).send('Фото відсутнє');
  }

  item.photo = req.file.filename;
  res.json(item);
});

app.delete('/inventory/:id', (req, res) => {
  const index = inventory.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).send('Річ не знайдена');
  }

  inventory.splice(index, 1);
  res.send('Річ видалена');
});

app.get('/RegisterForm.html', (req, res) => {
  res.send(`
    <form action="/register" method="post" enctype="multipart/form-data">
      <input type="text" name="inventory_name" placeholder="Ім'я" required>
      <textarea name="description" placeholder="Опис"></textarea>
      <input type="file" name="photo" accept="image/*">
      <button type="submit">Зареєструвати</button>
    </form>
  `);
});

app.get('/SearchForm.html', (req, res) => {
  res.send(`
    <form action="/search" method="post">
      <input type="number" name="id" placeholder="ID" required>
      <label><input type="checkbox" name="has_photo"> Додати посилання на фото</label>
      <button type="submit">Пошук</button>
    </form>
  `);
});

app.post('/search', (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.body.id));
  if (!item) {
    return res.status(404).send('Річ не знайдена');
  }

  const result = { ...item };
  if (req.body.has_photo && item.photo) {
    result.photo_link = `/inventory/${item.id}/photo`;
  }

  res.json(result);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Сервіс інвентаризації</h1>
    <ul>
      <li><a href="/RegisterForm.html">Форма реєстрації</a></li>
      <li><a href="/SearchForm.html">Форма пошуку</a></li>
      <li><a href="/inventory">Список інвентарю (JSON)</a></li>
      <li><a href="/docs">Документація Swagger</a></li>
    </ul>
  `);
});

app.use((req, res) => {
  res.status(405).send('Метод не підтримується');
});

app.listen(options.port, options.host, () => {
  console.log(`Сервіс інвентаризації запущено на http://${options.host}:${options.port}`);
  console.log(`Документація Swagger доступна за адресою: http://${options.host}:${options.port}/docs`);
});