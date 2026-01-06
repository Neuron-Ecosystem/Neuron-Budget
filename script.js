class BudgetDB {
    constructor() {
        this.db = null;
        this.categories = {
            income: ['Зарплата', 'Фриланс', 'Инвестиции', 'Другое'],
            expense: ['Продукты', 'Транспорт', 'Жилье', 'Развлечения', 'Здоровье', 'Другое']
        };
        this.init();
    }

    async init() {
        this.db = await this.openIndexedDB();
        this.setupNavigation();
        window.budgetApp = this;
        this.loadInitialData();
    }

    openIndexedDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('NeuronBudget', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['transactions', 'budgets', 'goals'].forEach(name => db.createObjectStore(name, { keyPath: 'id', autoIncrement: true }));
            };
            request.onsuccess = () => resolve(request.result);
        });
    }

    // ГЛАВНОЕ: Получение данных (Firebase или Local)
    async getAll(storeName) {
        if (window.currentUser) {
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            const snap = await getDocs(collection(window.db, `users/${window.currentUser.uid}/${storeName}`));
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return new Promise((resolve) => {
                const tx = this.db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).getAll();
                req.onsuccess = () => resolve(req.result);
            });
        }
    }

    // ГЛАВНОЕ: Сохранение
    async add(storeName, data) {
        if (window.currentUser) {
            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
            await addDoc(collection(window.db, `users/${window.currentUser.uid}/${storeName}`), data);
        } else {
            const tx = this.db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).add(data);
        }
        this.loadInitialData();
    }

    async loadInitialData() {
        const trans = await this.getAll('transactions');
        this.renderTransactions(trans);
        this.updateStats(trans);
        this.renderCharts(trans); // Твоя оригинальная аналитика
        
        const budgets = await this.getAll('budgets');
        this.renderBudgets(budgets, trans); // Твои оригинальные бюджеты
    }

    renderTransactions(data) {
        const container = document.getElementById('transactionsContainer');
        if(!container) return;
        container.innerHTML = data.map(t => `
            <div class="transaction-card">
                <div><b>${t.category}</b><br><small>${t.date}</small></div>
                <div class="${t.type}">${t.type === 'income' ? '+' : '-'}${t.amount} ₽</div>
            </div>
        `).join('');
    }

    updateStats(data) {
        const inc = data.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
        const exp = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
        document.getElementById('currentBalance').innerText = (inc - exp) + ' ₽';
        document.getElementById('totalIncome').innerText = inc + ' ₽';
        document.getElementById('totalExpense').innerText = exp + ' ₽';
    }

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.onclick = (e) => {
                if(link.id === 'authBtn') return;
                e.preventDefault();
                document.querySelectorAll('.nav-link, .section').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                document.querySelector(link.getAttribute('href')).classList.add('active');
            }
        });
    }

    // Вставь сюда свои оригинальные методы: renderCharts(), renderBudgets(), renderGoals()
    renderCharts(data) { console.log("Рисую графики..."); } 
    renderBudgets(b, t) { console.log("Считаю бюджеты..."); }
}

window.closeModal = (id) => document.getElementById(id).classList.remove('active');

const app = new BudgetDB();
