// Database and State Management
class BudgetDB {
    constructor() {
        this.db = null;
        this.init();
    }

    async init() {
        // Оставляем IndexedDB для локального режима
        this.db = await this.openDatabase();
        this.loadInitialData();
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('NeuronBudget', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('transactions')) {
                    db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('budgets')) {
                    db.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('goals')) {
                    db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // ГИБРИДНЫЙ МЕТОД ПОЛУЧЕНИЯ ДАННЫХ
    async getAll(storeName) {
        if (window.currentUser && window.firebaseDB) {
            // Если юзер вошел, берем из Firebase Firestore
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            const querySnapshot = await getDocs(collection(window.firebaseDB, `users/${window.currentUser.uid}/${storeName}`));
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            // Иначе берем из локальной IndexedDB
            return new Promise((resolve) => {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
            });
        }
    }

    // ГИБРИДНЫЙ МЕТОД СОХРАНЕНИЯ
    async add(storeName, data) {
        if (window.currentUser && window.firebaseDB) {
            // Сохраняем в Firebase
            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            await addDoc(collection(window.firebaseDB, `users/${window.currentUser.uid}/${storeName}`), data);
        } else {
            // Сохраняем локально
            return new Promise((resolve) => {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                store.add(data);
                transaction.oncomplete = () => resolve();
            });
        }
    }

    async loadInitialData() {
        await updateUI();
    }
}

const budgetDB = new BudgetDB();

// UI Functions
async function updateUI() {
    const transactions = await budgetDB.getAll('transactions');
    renderTransactions(transactions);
    updateStats(transactions);
    renderCharts(transactions);
    
    const budgets = await budgetDB.getAll('budgets');
    renderBudgets(budgets, transactions);
    
    const goals = await budgetDB.getAll('goals');
    renderGoals(goals);
}

// Transaction Logic
async function addTransaction() {
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;
    const type = document.querySelector('.toggle-btn.active').dataset.type;

    if (!amount || !category || !date) {
        alert('Пожалуйста, заполните основные поля');
        return;
    }

    const transaction = {
        amount,
        category,
        description,
        date,
        type,
        timestamp: new Date().getTime()
    };

    await budgetDB.add('transactions', transaction);
    showNotification('Запись добавлена');
    resetForm();
    updateUI();
}

function renderTransactions(transactions) {
    const container = document.getElementById('transactionsContainer');
    container.innerHTML = '';

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(t => {
            const card = document.createElement('div');
            card.className = 'transaction-card';
            card.innerHTML = `
                <div class="transaction-info">
                    <strong>${t.category}</strong>
                    <span>${t.description || ''}</span>
                    <small>${formatDate(t.date)}</small>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                </div>
            `;
            container.appendChild(card);
        });
}

function updateStats(transactions) {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;

    document.getElementById('currentBalance').textContent = formatCurrency(balance);
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpense').textContent = formatCurrency(expense);
}

// Utility
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ru-RU');
}

function resetForm() {
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
}

// Global UI management
window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
};

// Listen for auth changes to refresh data
window.addEventListener('authChanged', () => {
    updateUI();
});

// Notifications
function showNotification(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed; bottom:20px; right:20px; background:var(--secondary-color); color:#fff; padding:10px 20px; border-radius:8px; z-index:9999;`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        if (this.id === 'authBtn') return;
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(this.getAttribute('href').substring(1)).classList.add('active');
    });
});

// Дополнительные функции для категорий и графиков (Charts.js) и прочее...
