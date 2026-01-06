class BudgetDB {
    constructor() {
        this.idb = null;
        window.budgetApp = this; // Для доступа из index.html
        this.init();
    }

    async init() {
        this.idb = await this.openIndexedDB();
        this.setupEventListeners();
        this.loadInitialData();
    }

    openIndexedDB() {
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
        this.loadInitialData();
    }

    async loadInitialData() {
        const trans = await this.getAll('transactions');
        this.renderTransactions(trans);
        this.updateStats(trans);
        // Здесь можно вызвать renderCharts, renderBudgets и т.д.
    }

    renderTransactions(data) {
        const container = document.getElementById('transactionsContainer');
        if (!container) return;
        container.innerHTML = data.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => `
            <div class="transaction-card">
                <div class="transaction-info"><strong>${t.category}</strong><br><small>${t.date}</small></div>
                <div class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${t.amount} ₽</div>
            </div>
        `).join('');
    }

    updateStats(data) {
        const inc = data.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const exp = data.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        document.getElementById('currentBalance').innerText = `${inc - exp} ₽`;
        document.getElementById('totalIncome').innerText = `${inc} ₽`;
        document.getElementById('totalExpense').innerText = `${exp} ₽`;
    }

    setupEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-link').forEach(link => {
            link.onclick = (e) => {
                if (link.id === 'authBtn') return;
                e.preventDefault();
                document.querySelectorAll('.nav-link, .section').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                document.querySelector(link.getAttribute('href')).classList.add('active');
            };
        });

        // Форма транзакции
        const transForm = document.getElementById('transactionForm');
        if (transForm) {
            transForm.onsubmit = async (e) => {
                e.preventDefault();
                const data = {
                    type: document.getElementById('type').value,
                    amount: document.getElementById('amount').value,
                    category: document.getElementById('category').value,
                    description: document.getElementById('description').value,
                    date: document.getElementById('date').value
                };
                await this.add('transactions', data);
                window.closeModal('transactionModal');
                transForm.reset();
            };
        }
    }
}

// Глобальные функции
window.openModal = (id) => {
    const m = document.getElementById(id);
    if(m) m.classList.add('active');
    else console.error('Модалка не найдена: ' + id);
};
window.closeModal = (id) => {
    const m = document.getElementById(id);
    if(m) m.classList.remove('active');
};

const budgetApp = new BudgetDB();
