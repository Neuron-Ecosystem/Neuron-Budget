class BudgetDB {
    constructor() {
        this.db = null;
        this.currentType = 'income';
        this.categories = {
            income: ['Зарплата', 'Фриланс', 'Подарки', 'Инвестиции', 'Другое'],
            expense: ['Продукты', 'Транспорт', 'Жилье', 'Развлечения', 'Здоровье', 'Шопинг', 'Другое']
        };
        this.charts = {};
        this.init();
    }

    async init() {
        this.db = await this.openDatabase();
        this.setupEventListeners();
        this.loadInitialData();
        window.budgetApp = this; 
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('NeuronBudget', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['transactions', 'budgets', 'goals'].forEach(s => {
                    if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
                });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // УМНЫЙ МЕТОД СОХРАНЕНИЯ
    async addData(storeName, data) {
        if (window.currentUser) {
            // FIREBASE
            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            await addDoc(collection(window.db, `users/${window.currentUser.uid}/${storeName}`), data);
        } else {
            // LOCAL
            return new Promise(res => {
                const tx = this.db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).add(data);
                tx.oncomplete = () => res();
            });
        }
    }

    // УМНЫЙ МЕТОД ПОЛУЧЕНИЯ
    async getData(storeName) {
        if (window.currentUser) {
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            const snap = await getDocs(collection(window.db, `users/${window.currentUser.uid}/${storeName}`));
            return snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        } else {
            return new Promise(res => {
                const tx = this.db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => res(req.result);
            });
        }
    }

    async loadInitialData() {
        const trans = await this.getData('transactions');
        const budgets = await this.getData('budgets');
        const goals = await this.getData('goals');

        this.renderTransactions(trans);
        this.updateStats(trans);
        this.renderCharts(trans);
        this.renderBudgets(budgets, trans);
        this.renderGoals(goals);
        this.updateCategorySelect();
    }

    // --- Ваша оригинальная логика отрисовки (не менялась) ---
    renderTransactions(data) {
        const container = document.getElementById('transactionsContainer');
        container.innerHTML = '';
        data.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
            const el = document.createElement('div');
            el.className = 'transaction-card';
            el.innerHTML = `
                <div class="transaction-info">
                    <strong>${t.category}</strong>
                    <span>${t.description}</span>
                    <small>${t.date}</small>
                </div>
                <div class="transaction-amount ${t.type}">${t.type==='income'?'+':'-'}${t.amount} ₽</div>
            `;
            container.appendChild(el);
        });
    }

    updateStats(data) {
        const inc = data.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount), 0);
        const exp = data.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount), 0);
        document.getElementById('currentBalance').innerText = `${inc - exp} ₽`;
        document.getElementById('totalIncome').innerText = `${inc} ₽`;
        document.getElementById('totalExpense').innerText = `${exp} ₽`;
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.onclick = (e) => {
                if(e.target.id === 'authBtn') return;
                e.preventDefault();
                document.querySelectorAll('.nav-link, .section').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                document.querySelector(link.getAttribute('href')).classList.add('active');
            };
        });
    }

    // Вспомогательные методы
    updateCategorySelect() {
        const sel = document.getElementById('category');
        if(!sel) return;
        sel.innerHTML = this.categories[this.currentType].map(c => `<option value="${c}">${c}</option>`).join('');
    }

    renderCharts(data) { /* Ваш оригинальный код Chart.js */ }
    renderBudgets(b, t) { /* Ваш оригинальный код Бюджетов */ }
    renderGoals(g) { /* Ваш оригинальный код Целей */ }
}

// Глобальные функции для кнопок
window.showAddTransactionModal = () => {
    document.getElementById('transactionModal').classList.add('active');
    window.budgetApp.updateCategorySelect();
};

window.setTransactionType = (type, btn) => {
    window.budgetApp.currentType = type;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window.budgetApp.updateCategorySelect();
};

window.saveTransaction = async () => {
    const data = {
        amount: document.getElementById('amount').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        date: document.getElementById('date').value,
        type: window.budgetApp.currentType
    };
    await window.budgetApp.addData('transactions', data);
    closeModal('transactionModal');
    window.budgetApp.loadInitialData();
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');
window.openModal = (id) => document.getElementById(id).classList.add('active');

const app = new BudgetDB();
