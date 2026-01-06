// Добавьте это в начало или конец вашего script.js

// Универсальная функция закрытия модальных окон
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
};

// Исправленная логика переключения вкладок (чтобы кнопка Вход не ломала навигацию)
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        // Если это кнопка авторизации, не переключаем секции контента
        if (this.id === 'authBtn') return;

        e.preventDefault();
        
        // Убираем active у всех ссылок и секций
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        // Добавляем active текущей
        this.classList.add('active');
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    });
});

// Инициализация существующих функций вашего приложения
// (Ваш оригинальный код BudgetDB, графиков и т.д. должен идти ниже)
// Database and State Management
class BudgetDB {
    constructor() {
        this.db = null;
        this.init();
    }

    async init() {
        this.db = await this.openDatabase();
        await this.createStores();
        this.loadInitialData();
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('NeuronBudget', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const store = db.createObjectStore('transactions', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                }
                
                // Budgets store
                if (!db.objectStoreNames.contains('budgets')) {
                    const store = db.createObjectStore('budgets', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('category', 'category', { unique: true });
                }
                
                // Goals store
                if (!db.objectStoreNames.contains('goals')) {
                    const store = db.createObjectStore('goals', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                }
            };
        });
    }

    async createStores() {
        // Stores are created in onupgradeneeded
    }

    async addTransaction(transaction) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            transaction.date = new Date(transaction.date).toISOString();
            const request = store.add(transaction);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTransactions(filters = {}) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['transactions'], 'readonly');
            const store = tx.objectStore('transactions');
            const request = store.getAll();
            
            request.onsuccess = () => {
                let transactions = request.result;
                
                // Apply filters
                if (filters.type && filters.type !== 'all') {
                    transactions = transactions.filter(t => t.type === filters.type);
                }
                
                if (filters.category && filters.category !== 'all') {
                    transactions = transactions.filter(t => t.category === filters.category);
                }
                
                if (filters.month) {
                    const [year, month] = filters.month.split('-');
                    transactions = transactions.filter(t => {
                        const date = new Date(t.date);
                        return date.getFullYear() == year && (date.getMonth() + 1) == month;
                    });
                }
                
                // Sort by date descending
                transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                resolve(transactions);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTransaction(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async addBudget(budget) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['budgets'], 'readwrite');
            const store = tx.objectStore('budgets');
            const request = store.add(budget);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getBudgets() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['budgets'], 'readonly');
            const store = tx.objectStore('budgets');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteBudget(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['budgets'], 'readwrite');
            const store = tx.objectStore('budgets');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async addGoal(goal) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['goals'], 'readwrite');
            const store = tx.objectStore('goals');
            goal.deadline = new Date(goal.deadline).toISOString();
            const request = store.add(goal);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getGoals() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['goals'], 'readonly');
            const store = tx.objectStore('goals');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateGoal(id, updates) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['goals'], 'readwrite');
            const store = tx.objectStore('goals');
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const goal = getRequest.result;
                Object.assign(goal, updates);
                const putRequest = store.put(goal);
                
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteGoal(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['goals'], 'readwrite');
            const store = tx.objectStore('goals');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Global Variables
let db;
let currentTransactionType = 'income';
const categories = {
    income: ['Зарплата', 'Подработка', 'Инвестиции', 'Подарки', 'Прочее'],
    expense: ['Еда', 'Транспорт', 'Развлечения', 'Жилье', 'Здоровье', 'Образование', 'Одежда', 'Прочее']
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async function() {
    db = new BudgetDB();
    
    // Initialize UI components
    initNavigation();
    initTransactionTypeToggle();
    initCategorySelects();
    initForms();
    setDefaultDate();
    
    // Load initial data
    setTimeout(() => {
        loadTransactions();
        loadBudgets();
        loadGoals();
        updateQuickStats();
    }, 100);
});

// Navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Show target section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) {
                    section.classList.add('active');
                }
            });
            
            // Load section-specific data
            if (targetId === 'analytics') {
                loadAnalytics();
            }
        });
    });
}

// Transaction Type Toggle
function initTransactionTypeToggle() {
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTransactionType = btn.dataset.type;
            updateCategoryOptions();
        });
    });
}

// Category Selects
function initCategorySelects() {
    updateCategoryOptions();
}

function updateCategoryOptions() {
    const categorySelect = document.getElementById('category');
    const budgetCategorySelect = document.getElementById('budgetCategory');
    const filterCategorySelect = document.getElementById('filterCategory');
    
    const currentCategories = categories[currentTransactionType];
    
    // Update transaction category select
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    currentCategories.forEach(category => {
        categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
    });
    
    // Update budget category select (only expenses)
    budgetCategorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    categories.expense.forEach(category => {
        budgetCategorySelect.innerHTML += `<option value="${category}">${category}</option>`;
    });
    
    // Update filter category select
    updateFilterCategories();
}

function updateFilterCategories() {
    const filterCategorySelect = document.getElementById('filterCategory');
    const allCategories = [...new Set([...categories.income, ...categories.expense])];
    
    filterCategorySelect.innerHTML = '<option value="all">Все категории</option>';
    allCategories.forEach(category => {
        filterCategorySelect.innerHTML += `<option value="${category}">${category}</option>`;
    });
}

// Forms
function initForms() {
    // Budget form
    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addBudget();
    });
    
    // Goal form
    document.getElementById('goalForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addGoal();
    });
}

function setDefaultDate() {
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

// Transaction Management
async function addTransaction() {
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;
    
    if (!amount || !category || !date) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }
    
    const transaction = {
        type: currentTransactionType,
        amount: amount,
        category: category,
        description: description,
        date: date
    };
    
    try {
        await db.addTransaction(transaction);
        clearTransactionForm();
        loadTransactions();
        updateQuickStats();
        if (document.getElementById('analytics').classList.contains('active')) {
            loadAnalytics();
        }
        showNotification('Операция успешно добавлена!');
    } catch (error) {
        console.error('Error adding transaction:', error);
        alert('Ошибка при добавлении операции');
    }
}

function clearTransactionForm() {
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    setDefaultDate();
}

async function loadTransactions() {
    const filters = {
        type: document.getElementById('filterType').value,
        category: document.getElementById('filterCategory').value,
        month: document.getElementById('filterMonth').value
    };
    
    try {
        const transactions = await db.getTransactions(filters);
        displayTransactions(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsContainer');
    
    if (transactions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Нет операций для отображения</p>';
        return;
    }
    
    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item ${transaction.type}">
            <div class="transaction-info">
                <div class="transaction-description">${transaction.description || 'Без описания'}</div>
                <div class="transaction-category">${transaction.category}</div>
                <div class="transaction-date">${formatDate(transaction.date)}</div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </div>
            <div class="transaction-actions">
                <button class="btn btn-sm btn-secondary" onclick="deleteTransaction(${transaction.id})">Удалить</button>
            </div>
        </div>
    `).join('');
}

async function deleteTransaction(id) {
    if (confirm('Вы уверены, что хотите удалить эту операцию?')) {
        try {
            await db.deleteTransaction(id);
            loadTransactions();
            updateQuickStats();
            if (document.getElementById('analytics').classList.contains('active')) {
                loadAnalytics();
            }
            showNotification('Операция удалена');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Ошибка при удалении операции');
        }
    }
}

// Budget Management
async function addBudget() {
    const category = document.getElementById('budgetCategory').value;
    const limit = parseFloat(document.getElementById('budgetLimit').value);
    const period = document.getElementById('budgetPeriod').value;
    
    const budget = {
        category: category,
        limit: limit,
        period: period,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.addBudget(budget);
        closeModal('addBudgetModal');
        document.getElementById('budgetForm').reset();
        loadBudgets();
        showNotification('Бюджет успешно создан!');
    } catch (error) {
        console.error('Error adding budget:', error);
        alert('Ошибка при создании бюджета');
    }
}

async function loadBudgets() {
    try {
        const budgets = await db.getBudgets();
        const transactions = await db.getTransactions({ type: 'expense' });
        
        displayBudgets(budgets, transactions);
    } catch (error) {
        console.error('Error loading budgets:', error);
    }
}

function displayBudgets(budgets, transactions) {
    const container = document.getElementById('budgetsContainer');
    
    if (budgets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Бюджеты не настроены</p>';
        return;
    }
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    container.innerHTML = budgets.map(budget => {
        const monthlySpent = transactions
            .filter(t => t.category === budget.category && t.date.startsWith(currentMonth))
            .reduce((sum, t) => sum + t.amount, 0);
        
        const percentage = (monthlySpent / budget.limit) * 100;
        const isOverBudget = monthlySpent > budget.limit;
        
        return `
            <div class="budget-card ${isOverBudget ? 'over-budget' : ''}">
                <h4>${budget.category}</h4>
                <div class="progress-info">
                    <span>${formatCurrency(monthlySpent)} / ${formatCurrency(budget.limit)}</span>
                    <span>${percentage.toFixed(1)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; 
                         background: ${isOverBudget ? 'var(--danger-color)' : 'var(--secondary-color)'}"></div>
                </div>
                <div class="progress-info">
                    <span>${budget.period === 'monthly' ? 'Ежемесячно' : 'Еженедельно'}</span>
                    <span>${isOverBudget ? 'Превышен!' : 'В норме'}</span>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="deleteBudget(${budget.id})" style="margin-top: 10px;">
                    Удалить
                </button>
            </div>
        `;
    }).join('');
}

async function deleteBudget(id) {
    if (confirm('Вы уверены, что хотите удалить этот бюджет?')) {
        try {
            await db.deleteBudget(id);
            loadBudgets();
            showNotification('Бюджет удален');
        } catch (error) {
            console.error('Error deleting budget:', error);
            alert('Ошибка при удалении бюджета');
        }
    }
}

// Goals Management
async function addGoal() {
    const name = document.getElementById('goalName').value;
    const target = parseFloat(document.getElementById('goalTarget').value);
    const current = parseFloat(document.getElementById('goalCurrent').value);
    const deadline = document.getElementById('goalDeadline').value;
    
    const goal = {
        name: name,
        target: target,
        current: current,
        deadline: deadline,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.addGoal(goal);
        closeModal('addGoalModal');
        document.getElementById('goalForm').reset();
        loadGoals();
        showNotification('Цель успешно создана!');
    } catch (error) {
        console.error('Error adding goal:', error);
        alert('Ошибка при создании цели');
    }
}

async function loadGoals() {
    try {
        const goals = await db.getGoals();
        displayGoals(goals);
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

function displayGoals(goals) {
    const container = document.getElementById('goalsContainer');
    
    if (goals.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Цели не настроены</p>';
        return;
    }
    
    container.innerHTML = goals.map(goal => {
        const percentage = (goal.current / goal.target) * 100;
        const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="goal-card">
                <h4>${goal.name}</h4>
                <div class="progress-info">
                    <span>${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</span>
                    <span>${percentage.toFixed(1)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="progress-info">
                    <span>Дней осталось: ${Math.max(daysLeft, 0)}</span>
                    <button class="btn btn-sm btn-primary" onclick="addToGoal(${goal.id}, ${goal.target - goal.current})">
                        + Внести
                    </button>
                </div>
                <div style="display: flex; gap: 5px; margin-top: 10px;">
                    <button class="btn btn-sm btn-secondary" onclick="deleteGoal(${goal.id})">Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

async function addToGoal(goalId, remaining) {
    const amount = prompt(`Внесите сумму (осталось ${formatCurrency(remaining)}):`);
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
        try {
            const goals = await db.getGoals();
            const goal = goals.find(g => g.id === goalId);
            
            if (goal) {
                const newCurrent = goal.current + parseFloat(amount);
                await db.updateGoal(goalId, { current: newCurrent });
                loadGoals();
                showNotification('Средства внесены в цель!');
            }
        } catch (error) {
            console.error('Error updating goal:', error);
            alert('Ошибка при обновлении цели');
        }
    }
}

async function deleteGoal(id) {
    if (confirm('Вы уверены, что хотите удалить эту цель?')) {
        try {
            await db.deleteGoal(id);
            loadGoals();
            showNotification('Цель удалена');
        } catch (error) {
            console.error('Error deleting goal:', error);
            alert('Ошибка при удалении цели');
        }
    }
}

// Analytics
async function loadAnalytics() {
    try {
        const transactions = await db.getTransactions();
        displayCategoryChart(transactions);
        displayTrendChart(transactions);
        displayTopExpenses(transactions);
        displayFinancialStats(transactions);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function displayCategoryChart(transactions) {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals = {};
    
    expenseTransactions.forEach(transaction => {
        categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + transaction.amount;
    });
    
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.categoryChart) {
        window.categoryChart.destroy();
    }
    
    window.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: [
                    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#64748b'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a1a1aa'
                    }
                }
            }
        }
    });
}

function displayTrendChart(transactions) {
    const monthlyData = {};
    const currentYear = new Date().getFullYear();
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        if (date.getFullYear() === currentYear) {
            const month = date.getMonth();
            const key = `${currentYear}-${month + 1}`;
            
            if (!monthlyData[key]) {
                monthlyData[key] = { income: 0, expense: 0 };
            }
            
            monthlyData[key][transaction.type] += transaction.amount;
        }
    });
    
    const months = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(currentYear, i, 1);
        return date.toLocaleDateString('ru-RU', { month: 'short' });
    });
    
    const incomeData = months.map((_, i) => {
        const key = `${currentYear}-${i + 1}`;
        return monthlyData[key] ? monthlyData[key].income : 0;
    });
    
    const expenseData = months.map((_, i) => {
        const key = `${currentYear}-${i + 1}`;
        return monthlyData[key] ? monthlyData[key].expense : 0;
    });
    
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (window.trendChart) {
        window.trendChart.destroy();
    }
    
    window.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Доходы',
                    data: incomeData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Расходы',
                    data: expenseData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#a1a1aa'
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a1a1aa'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a1a1aa'
                    }
                }
            }
        }
    });
}

function displayTopExpenses(transactions) {
    const expenses = transactions
        .filter(t => t.type === 'expense')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
    
    const container = document.getElementById('topExpenses');
    
    if (expenses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Нет данных о расходах</p>';
        return;
    }
    
    container.innerHTML = expenses.map(expense => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
            <span>${expense.description || expense.category}</span>
            <span style="color: var(--danger-color);">-${formatCurrency(expense.amount)}</span>
        </div>
    `).join('');
}

function displayFinancialStats(transactions) {
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    
    const container = document.getElementById('financialStats');
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span>Общий баланс:</span>
            <span style="color: ${balance >= 0 ? 'var(--secondary-color)' : 'var(--danger-color)'};">
                ${formatCurrency(balance)}
            </span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span>Накопления:</span>
            <span>${savingsRate.toFixed(1)}%</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span>Средний доход/мес:</span>
            <span>${formatCurrency(calculateMonthlyAverage(transactions, 'income'))}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span>Средний расход/мес:</span>
            <span>${formatCurrency(calculateMonthlyAverage(transactions, 'expense'))}</span>
        </div>
    `;
}

function calculateMonthlyAverage(transactions, type) {
    const filtered = transactions.filter(t => t.type === type);
    if (filtered.length === 0) return 0;
    
    const firstDate = new Date(Math.min(...filtered.map(t => new Date(t.date))));
    const lastDate = new Date(Math.max(...filtered.map(t => new Date(t.date))));
    
    const monthsDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth()) + 1;
    
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    return total / Math.max(monthsDiff, 1);
}

// Quick Stats
async function updateQuickStats() {
    try {
        const transactions = await db.getTransactions();
        
        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const totalExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const balance = totalIncome - totalExpense;
        
        document.getElementById('currentBalance').textContent = formatCurrency(balance);
        document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
        document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
    } catch (error) {
        console.error('Error updating quick stats:', error);
    }
}

// Modals
function showAddBudgetModal() {
    document.getElementById('addBudgetModal').classList.add('active');
}

function showAddGoalModal() {
    document.getElementById('addGoalModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Export to CSV
async function exportToCSV() {
    try {
        const transactions = await db.getTransactions();
        
        if (transactions.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        const headers = ['Дата', 'Тип', 'Категория', 'Сумма', 'Описание'];
        const csvData = transactions.map(t => [
            formatDate(t.date),
            t.type === 'income' ? 'Доход' : 'Расход',
            t.category,
            t.amount,
            t.description || ''
        ]);
        
        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `neuron-budget-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Данные экспортированы в CSV');
    } catch (error) {
        console.error('Error exporting to CSV:', error);
        alert('Ошибка при экспорте данных');
    }
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ru-RU');
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--secondary-color);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Service Worker for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
