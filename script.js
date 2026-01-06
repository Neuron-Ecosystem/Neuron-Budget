class BudgetDB {
    constructor() {
        this.idb = null;
        this.categories = {
            income: ['Зарплата', 'Фриланс', 'Подарки', 'Инвестиции', 'Другое'],
            expense: ['Продукты', 'Транспорт', 'Жилье', 'Развлечения', 'Здоровье', 'Шопинг', 'Другое']
        };
        this.currentType = 'income';
        window.budgetApp = this;
        this.init();
    }

    async init() {
        this.idb = await this.openDatabase();
        this.setupEventListeners();
        this.updateCategorySelects();
        await this.loadInitialData();
    }

    openDatabase() {
        return new Promise((resolve) => {
            const request = indexedDB.open('NeuronBudget', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['transactions', 'budgets', 'goals'].forEach(s => {
                    if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
                });
            };
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getAll(storeName) {
        if (window.currentUser) {
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            const snap = await getDocs(collection(window.db, `users/${window.currentUser.uid}/${storeName}`));
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return new Promise(res => {
                const tx = this.idb.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => res(req.result);
            });
        }
    }

    async add(storeName, data) {
        if (window.currentUser) {
            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            await addDoc(collection(window.db, `users/${window.currentUser.uid}/${storeName}`), data);
        } else {
            const tx = this.idb.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).add(data);
        }
        await this.loadInitialData();
    }

    async loadInitialData() {
        const t = await this.getAll('transactions');
        const b = await this.getAll('budgets');
        const g = await this.getAll('goals');
        this.renderTransactions(t);
        this.updateStats(t);
        this.renderBudgets(b, t);
        this.renderGoals(g);
    }

    setupEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-link').forEach(link => {
            link.onclick = (e) => {
                if (!link.hash) return;
                e.preventDefault();
                document.querySelectorAll('.nav-link, .section').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                document.querySelector(link.hash).classList.add('active');
            };
        });

        // Переключатель Доход/Расход
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentType = btn.dataset.type;
                this.updateCategorySelects();
            };
        });

        // Сабмит форм
        document.getElementById('transactionForm').onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                amount: Number(document.getElementById('amount').value),
                category: document.getElementById('category').value,
                description: document.getElementById('description').value,
                date: document.getElementById('date').value,
                type: this.currentType
            };
            await this.add('transactions', data);
            closeModal('transactionModal');
            e.target.reset();
        };

        document.getElementById('budgetForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.add('budgets', {
                category: document.getElementById('budgetCategory').value,
                limit: Number(document.getElementById('budgetLimit').value)
            });
            closeModal('addBudgetModal');
            e.target.reset();
        };

        document.getElementById('goalForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.add('goals', {
                name: document.getElementById('goalName').value,
                target: Number(document.getElementById('goalTarget').value),
                current: Number(document.getElementById('goalCurrent').value),
                deadline: document.getElementById('goalDeadline').value
            });
            closeModal('addGoalModal');
            e.target.reset();
        };
    }

    updateCategorySelects() {
        const catSelect = document.getElementById('category');
        const budSelect = document.getElementById('budgetCategory');
        const options = this.categories[this.currentType].map(c => `<option value="${c}">${c}</option>`).join('');
        const expOptions = this.categories.expense.map(c => `<option value="${c}">${c}</option>`).join('');
        if (catSelect) catSelect.innerHTML = options;
        if (budSelect) budSelect.innerHTML = expOptions;
    }

    renderTransactions(data) {
        const container = document.getElementById('transactionsContainer');
        container.innerHTML = data.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => `
            <div class="transaction-card">
                <div class="transaction-info"><strong>${t.category}</strong><br><small>${t.date}</small></div>
                <div class="transaction-amount ${t.type}">${t.type === 'income'?'+':'-'}${t.amount} ₽</div>
            </div>
        `).join('');
    }

    updateStats(data) {
        const inc = data.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const exp = data.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        document.getElementById('currentBalance').innerText = (inc - exp) + ' ₽';
        document.getElementById('totalIncome').innerText = inc + ' ₽';
        document.getElementById('totalExpense').innerText = exp + ' ₽';
    }

    renderBudgets(budgets, transactions) {
        const container = document.getElementById('budgetsContainer');
        container.innerHTML = budgets.map(b => {
            const spent = transactions.filter(t => t.category === b.category && t.type === 'expense').reduce((s,t) => s + t.amount, 0);
            const perc = Math.min((spent / b.limit) * 100, 100);
            return `<div class="stat-card">
                <strong>${b.category}</strong><br>
                <small>${spent} / ${b.limit} ₽</small>
                <div style="background:#eee; height:8px; border-radius:4px; margin-top:5px">
                    <div style="background:var(--primary-color); width:${perc}%; height:100%; border-radius:4px"></div>
                </div>
            </div>`;
        }).join('');
    }

    renderGoals(goals) {
        const container = document.getElementById('goalsContainer');
        container.innerHTML = goals.map(g => {
            const perc = Math.min((g.current / g.target) * 100, 100);
            return `<div class="stat-card">
                <strong>${g.name}</strong><br>
                <small>${g.current} / ${g.target} ₽</small>
                <div style="background:#eee; height:8px; border-radius:4px; margin-top:5px">
                    <div style="background:var(--secondary-color); width:${perc}%; height:100%; border-radius:4px"></div>
                </div>
            </div>`;
        }).join('');
    }
}

window.openModal = (id) => document.getElementById(id).classList.add('active');
window.closeModal = (id) => document.getElementById(id).classList.remove('active');

new BudgetDB();
