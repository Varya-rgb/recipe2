
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'recipe-secret-key';

// Middleware - ДОБАВЬТЕ ЭТО
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Обслуживаем статические файлы

// MySQL подключение (Laragon)
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'recipe_site'
});


// Инициализация базы данных
// Инициализация базы данных
async function initDatabase() {
  try {
    // Создаем базу данных если не существует
    /* await db.promise().execute('CREATE DATABASE IF NOT EXISTS `recipe_site`');
    await db.promise().execute('USE `recipe_site`'); */

    // Таблица пользователей - УПРОЩЕННАЯ ВЕРСИЯ
    // В функции initDatabase() обнови создание таблицы users:
await db.promise().execute(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

    // Таблица рецептов - УПРОЩЕННАЯ ВЕРСИЯ
    await db.promise().execute(`
      CREATE TABLE IF NOT EXISTS recipes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        ingredients TEXT NOT NULL,
        instructions TEXT NOT NULL,
        cooking_time INT,
        difficulty ENUM('Легко', 'Средняя', 'Сложно'),
        servings INT,
        image_url VARCHAR(500),
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица закладок
    await db.promise().execute(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        recipe_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_bookmark (user_id, recipe_id)
      )
    `);

    // Добавляем тестовые данные - УПРОЩЕННАЯ ВЕРСИЯ
    const [users] = await db.promise().execute('SELECT COUNT(*) as count FROM users');
    if (users[0].count === 0) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      
      // Тестовый пользователь
      await db.promise().execute(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        ['Тестовый Пользователь', 'test@example.com', hashedPassword]
      );

      // Тестовые рецепты - ПРОСТОЙ ТЕКСТ вместо JSON
      // В функции initDatabase(), в разделе тестовых данных, замените:
const sampleRecipes = [
    {
    id: 1,
    title: "Паста Карбонара",
    description: "Классическая итальянская паста с беконом и сыром",
    ingredients: ["спагетти", "бекон", "яйца", "пармезан", "чеснок"],
    cookingTime: 20,
    difficulty: "средняя"
  },
  {
    id: 2,
    title: "Салат Цезарь",
    description: "Свежий салат с курицей и соусом цезарь",
    ingredients: ["салат айсберг", "курица", "гренки", "пармезан", "соус цезарь"],
    cookingTime: 15,
    difficulty: "легкая"
  },
  {
    id: 3,
    title: "Шоколадный торт",
    description: "Нежный шоколадный десерт",
    ingredients: ["мука", "какао", "яйца", "сахар", "сливочное масло"],
    cookingTime: 60,
    difficulty: "сложная"
  }
];



      for (const recipe of sampleRecipes) {
        await db.promise().execute(
          `INSERT INTO recipes (title, description, ingredients, instructions, cooking_time, difficulty, servings, image_
          , user_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [recipe.title, recipe.description, recipe.ingredients, recipe.instructions, 
           recipe.cooking_time, recipe.difficulty, recipe.servings, recipe.image_url, recipe.user_id]
        );
      }
      
      console.log('✅ Тестовые данные добавлены');
    }

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
  }
}

// Middleware для проверки токена
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Неверный токен' });
    }
    req.user = user;
    next();
  });
}

// API Routes

// Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email|| !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.promise().execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    const token = jwt.sign({ userId: result.insertId, email }, JWT_SECRET);
    // Генерируем дефолтный аватар
const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff6b6b&color=fff&size=120`;
    res.json({
      message: 'Регистрация успешна',
      token,
      user: { id: result.insertId, name, email }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email уже используется' });
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
  
});

// Вход
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await db.promise().execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET);
    
    res.json({
      message: 'Вход успешен',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//Обновление аватара пользователя
app.put('/api/avatar', authenticateToken, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    
    console.log('Обновление аватара для пользователя:', req.user.userId);
    console.log('Новый URL аватара:', avatarUrl);
    
    // Базовая валидация URL
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'URL аватара обязателен' });
    }
    
    // Проверяем что это HTTP/HTTPS URL
    if (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Некорректный URL. Используйте http:// или https://' });
    }
    
    // Проверяем что это изображение (опционально, можно убрать если мешает)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const urlLower = avatarUrl.toLowerCase();
    const isImage = imageExtensions.some(ext => urlLower.includes(ext));
    
    if (!isImage) {
      console.log('URL не содержит расширение изображения:', avatarUrl);
      // Не блокируем, но предупреждаем
    }
    
    // Обновляем в БД
    await db.promise().execute(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, req.user.userId]
    );
    
    // Получаем обновленные данные пользователя
    const [users] = await db.promise().execute(
      'SELECT id, name, email, avatar_url FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const updatedUser = users[0];
    
    res.json({ 
      message: 'Аватар успешно обновлен',
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Ошибка обновления аватара:', error);
    res.status(500).json({ error: 'Ошибка обновления аватара' });
  }
});

// Получение данных пользователя (уже должно быть, обнови чтобы включать avatar_url)
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.promise().execute(
      'SELECT id, name, email, avatar_url FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Ошибка получения данных пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения данных пользователя' });
  }
});

// здесь добавила как API Получение одного рецепта
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const [recipes] = await db.promise().execute(`
      SELECT r.*, u.name as author_name 
      FROM recipes r 
      LEFT JOIN users u ON r.user_id = u.id 
      WHERE r.id = ?
    `, [req.params.id]);

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Рецепт не найден' });
    }

    const recipe = {
      ...recipes[0],
      ingredients: recipes[0].ingredients.split(', '),
      instructions: recipes[0].instructions.split('\n')
    };

    res.json(recipe);
  } catch (error) {
    console.error('Ошибка получения рецепта:', error);
    res.status(500).json({ error: 'Ошибка получения рецепта' });
  }
});

// Добавление в закладки
app.post('/api/bookmarks', async (req, res) => {
  try {
    const { recipe_id } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    await db.promise().execute(
      'INSERT INTO bookmarks (user_id, recipe_id) VALUES (?, ?)',
      [decoded.userId, recipe_id]
    );

    res.json({ message: 'Рецепт добавлен в закладки' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Рецепт уже в закладках' });
    }
    console.error('Ошибка добавления в закладки:', error);
    res.status(500).json({ error: 'Ошибка добавления в закладки' });
  }
});

// Удаление из закладок
app.delete('/api/bookmarks/:recipe_id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    await db.promise().execute(
      'DELETE FROM bookmarks WHERE user_id = ? AND recipe_id = ?',
      [decoded.userId, req.params.recipe_id]
    );

    res.json({ message: 'Рецепт удален из закладок' });
  } catch (error) {
    console.error('Ошибка удаления из закладок:', error);
    res.status(500).json({ error: 'Ошибка удаления из закладок' });
  }
});

// Получение закладок пользователя
app.get('/api/bookmarks', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const [bookmarks] = await db.promise().execute(`
      SELECT r.*, u.name as author_name 
      FROM recipes r 
      JOIN bookmarks b ON r.id = b.recipe_id 
      LEFT JOIN users u ON r.user_id = u.id 
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [decoded.userId]);

    const parsedRecipes = bookmarks.map(recipe => ({
      ...recipe,
      ingredients: recipe.ingredients.split(', '),
      instructions: recipe.instructions.split('\n')
    }));

    res.json(parsedRecipes);
  } catch (error) {
    console.error('Ошибка получения закладок:', error);
    res.status(500).json({ error: 'Ошибка получения закладок' });
  }
});
// вставленная версия^^^^^^^
// Получение рецептов - УПРОЩЕННАЯ ВЕРСИЯ
app.get('/api/recipes', async (req, res) => {
  try {
    const [recipes] = await db.promise().execute(`
      SELECT r.*, u.name as author_name 
      FROM recipes r 
      LEFT JOIN users u ON r.user_id = u.id 
      ORDER BY r.created_at DESC
    `);
    
    // Преобразуем текстовые поля в массивы
    const parsedRecipes = recipes.map(recipe => ({
      ...recipe,
      ingredients: recipe.ingredients.split(', '), // Простое разделение по запятой
      instructions: recipe.instructions.split('\n') // Разделение по переносам строк
    }));
    
    res.json(parsedRecipes);
  } catch (error) {
    console.error('Ошибка получения рецептов:', error);
    res.status(500).json({ error: 'Ошибка получения рецептов' });
  }
});

// Получение одного рецепта
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const [recipes] = await db.promise().execute(`
      SELECT r.*, u.name as author_name 
      FROM recipes r 
      LEFT JOIN users u ON r.user_id = u.id 
      WHERE r.id = ?
    `, [req.params.id]);

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Рецепт не найден' });
    }

    const recipe = {
      ...recipes[0],
      ingredients: JSON.parse(recipes[0].ingredients),
      instructions: JSON.parse(recipes[0].instructions)
    };

    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения рецепта' });
  }
});

// Добавление рецепта
app.post('/api/recipes', authenticateToken, async (req, res) => {
  try {
    const { title, description, ingredients, instructions, cooking_time, difficulty, servings, image_url } = req.body;
    
    const [result] = await db.promise().execute(
      `INSERT INTO recipes (title, description, ingredients, instructions, cooking_time, difficulty, servings, image_url, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, JSON.stringify(ingredients), JSON.stringify(instructions), 
       cooking_time, difficulty, servings, image_url, req.user.userId]
    );

    res.json({ message: 'Рецепт добавлен', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка добавления рецепта' });
  }
});

// Закладки
app.post('/api/bookmarks', authenticateToken, async (req, res) => {
  try {
    const { recipe_id } = req.body;
    
    await db.promise().execute(
      `INSERT INTO bookmarks (user_id, recipe_id) VALUES (?, ?)`,
      [req.user.userId, recipe_id]
    );

    res.json({ message: 'Рецепт добавлен в закладки' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Рецепт уже в закладках' });
    }
    res.status(500).json({ error: 'Ошибка добавления в закладки' });
  }
});

// Удаление из закладок
app.delete('/api/bookmarks/:recipe_id', authenticateToken, async (req, res) => {
  try {
    await db.promise().execute(
      'DELETE FROM bookmarks WHERE user_id = ? AND recipe_id = ?',
      [req.user.userId, req.params.recipe_id]
    );

    res.json({ message: 'Рецепт удален из закладок' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления из закладок' });
  }
});

// Получение закладок пользователя
app.get('/api/bookmarks', authenticateToken, async (req, res) => {
  try {
    const [bookmarks] = await db.promise().execute(`
      SELECT r.*, u.name as author_name 
      FROM recipes r 
      JOIN bookmarks b ON r.id = b.recipe_id 
      LEFT JOIN users u ON r.user_id = u.id 
      WHERE b.user_id = ?
    `, [req.user.userId]);

    const parsedRecipes = bookmarks.map(recipe => ({
      ...recipe,
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions)
    }));

    res.json(parsedRecipes);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения закладок' });
  }
});
// После других API endpoints добавь:

// Получение рецептов текущего пользователя
app.get('/api/my-recipes', authenticateToken, async (req, res) => {
  try {
    console.log('Получение рецептов для пользователя ID:', req.user.userId);
    
    const [recipes] = await db.promise().execute(`
      SELECT r.*, u.name as author_name 
      FROM recipes r 
      LEFT JOIN users u ON r.user_id = u.id 
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.userId]);
    
    // Преобразуем текстовые поля в массивы
    const parsedRecipes = recipes.map(recipe => ({
      ...recipe,
      ingredients: recipe.ingredients ? recipe.ingredients.split(', ') : [],
      instructions: recipe.instructions ? recipe.instructions.split('\n') : []
    }));
    
    console.log(`Найдено ${parsedRecipes.length} рецептов`);
    res.json(parsedRecipes);
    
  } catch (error) {
    console.error('Ошибка получения моих рецептов:', error);
    res.status(500).json({ error: 'Ошибка получения рецептов' });
  }
});

// Обновление профиля пользователя
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.user.userId;
    
    console.log('Обновление профиля для пользователя:', userId);
    
    let updateQuery = 'UPDATE users SET name = ?, email = ?';
    let queryParams = [name, email];
    
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = ?';
      queryParams.push(hashedPassword);
    }
    
    updateQuery += ' WHERE id = ?';
    queryParams.push(userId);
    
    await db.promise().execute(updateQuery, queryParams);
    
    // Получаем обновленные данные
    const [users] = await db.promise().execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId]
    );
    
    const updatedUser = users[0];
    
    // Генерируем новый токен
    const token = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Профиль обновлен',
      token,
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email уже используется' });
    }
    
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});
// заканчиваются API
// Главная страница
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Удаление рецепта
app.delete('/api/recipes/:id', authenticateToken, async (req, res) => {
  try {
    const recipeId = req.params.id;
    
    // Проверяем, существует ли рецепт и принадлежит ли пользователю
    const [recipes] = await db.promise().execute(
      'SELECT * FROM recipes WHERE id = ? AND user_id = ?',
      [recipeId, req.user.userId]
    );

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Рецепт не найден или у вас нет прав для его удаления' });
    }

    // Удаляем связанные закладки сначала
    await db.promise().execute(
      'DELETE FROM bookmarks WHERE recipe_id = ?',
      [recipeId]
    );

    // Удаляем сам рецепт
    await db.promise().execute(
      'DELETE FROM recipes WHERE id = ?',
      [recipeId]
    );

    res.json({ message: 'Рецепт успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления рецепта:', error);
    res.status(500).json({ error: 'Ошибка удаления рецепта' });
  }
});


// Обновление рецепта
app.put('/api/recipes/:id', authenticateToken, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const { title, description, ingredients, instructions, cooking_time, difficulty, servings, image_url } = req.body;
    
    // Проверяем, существует ли рецепт и принадлежит ли пользователю
    const [recipes] = await db.promise().execute(
      'SELECT * FROM recipes WHERE id = ? AND user_id = ?',
      [recipeId, req.user.userId]
    );

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Рецепт не найден или у вас нет прав для его редактирования' });
    }

    // Обновляем рецепт
    await db.promise().execute(
      `UPDATE recipes SET 
        title = ?, description = ?, ingredients = ?, instructions = ?, 
        cooking_time = ?, difficulty = ?, servings = ?, image_url = ?
       WHERE id = ?`,
      [title, description, JSON.stringify(ingredients), JSON.stringify(instructions), 
       cooking_time, difficulty, servings, image_url, recipeId]
    );

    res.json({ message: 'Рецепт успешно обновлен' });
  } catch (error) {
    console.error('Ошибка обновления рецепта:', error);
    res.status(500).json({ error: 'Ошибка обновления рецепта' });
  }
});


// Запуск сервера
db.connect(async (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к MySQL:', err);
    return;
  }
  
  console.log('✅ Подключение к MySQL успешно');
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  });
});


// Получение рецептов пользователя (уже есть, убедитесь что путь правильный)
app.get('/api/my-recipes', authenticateToken, async (req, res) => {
  try {
    const [recipes] = await db.promise().execute(`
      SELECT r.*, u.name as author_name 
      FROM recipes r 
      LEFT JOIN users u ON r.user_id = u.id 
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.userId]);
    
    const parsedRecipes = recipes.map(recipe => ({
      ...recipe,
      ingredients: recipe.ingredients.split(', '),
      instructions: recipe.instructions.split('\n')
    }));
    
    res.json(parsedRecipes);
  } catch (error) {
    console.error('Ошибка получения моих рецептов:', error);
    res.status(500).json({ error: 'Ошибка получения рецептов' });
  }
});

// Обновление профиля - ДОБАВЬТЕ ЭТОТ ENDPOINT
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.user.userId;
    
    console.log('Обновление профиля для пользователя:', userId, { name, email });
    
    // Проверяем, не занят ли email другим пользователем
    if (email) {
      const [existingUsers] = await db.promise().execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ error: 'Email уже используется другим пользователем' });
      }
    }
    
    let updateQuery = 'UPDATE users SET name = ?, email = ?';
    let queryParams = [name, email];
    
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = ?';
      queryParams.push(hashedPassword);
    }
    
    updateQuery += ' WHERE id = ?';
    queryParams.push(userId);
    
    await db.promise().execute(updateQuery, queryParams);
    
    // Получаем обновленные данные пользователя
    const [users] = await db.promise().execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const updatedUser = users[0];
    
    // Генерируем новый токен с обновленными данными
    const token = jwt.sign({ 
      userId: updatedUser.id, 
      email: updatedUser.email 
    }, JWT_SECRET);
    
    res.json({
      message: 'Профиль успешно обновлен',
      token, // Отправляем новый токен
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email уже используется' });
    }
    
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Получение информации о пользователе
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.promise().execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Ошибка получения данных пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения данных пользователя' });
  }
});