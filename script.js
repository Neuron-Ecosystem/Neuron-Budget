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
                    if (!db.objectStoreNames.contains(s)) {
                        db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
                    }
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

    // ИСПРАВЛЕНО: метод add без лишнего слова 'function'
    async add(storeName, data) {
        if (window.currentUser) {
            const { collection, addDoc, doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            const uid = window.currentUser.uid;

            // 1. Сохраняем в историю
            await addDoc(collection(window.db, `users/${uid}/${storeName}`), data);

            // 2. Обновляем главный баланс для ИИ
            if (storeName === 'transactions') {
                const budgetRef = doc(window.db, "budget", uid);
                const budgetSnap = await getDoc(budgetRef);
                
                let currentBalance = 0;
                if (budgetSnap.exists()) {
                    currentBalance = budgetSnap.data().balance || 0;
                }

                const newBalance = data.type === 'income' 
                    ? currentBalance + data.amount 
                    : currentBalance - data.amount;

                await setDoc(budgetRef, { balance: newBalance }, { merge: true });
            }
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
        await this.updateStats(t);
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
                const target = document.querySelector(link.hash);
                if (target) target.classList.add('active');
            };
        });

        // Тип дохода/расхода
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentType = btn.dataset.type;
                this.updateCategorySelects();
            };
        });

        // Формы
        const tForm = document.getElementById('transactionForm');
        if (tForm) {
            tForm.onsubmit = async (e) => {
                e.preventDefault();
                const data = {
                    amount: Number(document.getElementById('amount').value),
                    category: document.getElementById('category').value,
                    description: document.getElementById('description').value,
                    date: document.getElementById('date').value || new Date().toISOString().split('T')[0],
                    type: this.currentType
                };
                await this.add('transactions', data);
                window.closeModal('transactionModal');
                e.target.reset();
            };
        }

        const bForm = document.getElementById('budgetForm');
        if (bForm) {
            bForm.onsubmit = async (e) => {
                e.preventDefault();
                await this.add('budgets', {
                    category: document.getElementById('budgetCategory').value,
                    limit: Number(document.getElementById('budgetLimit').value)
                });
                window.closeModal('addBudgetModal');
                e.target.reset();
            };
        }

        const gForm = document.getElementById('goalForm');
        if (gForm) {
            gForm.onsubmit = async (e) => {
                e.preventDefault();
                await this.add('goals', {
                    name: document.getElementById('goalName').value,
                    target: Number(document.getElementById('goalTarget').value),
                    current: Number(document.getElementById('goalCurrent').value),
                    deadline: document.getElementById('goalDeadline').value
                });
                window.closeModal('addGoalModal');
                e.target.reset();
            };
        }
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
        if (!container) return;
        container.innerHTML = data.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => `
            <div class="transaction-card">
                <div class="transaction-info"><strong>${t.category}</strong><br><small>${t.date}</small></div>
                <div class="transaction-amount ${t.type}">${t.type === 'income'?'+':'-'}${t.amount} ₽</div>
            </div>
        `).join('');
    }

    async updateStats(data) {
        const uid = window.currentUser?.uid;
        let displayBalance = 0;

        if (uid) {
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            const budgetSnap = await getDoc(doc(window.db, "budget", uid));
            if (budgetSnap.exists()) {
                displayBalance = budgetSnap.data().balance || 0;
            }
        } else {
            const inc = data.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
            const exp = data.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
            displayBalance = inc - exp;
        }

        const incTotal = data.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const expTotal = data.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);

        document.getElementById('currentBalance').innerText = displayBalance + ' ₽';
        document.getElementById('totalIncome').innerText = incTotal + ' ₽';
        document.getElementById('totalExpense').innerText = expTotal + ' ₽';
    }

    renderBudgets(budgets, transactions) {
        const container = document.getElementById('budgetsContainer');
        if (!container) return;
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
        if (!container) return;
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

// ГЛОБАЛЬНЫЕ ФУНКЦИИ МОДАЛОК
window.openModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
};
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
};

// ЗАПУСК
new BudgetDB();
