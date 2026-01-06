class BudgetDB {
    constructor() {
        this.db = null;
        window.budgetApp = this; // ДЕЛАЕМ ПРИЛОЖЕНИЕ ДОСТУПНЫМ ГЛОБАЛЬНО
        this.init();
    }

    async init() {
        this.db = await this.openDatabase();
        this.setupNavigation();
        this.loadInitialData();
    }

    openDatabase() {
        return new Promise((resolve) => {
            const request = indexedDB.open('NeuronBudget', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('budgets')) db.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('goals')) db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
            };
            request.onsuccess = () => resolve(request.result);
        });
    }

    // МЕТОД ПОЛУЧЕНИЯ ДАННЫХ
    async getAll(storeName) {
        if (window.currentUser) {
            // Если залогинены — берем из Firebase Firestore
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            const snapshot = await getDocs(collection(window.db, `users/${window.currentUser.uid}/${storeName}`));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            // Иначе — из локальной IndexedDB
            return new Promise((resolve) => {
                const tx = this.db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => resolve(req.result);
            });
        }
    }

    // МЕТОД СОХРАНЕНИЯ
    async add(storeName, data) {
        if (window.currentUser) {
            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            await addDoc(collection(window.db, `users/${window.currentUser.uid}/${storeName}`), data);
        } else {
            const tx = this.db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).add(data);
        }
        this.loadInitialData(); // Перерисовываем интерфейс
    }

    async loadInitialData() {
        const transactions = await this.getAll('transactions');
        const budgets = await this.getAll('budgets');
        const goals = await this.getAll('goals');

        this.renderTransactions(transactions);
        this.updateStats(transactions);
        this.renderBudgets(budgets, transactions);
        this.renderGoals(goals);
        // Вызов отрисовки графиков, если они есть
        if (typeof renderCharts === "function") renderCharts(transactions);
    }

    renderTransactions(data) {
        const container = document.getElementById('transactionsContainer');
        if (!container) return;
        container.innerHTML = data.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => `
            <div class="transaction-card">
                <div class="transaction-info">
                    <strong>${t.category}</strong>
                    <span>${t.description || ''}</span>
                    <small>${t.date}</small>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'}${t.amount} ₽
                </div>
            </div>
        `).join('');
    }

    updateStats(data) {
        const inc = data.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const exp = data.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        document.getElementById('currentBalance').innerText = (inc - exp) + ' ₽';
        document.getElementById('totalIncome').innerText = inc + ' ₽';
        document.getElementById('totalExpense').innerText = exp + ' ₽';
    }

    // Навигация
    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.id === 'authBtn') return;
                e.preventDefault();
                document.querySelectorAll('.nav-link, .section').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                document.querySelector(link.getAttribute('href')).classList.add('active');
            });
        });
    }

    // Твои оригинальные функции renderBudgets и renderGoals оставь ниже...
    renderBudgets(b, t) { /* Код отрисовки */ }
    renderGoals(g) { /* Код отрисовки */ }
}

// Глобальные хелперы
window.openModal = (id) => document.getElementById(id).classList.add('active');
window.closeModal = (id) => document.getElementById(id).classList.remove('active');

const budgetApp = new BudgetDB();
