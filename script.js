const API_BASE = '/api';
let currentUser = null;
let allRecipes = [];

// ============ ОСНОВНЫЕ ФУНКЦИИ ============

// Проверка авторизации
async function checkAuth() {
    const token = sessionStorage.getItem('token');
    const userStr = sessionStorage.getItem('user');
   
    if (token && userStr) {
        try {
            // Парсим сохраненного пользователя
            currentUser = JSON.parse(userStr);
           
            // Загружаем свежие данные с сервера (ВКЛЮЧАЯ АВАТАР)
            const response = await fetch(`${API_BASE}/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
           
            if (response.ok) {
                const userData = await response.json();
                currentUser = userData; // Обновляем с серверными данными (включая avatar_url)
                sessionStorage.setItem('user', JSON.stringify(currentUser));

                // ДОБАВЬТЕ ЭТОТ ЛОГ
        console.log('Данные пользователя, загруженные с сервера:', currentUser);
        console.log('Аватар из сервера:', currentUser.avatar_url);
                console.log('User data loaded from server, avatar:', currentUser.avatar_url);
            } else {
                console.log('Failed to load user data from server, using cached');
            }
           
            updateAuthUI();
           
        } catch (error) {
            console.error('Ошибка проверки авторизации:', error);
        }
    }
}

// Обновление UI при авторизации
function updateAuthUI() {
    document.getElementById('navAuth').style.display = 'none';
    document.getElementById('navUser').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('accountLink').style.display = 'block';
}

// Функция для правильного окончания слов
function getPluralEnding(number, endings = ['', 'а', 'ов']) {
    number = Math.abs(number) % 100;
    const number1 = number % 10;
   
    if (number > 10 && number < 20) return endings[2];
    if (number1 > 1 && number1 < 5) return endings[1];
    if (number1 === 1) return endings[0];
    return endings[2];
}

// Проверка URL изображения
function isValidImageUrl(url) {
    // Простая проверка на URL изображения
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const urlLower = url.toLowerCase();
   
    // Проверяем что это HTTP/HTTPS URL
    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
        return false;
    }
   
    // Проверяем расширение файла
    return imageExtensions.some(ext => urlLower.includes(ext));
}

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
   
    document.body.appendChild(notification);
   
    // Автоматическое скрытие через 3 секунды
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Показать ошибку
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
        <p>${message}</p>
        <button onclick="location.reload()">Обновить страницу</button>
    `;
   
    document.querySelector('main').prepend(errorElement);
}

// ============ ФУНКЦИИ ДЛЯ РЕЦЕПТОВ ============

// Отображение рецептов
async function displayRecipes(recipes, containerId) {
    const container = document.getElementById(containerId);
   
    if (!container) {
        console.error('Контейнер не найден:', containerId);
        return;
    }
   
    if (recipes.length === 0) {
        container.innerHTML = '<p class="empty-state">Рецепты не найдены</p>';
        return;
    }

    // Получим закладки пользователя если он авторизован
    let userBookmarks = [];
    if (currentUser) {
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE}/bookmarks`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                userBookmarks = await response.json();
            }
        } catch (error) {
            console.error('Ошибка загрузки закладок:', error);
        }
    }

    container.innerHTML = recipes.map(recipe => {
        const isBookmarked = userBookmarks.some(bookmark => bookmark.id === recipe.id);
       
        // Проверяем, является ли текущий пользователь автором рецепта
        const isAuthor = currentUser && recipe.user_id === currentUser.id;
       
        return `
        <div class="recipe-card">
            <div class="recipe-image-container" onclick="showRecipeDetail(${recipe.id})">
                <img src="${recipe.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}?w=500&h=300&fit=crop"
                     alt="${recipe.title}" class="recipe-image"
                     onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=300&fit=crop'">
            </div>
           
            <div class="recipe-content">
                <h3 class="recipe-title" onclick="showRecipeDetail(${recipe.id})">${recipe.title}</h3>
                <p class="recipe-description">${recipe.description || 'Описание отсутствует'}</p>
               
                <div class="recipe-meta">
                    <span><i class="fas fa-clock"></i> ${recipe.cooking_time} мин</span>
                    <span><i class="fas fa-user"></i> ${recipe.difficulty}</span>
                    <span><i class="fas fa-utensils"></i> ${recipe.servings} порц.</span>
                </div>
               
                <div class="recipe-footer">
                    <div class="recipe-author">
                        <span>Автор: ${recipe.author_name}</span>
                    </div>
                   
                    <div class="recipe-controls">
                        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}"
                                onclick="toggleBookmark(${recipe.id}, this)">
                            <i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark"></i>
                        </button>
                       
                        ${isAuthor ? `
                        <button class="edit-btn" onclick="editRecipe(${recipe.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                       
                        <button class="delete-btn" onclick="deleteRecipe(${recipe.id})" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                         `: ''}
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Загрузка популярных рецептов
async function loadFeaturedRecipes() {
    try {
        console.log('Загрузка рецептов...');
        const response = await fetch(`${API_BASE}/recipes`);
       
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
       
        const recipes = await response.json();
        console.log('Загружено рецептов:', recipes.length);
       
        allRecipes = recipes;
       
        const featured = recipes.slice(0, 6);
        displayRecipes(featured, 'featuredRecipes');
    } catch (error) {
        console.error('Ошибка загрузки рецептов:', error);
        showError('Не удалось загрузить рецепты');
    }
}

// Загрузка всех рецептов
async function loadAllRecipes() {
    try {
        const response = await fetch(`${API_BASE}/recipes`);
        const recipes = await response.json();
        allRecipes = recipes;
        displayRecipes(recipes, 'allRecipes');
    } catch (error) {
        console.error('Error loading all recipes:', error);
        showError('Не удалось загрузить рецепты');
    }
}

// Загрузка моих рецептов
async function loadMyRecipes() {
    if (!currentUser) return;
   
    try {
        const token = sessionStorage.getItem('token');
       
        if (!token) {
            console.error('No token found in sessionStorage');
            return;
        }
       
        const response = await fetch(`${API_BASE}/my-recipes`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
       
        if (response.ok) {
            const myRecipes = await response.json();
            const container = document.getElementById('myRecipesGrid');
            const emptyState = document.getElementById('emptyMyRecipes');
           
            document.getElementById('myRecipesCount').textContent = `${myRecipes.length} рецепт${getPluralEnding(myRecipes.length)}`;
           
            if (myRecipes.length > 0) {
                displayRecipes(myRecipes, 'myRecipesGrid');
                emptyState.style.display = 'none';
            } else {
                container.innerHTML = '';
                emptyState.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки моих рецептов:', error);
    }
}

// Поиск рецептов
function searchRecipes() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allRecipes.filter(recipe =>
        recipe.title.toLowerCase().includes(query) ||
        recipe.description.toLowerCase().includes(query)
    );
    displayRecipes(filtered, 'allRecipes');
}

// Поиск по тегу
function searchByTag(tag) {
    document.getElementById('searchInput').value = tag;
    showPage('recipes');
    searchRecipes();
}

// Показать детали рецепта
async function showRecipeDetail(recipeId) {
    try {
        const response = await fetch(`${API_BASE}/recipes/${recipeId}`);
        const recipe = await response.json();
       
        const detailContent = `
            <div class="recipe-detail">
                <div class="recipe-detail-hero">
                    <img src="${recipe.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=400&fit=crop'}"
                         alt="${recipe.title}" class="recipe-detail-image">
                </div>
                <div class="recipe-detail-content">
                    <h1 class="recipe-detail-title">${recipe.title}</h1>
                    <div class="recipe-detail-meta">
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span>${recipe.cooking_time} минут</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-user"></i>
                            <span>${recipe.difficulty}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-utensils"></i>
                            <span>${recipe.servings} порций</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-user"></i>
                            <span>${recipe.author_name}</span>
                        </div>
                    </div>
                    <p class="recipe-detail-description">${recipe.description || 'Описание отсутствует'}</p>
                   
                    <div class="recipe-detail-grid">
                        <div class="ingredients-list">
                            <h3>Ингредиенты</h3>
                            ${recipe.ingredients.map(ingredient => `
                                <div class="ingredient-item">${ingredient}</div>
                            `).join('')}
                        </div>
                        <div class="instructions-list">
                            <h3>Способ приготовления</h3>
                            ${recipe.instructions.map((instruction, index) => `
                                <div class="instruction-item">
                                    <div class="instruction-number">${index + 1}</div>
                                    <div class="instruction-text">${instruction}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
       
        document.getElementById('recipeDetailContent').innerHTML = detailContent;
        showPage('recipe-detail');
    } catch (error) {
        console.error('Ошибка загрузки рецепта:', error);
        showError('Не удалось загрузить рецепт');
    }
}

// Функция удаления рецепта
async function deleteRecipe(recipeId) {
    event.stopPropagation();
   
    if (!currentUser) {
        showNotification('Для удаления рецепта необходимо авторизоваться', 'error');
        return;
    }
   
    if (!confirm('Вы уверены, что хотите удалить этот рецепт?')) {
        return;
    }
   
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
       
        const data = await response.json();
       
        if (response.ok) {
            showNotification('Рецепт успешно удален!', 'success');
           
            // Обновляем отображение рецептов
            const currentPage = document.querySelector('.page.active').id;
            if (currentPage === 'recipes') {
                loadAllRecipes();
            } else if (currentPage === 'bookmarks') {
                loadBookmarks();
            } else if (currentPage === 'home') {
                loadFeaturedRecipes();
            }
        } else {
            showNotification(data.error || 'Ошибка при удалении рецепта', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления рецепта:', error);
        showNotification('Ошибка при удалении рецепта', 'error');
    }
}

// Функция редактирования рецепта
async function editRecipe(recipeId) {
    event.stopPropagation();
   
    if (!currentUser) {
        showNotification('Для редактирования рецепта необходимо авторизоваться', 'error');
        return;
    }
   
    try {
        // Получаем данные рецепта
        const response = await fetch(`${API_BASE}/recipes/${recipeId}`);
        const recipe = await response.json();
       
        if (response.ok) {
            openEditModal(recipe);
        } else {
            showNotification('Рецепт не найден', 'error');
        }
    } catch (error) {
        console.error('Ошибка загрузки рецепта:', error);
        showNotification('Ошибка загрузки рецепта', 'error');
    }
}

// Функция открытия модального окна редактирования
function openEditModal(recipe) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
   
    modal.innerHTML = `
        <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <h2>Редактирование рецепта</h2>
            <form id="editForm">
                <input type="hidden" id="editRecipeId" value="${recipe.id}">
               
                <div class="form-group">
                    <label>Название рецепта</label>
                    <input type="text" id="editTitle" value="${recipe.title}" required>
                </div>
               
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="editDescription" rows="3" required>${recipe.description || ''}</textarea>
                </div>
               
                <div class="form-row">
                    <div class="form-group">
                        <label>Время приготовления (мин)</label>
                        <input type="number" id="editCookingTime" value="${recipe.cooking_time}" min="1" required>
                    </div>
                    <div class="form-group">
                        <label>Количество порций</label>
                        <input type="number" id="editServings" value="${recipe.servings}" min="1" required>
                    </div>
                    <div class="form-group">
                        <label>Сложность</label>
                        <select id="editDifficulty">
                            <option value="Легко" ${recipe.difficulty === 'Легко' ? 'selected' : ''}>Легко</option>
                            <option value="Средняя" ${recipe.difficulty === 'Средняя' ? 'selected' : ''}>Средняя</option>
                            <option value="Сложно" ${recipe.difficulty === 'Сложно' ? 'selected' : ''}>Сложно</option>
                        </select>
                    </div>
                </div>
               
                <div class="form-group">
                    <label>Ссылка на изображение</label>
                    <input type="url" id="editImage" value="${recipe.image_url || ''}" placeholder="https://example.com/image.jpg">
                </div>
               
                <div class="form-group">
                    <label>Ингредиенты (каждый с новой строки)</label>
                    <textarea id="editIngredients" rows="5" required>${Array.isArray(recipe.ingredients) ? recipe.ingredients.join('\n') : recipe.ingredients}</textarea>
                </div>
               
                <div class="form-group">
                    <label>Инструкции (каждый шаг с новой строки)</label>
<textarea id="editInstructions" rows="5" required>${Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : recipe.instructions}</textarea>
                </div>
               
                <div class="form-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                    <button type="button" class="btn btn-outline" onclick="closeEditModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить изменения</button>
                </div>
            </form>
        </div>
    `;
   
    document.body.appendChild(modal);
   
    // Обработчик формы
    document.getElementById('editForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveRecipeChanges();
    });
   
    // Закрытие по клику вне модального окна
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeEditModal();
        }
    });
}

// Функция сохранения изменений
async function saveRecipeChanges() {
    const recipeId = document.getElementById('editRecipeId').value;
    const formData = {
        title: document.getElementById('editTitle').value,
        description: document.getElementById('editDescription').value,
        ingredients: document.getElementById('editIngredients').value.split('\n').filter(i => i.trim()),
        instructions: document.getElementById('editInstructions').value.split('\n').filter(i => i.trim()),
        cooking_time: parseInt(document.getElementById('editCookingTime').value),
        difficulty: document.getElementById('editDifficulty').value,
        servings: parseInt(document.getElementById('editServings').value),
        image_url: document.getElementById('editImage').value || null
    };
   
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
       
        const data = await response.json();
       
        if (response.ok) {
            showNotification('Рецепт успешно обновлен!', 'success');
            closeEditModal();
           
            // Обновляем отображение
            const currentPage = document.querySelector('.page.active').id;
            if (currentPage === 'recipes') {
                loadAllRecipes();
            } else if (currentPage === 'bookmarks') {
                loadBookmarks();
            } else if (currentPage === 'home') {
                loadFeaturedRecipes();
            }
        } else {
            showNotification(data.error || 'Ошибка при обновлении рецепта', 'error');
        }
    } catch (error) {
        console.error('Ошибка обновления рецепта:', error);
        showNotification('Ошибка при обновлении рецепта', 'error');
    }
}

// Функция закрытия модального окна редактирования
function closeEditModal() {
    const modal = document.querySelector('.modal.active');
    if (modal) {
        modal.remove();
    }
}

// ============ ФУНКЦИИ ДЛЯ ЗАКЛАДОК ============

// Управление закладками
async function toggleBookmark(recipeId, buttonElement) {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
   
    try {
        const token = sessionStorage.getItem('token');
        const bookmarkBtn = buttonElement || event.target.closest('.bookmark-btn');
        const isCurrentlyBookmarked = bookmarkBtn.classList.contains('active');
       
        let response;
       
        if (isCurrentlyBookmarked) {
            // Удаляем из закладок
            response = await fetch(`${API_BASE}/bookmarks/${recipeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } else {
            // Добавляем в закладки
            response = await fetch(`${API_BASE}/bookmarks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ recipe_id: recipeId })
            });
        }
       
        if (response.ok) {
            const data = await response.json();
           
            // Обновляем иконку кнопки
            bookmarkBtn.classList.toggle('active');
            const icon = bookmarkBtn.querySelector('i');
            if (icon) {
                icon.className = bookmarkBtn.classList.contains('active') ?
                    'fas fa-bookmark' : 'far fa-bookmark';
            }
           
            showNotification(data.message, 'success');
           
            // Если мы на странице закладок, обновляем список
            if (document.getElementById('bookmarks').classList.contains('active')) {
                loadBookmarks();
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка управления закладками:', error);
        showNotification(error.message || 'Не удалось обновить закладки', 'error');
    }
}

// Загрузка закладок
async function loadBookmarks() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
   
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/bookmarks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
       
        if (response.ok) {
            const bookmarks = await response.json();
            const container = document.getElementById('bookmarksGrid');
            const emptyState = document.getElementById('emptyBookmarks');
           
            if (bookmarks.length > 0) {
                displayRecipes(bookmarks, 'bookmarksGrid');
                emptyState.style.display = 'none';
            } else {
                container.innerHTML = '';
                emptyState.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки закладок:', error);
        showError('Не удалось загрузить закладки');
    }
}

// Загрузка закладок для страницы аккаунта
async function loadAccountBookmarks() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/bookmarks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
       
        if (response.ok) {
            const bookmarks = await response.json();
            const container = document.getElementById('accountBookmarksGrid');
            const emptyState = document.getElementById('emptyAccountBookmarks');
           
            document.getElementById('myBookmarksCount').textContent = `${bookmarks.length} заклад${getPluralEnding(bookmarks.length, ['ка', 'ки', 'ок'])}`;
           
            if (bookmarks.length > 0) {
                displayRecipes(bookmarks, 'accountBookmarksGrid');
                emptyState.style.display = 'none';
            } else {
                container.innerHTML = '';
                emptyState.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки закладок:', error);
    }
}

// ============ ФУНКЦИИ ДЛЯ АККАУНТА ============

// Добавим функцию для показа страницы аккаунта
function showAccount() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    loadAccountData();
    showPage('account');
}

// Загрузка данных аккаунта
async function loadAccountData() {
    // ДОБАВЬТЕ ЭТОТ ЛОГ СРАЗУ
    console.log('loadAccountData вызвана. currentUser:', currentUser);
    if (!currentUser) return;
   
    try {
        // Обновляем информацию в профиле
        document.getElementById('accountUserName').textContent = currentUser.name;
        document.getElementById('accountUserEmail').textContent = currentUser.email;
       
        // Загружаем аватар из данных пользователя
        if (currentUser.avatar_url) {
            document.getElementById('userAvatar').src = currentUser.avatar_url;
        } else {
            // Генерируем дефолтный аватар
            //const defaultAvatar = https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=ff6b6b&color=fff&size=120;
            document.getElementById('userAvatar').src = defaultAvatar; 
        }
       
        // Загружаем мои рецепты
        await loadMyRecipes();
       
        // Загружаем закладки для аккаунта
        await loadAccountBookmarks();
       
        // Заполняем форму профиля
        document.getElementById('profileName').value = currentUser.name;
        document.getElementById('profileEmail').value = currentUser.email;
       
    } catch (error) {
        console.error('Ошибка загрузки данных аккаунта:', error);
    }
}

// Переключение разделов в аккаунте
function showAccountSection(sectionId) {
    // Скрываем все разделы
    document.querySelectorAll('.account-section').forEach(section => {
        section.classList.remove('active');
    });
   
    // Убираем активный класс у всех кнопок навигации
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
   
    // Показываем выбранный раздел
    document.getElementById(`${sectionId}-section`).classList.add('active');
   
    // Активируем соответствующую кнопку навигации
    event.target.classList.add('active');
}

// Загрузка аватарки
function uploadAvatar(file) {
    if (!file) return;
   
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        return;
    }
   
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showNotification('Размер файла не должен превышать 5MB', 'error');
        return;
    }
   
    const reader = new FileReader();
    reader.onload = function(e) {
        const avatarUrl = e.target.result;
        document.getElementById('userAvatar').src = avatarUrl;
       
        // Сохраняем в sessionStorage
        if (currentUser) {
            sessionStorage.setItem(`avatar_${currentUser.id}`, avatarUrl);
        }
       
        showNotification('Аватар успешно обновлен', 'success');
    };
    reader.readAsDataURL(file);
}

// Редактирование профиля
function editProfile() {
    showAccountSection('settings');
}

// Обновление профиля
async function updateProfile() {
    try {
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        const password = document.getElementById('profilePassword').value;
       
        if (!name || !email) {
            showNotification('Имя и email обязательны для заполнения', 'error');
            return;
        }
       
        const formData = { name, email };
        if (password && password.trim() !== '') {
            formData.password = password;
        }
       
        const token = sessionStorage.getItem('token');
       
        const response = await fetch(`${API_BASE}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
       
        // ВАЖНО: Проверяем что ответ JSON
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('Не удалось распарсить JSON:', jsonError);
            showNotification('Ошибка сервера', 'error');
            return;
        }
       
        if (response.ok) {
            // СОХРАНЯЕМ НОВЫЙ ТОКЕН!
            if (data.token) {
                sessionStorage.setItem('token', data.token);
                console.log('Новый токен сохранен');
            }
           
            // Обновляем данные пользователя
            currentUser = data.user;
            sessionStorage.setItem('user', JSON.stringify(currentUser));
           
            // Обновляем UI
            updateAuthUI();
            document.getElementById('accountUserName').textContent = currentUser.name;
            document.getElementById('accountUserEmail').textContent = currentUser.email;
            document.getElementById('userName').textContent = currentUser.name;
           
            // Очищаем поле пароля
            document.getElementById('profilePassword').value = '';
           
            showNotification(data.message || 'Профиль успешно обновлен', 'success');
        } else {
            // Показываем ошибку с сервера
            showNotification(data.error || 'Ошибка обновления профиля', 'error');
           
            // Если 403 - токен невалиден
            if (response.status === 403) {
                console.log('Токен невалиден, очищаем сессию');
                setTimeout(() => {
                    logout();
                    showAuthModal('login');
                }, 1500);
            }
        }
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        showNotification('Ошибка соединения', 'error');
    }
}

// Загрузка данных пользователя при инициализации
async function loadUserData() {
    if (!currentUser) return;
   
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
       
        if (response.ok) {
            const userData = await response.json();
            currentUser = { ...currentUser, ...userData };
            localStorage.setItem('user', JSON.stringify(currentUser));
        }
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
    }
}

// Функция сохранения аватара
async function saveAvatar() {
    const avatarUrl = document.getElementById('avatarUrl').value.trim();
   
    if (!avatarUrl) {
        showNotification('Введите URL изображения', 'error');
        return;
    }
   
    try {
        const token = sessionStorage.getItem('token');
       
        const response = await fetch(`${API_BASE}/avatar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ avatarUrl })
        });
       
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('Не удалось распарсить JSON:', jsonError);
            showNotification('Ошибка сервера', 'error');
            return;
        }
       
        if (response.ok) {
            // ВАЖНО: Обновляем данные пользователя ПОЛНОСТЬЮ
            currentUser = data.user; // data.user содержит обновленного пользователя с avatar_url
            sessionStorage.setItem('user', JSON.stringify(currentUser));
           
            // Обновляем аватар в UI
            document.getElementById('userAvatar').src = currentUser.avatar_url;
           
            closeAvatarModal();
            showNotification(data.message || 'Аватар успешно обновлен', 'success');
           
            console.log('Avatar saved to DB:', currentUser.avatar_url);
            console.log('Current user in sessionStorage:', JSON.parse(sessionStorage.getItem('user')));
        } else {
            showNotification(data.error || 'Ошибка обновления аватара', 'error');
        }
       
    } catch (error) {
        console.error('Ошибка сохранения аватара:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Функция сброса аватара
async function resetAvatar() {
    try {
        const token = sessionStorage.getItem('token');
       
        const response = await fetch(`${API_BASE}/avatar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ avatarUrl: null }) // или пустая строка
        });
       
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            sessionStorage.setItem('user', JSON.stringify(currentUser));
           
            /* // Устанавливаем дефолтный аватар
            const defaultAvatar = https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=ff6b6b&color=fff&size=120;
            document.getElementById('userAvatar').src = defaultAvatar; */
           
            closeAvatarModal();
            showNotification('Аватар сброшен', 'success');
        }
    } catch (error) {
        console.error('Ошибка сброса аватара:', error);
        showNotification('Ошибка сброса аватара', 'error');
    }
}

// ============ ФУНКЦИИ ДЛЯ СТРАНИЦ ============

// Управление страницами
function showPage(pageId) {
    // Сохраняем текущую страницу в sessionStorage
    sessionStorage.setItem('currentPage', pageId);
   
    // Скрыть все страницы
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
   
    // Показать выбранную страницу
    document.getElementById(pageId).classList.add('active');
   
    // Загрузить данные если нужно
    if (pageId === 'recipes') {
        loadAllRecipes();
    } else if (pageId === 'bookmarks') {
        loadBookmarks();
    } else if (pageId === 'home') {
        loadFeaturedRecipes();
    }
}

// Восстановление состояния страницы после перезагрузки
function restorePageState() {
    const savedPage = sessionStorage.getItem('currentPage') || 'home';
    showPage(savedPage);
}

// ============ МОДАЛЬНЫЕ ОКНА ============

// Модальное окно авторизации
function showAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authModalTitle');
    const registerFields = document.getElementById('registerFields');
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitchLink');
   
    if (mode === 'login') {
        title.textContent = 'Вход';
        registerFields.style.display = 'none';
        switchText.textContent = 'Нет аккаунта?';
        switchLink.textContent = 'Зарегистрироваться';
    } else {
        title.textContent = 'Регистрация';
        registerFields.style.display = 'block';
        switchText.textContent = 'Уже есть аккаунт?';
        switchLink.textContent = 'Войти';
    }
   
    document.getElementById('authForm').reset();
    modal.classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
}

function switchAuthMode() {
    const currentMode = document.getElementById('authModalTitle').textContent;
    showAuthModal(currentMode === 'Вход' ? 'register' : 'login');
}

// Показ модального окна для аватара
function showAvatarModal() {
    document.getElementById('avatarModal').classList.add('active');
    document.getElementById('avatarUrl').value = '';
    document.getElementById('avatarUrl').focus();
   
    // Сброс предпросмотра
    document.getElementById('previewImage').style.display = 'none';
    document.getElementById('previewText').style.display = 'block';
    document.getElementById('previewText').textContent = 'Предпросмотр появится здесь';
}

// Закрытие модального окна аватара
function closeAvatarModal() {
    document.getElementById('avatarModal').classList.remove('active');
}

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма авторизации
    document.getElementById('authForm').addEventListener('submit', handleAuth);
   
    // Форма добавления рецепта
    document.getElementById('addRecipeForm').addEventListener('submit', handleAddRecipe);
   
    // Поиск при нажатии Enter
    document.getElementById('searchInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchRecipes();
        }
    });
   
    // Форма профиля (если существует)
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updateProfile();
        });
    }
   
    // Форма аватара (если существует)
    const avatarForm = document.getElementById('avatarForm');
    if (avatarForm) {
        avatarForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAvatar();
        });
    }
}

// Обработка авторизации
async function handleAuth(event) {
    event.preventDefault();
   
    const isLogin = document.getElementById('authModalTitle').textContent === 'Вход';
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
   
    try {
        const url = isLogin ? `${API_BASE}/login` : `${API_BASE}/register`;
        const body = isLogin ? { email, password } : {
            name: document.getElementById('registerName').value,
            email,
            password
        };
       
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
       
        const data = await response.json();
       
        if (response.ok) {
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
           
            updateAuthUI();
            closeAuthModal();
            showNotification(data.message, 'success');
           
            // Обновляем данные если нужно
            if (document.getElementById('bookmarks').classList.contains('active')) {
                loadBookmarks();
            }
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения', 'error');
    }
}

// Добавление рецепта
async function handleAddRecipe(event) {
    event.preventDefault();
   
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
   
    const formData = {
        title: document.getElementById('recipeTitle').value,
        description: document.getElementById('recipeDescription').value,
        ingredients: document.getElementById('recipeIngredients').value.split('\n').filter(i => i.trim()),
        instructions: document.getElementById('recipeInstructions').value.split('\n').filter(i => i.trim()),
        cooking_time: parseInt(document.getElementById('recipeTime').value) || 30,
        difficulty: document.getElementById('recipeDifficulty').value,
        servings: parseInt(document.getElementById('recipeServings').value) || 2,
        image_url: document.getElementById('recipeImage').value || null
    };
   
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/recipes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
       
        const data = await response.json();
       
        if (response.ok) {
            showNotification('Рецепт успешно добавлен!', 'success');
            document.getElementById('addRecipeForm').reset();
            showPage('recipes');
            loadAllRecipes();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка добавления рецепта', 'error');
    }
}

// ============ ВЫХОД И ОЧИСТКА ============

// Выход
function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    currentUser = null;
   
    document.getElementById('navAuth').style.display = 'flex';
    document.getElementById('navUser').style.display = 'none';
    document.getElementById('accountLink').style.display = 'none';
   
    showNotification('Вы вышли из системы', 'info');
    showPage('home');
}

// ============ ИНИЦИАЛИЗАЦИЯ ============

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    checkAuth();
    loadFeaturedRecipes();
    setupEventListeners();
    restorePageState(); // Добавляем восстановление состояния страницы
   
    // Дополнительные обработчики для аватара
    const avatarUrlInput = document.getElementById('avatarUrl');
    const avatarForm = document.getElementById('avatarForm');
   
    if (avatarUrlInput) {
        avatarUrlInput.addEventListener('input', function() {
            const url = this.value.trim();
            const previewImage = document.getElementById('previewImage');
            const previewText = document.getElementById('previewText');
           
            if (url && isValidImageUrl(url)) {
                previewImage.src = url;
                previewImage.style.display = 'block';
                previewText.style.display = 'none';
               
                // Проверяем загрузку изображения
                previewImage.onload = function() {
                    previewText.textContent = 'Изображение загружено';
                };
               
                previewImage.onerror = function() {
                    previewImage.style.display = 'none';
                    previewText.style.display = 'block';
                    previewText.textContent = 'Не удалось загрузить изображение';
                    previewText.style.color = 'var(--danger)';
                };
            } else {
                previewImage.style.display = 'none';
                previewText.style.display = 'block';
                previewText.textContent = 'Введите корректный URL изображения';
                previewText.style.color = '#888';
            }
        });
    }
   
    if (avatarForm) {
        avatarForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAvatar();
        });
    }
   
    // Закрытие модальных окон по клику вне их
    document.addEventListener('click', function(e) {
        const avatarModal = document.getElementById('avatarModal');
        if (e.target === avatarModal) {
            closeAvatarModal();
        }
       
        const authModal = document.getElementById('authModal');
        if (e.target === authModal) {
            closeAuthModal();
        }
    });
});

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    const avatarModal = document.getElementById('avatarModal');
    if (event.target === avatarModal) {
        closeAvatarModal();
    }
   
    const authModal = document.getElementById('authModal');
    if (event.target === authModal) {
        closeAuthModal();
    }
};

// Сделаем функции глобальными для обработчиков в HTML
window.showPage = showPage;
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthMode = switchAuthMode;
window.logout = logout;
window.showRecipeDetail = showRecipeDetail;
window.toggleBookmark = toggleBookmark;
window.searchRecipes = searchRecipes;
window.searchByTag = searchByTag;
window.deleteRecipe = deleteRecipe;
window.editRecipe = editRecipe;
window.showAccount = showAccount;
window.showAccountSection = showAccountSection;
window.editProfile = editProfile;
window.showAvatarModal = showAvatarModal;
window.closeAvatarModal = closeAvatarModal;
window.resetAvatar = resetAvatar;
window.uploadAvatar = uploadAvatar;
