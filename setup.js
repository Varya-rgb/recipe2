const fs = require('fs');
const { exec } = require('child_process');

console.log('🚀 Начинаем установку сайта рецептов...');

// Создаем package.json
const packageJson = {
  name: "recipe-site",
  version: "1.0.0",
  description: "Красивый сайт рецептов с авторизацией",
  main: "server.js",
  scripts: {
    "start": "node server.js",
    "setup": "node setup.js"
  },
  dependencies: {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.1",
    "cors": "^2.8.5"
  }
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ package.json создан');

// Устанавливаем зависимости
console.log('📦 Устанавливаем зависимости...');
exec('npm install', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Ошибка установки:', error);
    return;
  }
  console.log('✅ Зависимости установлены');
  
  console.log('\n🎉 Установка завершена!');
  console.log('Запустите проект: npm start');
  console.log('Откройте: http://localhost:3000');
});