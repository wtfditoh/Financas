// ============ ESTADO GLOBAL ============
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let goals = JSON.parse(localStorage.getItem('goals')) || [];
let challenge = JSON.parse(localStorage.getItem('challenge')) || {
    target: 2000,
    deposits: [
        { amount: 10, count: 20 },
        { amount: 20, count: 20 },
        { amount: 30, count: 20 },
        { amount: 40, count: 20 }
    ],
    completedDeposits: 0,
    totalSaved: 0,
    history: []
};
let currentFilter = {
    type: 'todas',
    category: 'todas',
    period: 'all',
    sortBy: 'date-desc'
};
let editingTransactionId = null;
let deleteTransactionId = null;
let currentView = 'dashboard';
let darkMode = localStorage.getItem('darkMode') === 'true';

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', () => {
    applyDarkMode();
    updateAllViews();
    setupEventListeners();
    populateCategoryFilter();
    updateChallengeDisplay();
});

function setupEventListeners() {
    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            switchView(e.target.dataset.view);
        });
    });

    // Dark mode
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    // Exportar
    document.getElementById('exportBtn').addEventListener('click', exportData);

    // Modal transação
    document.getElementById('openModalBtn').addEventListener('click', () => openTransactionModal());
    document.querySelector('.close-modal').addEventListener('click', closeTransactionModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeTransactionModal);
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);

    // Filtros
    document.getElementById('filterType').addEventListener('change', (e) => {
        currentFilter.type = e.target.value;
        renderTransactions();
    });
    document.getElementById('filterCategory').addEventListener('change', (e) => {
        currentFilter.category = e.target.value;
        renderTransactions();
    });
    document.getElementById('filterPeriod').addEventListener('change', (e) => {
        currentFilter.period = e.target.value;
        renderTransactions();
    });
    document.getElementById('sortBy').addEventListener('change', (e) => {
        currentFilter.sortBy = e.target.value;
        renderTransactions();
    });

    // Metas
    document.getElementById('addGoalBtn').addEventListener('click', () => {
        const title = prompt('Nome da meta:');
        const target = parseFloat(prompt('Valor alvo (R$):'));
        if (title && target) {
            addGoal(title, target);
        }
    });

    // Desafio
    document.getElementById('addChallengeDepositBtn').addEventListener('click', addChallengeDeposit);

    // Modal de confirmação
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDeleteTransaction);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeConfirmModal);
}

// ============ NAVEGAÇÃO ============
function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    // Atualizar conteúdo da view se necessário
    if (viewName === 'dashboard') updateDashboard();
    if (viewName === 'transactions') renderTransactions();
    if (viewName === 'reports') updateReports();
    if (viewName === 'goals') renderGoals();
    if (viewName === 'challenge') updateChallengeDisplay();
}

// ============ DARK MODE ============
function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    applyDarkMode();
}

function applyDarkMode() {
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('darkModeToggle').textContent = '🌙';
    }
}

// ============ TRANSAÇÕES ============
function addTransaction(description, amount, type, category, date) {
    const transaction = {
        id: Date.now(),
        description,
        amount: parseFloat(amount),
        type,
        category,
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
    };
    transactions.push(transaction);
    saveTransactions();
    updateAllViews();
    showToast('Transação adicionada com sucesso!', 'success');
}

function updateTransaction(id, updatedData) {
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
        transactions[index] = { ...transactions[index], ...updatedData };
        saveTransactions();
        updateAllViews();
        showToast('Transação atualizada!', 'info');
    }
}

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    updateAllViews();
    showToast('Transação excluída!', 'error');
}

function getFilteredTransactions() {
    let filtered = [...transactions];

    // Filtro por tipo
    if (currentFilter.type !== 'todas') {
        filtered = filtered.filter(t => t.type === currentFilter.type);
    }

    // Filtro por categoria
    if (currentFilter.category !== 'todas') {
        filtered = filtered.filter(t => t.category === currentFilter.category);
    }

    // Filtro por período
    const now = new Date();
    if (currentFilter.period === 'month') {
        filtered = filtered.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        });
    } else if (currentFilter.period === 'last30') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        filtered = filtered.filter(t => new Date(t.date) >= thirtyDaysAgo);
    }

    // Ordenação
    switch (currentFilter.sortBy) {
        case 'date-desc':
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date-asc':
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'amount-desc':
            filtered.sort((a, b) => b.amount - a.amount);
            break;
        case 'amount-asc':
            filtered.sort((a, b) => a.amount - b.amount);
            break;
    }

    return filtered;
}

function renderTransactions() {
    const list = document.getElementById('transactionsList');
    const filtered = getFilteredTransactions();
    
    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 40px;">Nenhuma transação encontrada</p>';
        return;
    }

    list.innerHTML = filtered.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-meta">
                    <span class="transaction-category">${transaction.category}</span>
                    <span>${formatDate(transaction.date)}</span>
                </div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'entrada' ? '+' : '-'} ${formatCurrency(transaction.amount)}
            </div>
            <div class="transaction-actions">
                <button class="action-btn edit" onclick="editTransactionPrompt(${transaction.id})">✏️</button>
                <button class="action-btn delete" onclick="askDeleteTransaction(${transaction.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function openTransactionModal(transaction = null) {
    const modal = document.getElementById('transactionModal');
    const form = document.getElementById('transactionForm');
    form.reset();
    
    if (transaction) {
        editingTransactionId = transaction.id;
        document.getElementById('modalTitle').textContent = 'Editar Transação';
        document.getElementById('transactionId').value = transaction.id;
        document.getElementById('description').value = transaction.description;
        document.getElementById('amount').value = transaction.amount;
        document.getElementById('type').value = transaction.type;
        document.getElementById('category').value = transaction.category;
        document.getElementById('date').value = transaction.date;
    } else {
        editingTransactionId = null;
        document.getElementById('modalTitle').textContent = 'Nova Transação';
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
    }
    
    modal.style.display = 'block';
}

function closeTransactionModal() {
    document.getElementById('transactionModal').style.display = 'none';
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('transactionId').value;
    const description = document.getElementById('description').value;
    const amount = document.getElementById('amount').value;
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;

    if (id) {
        updateTransaction(Number(id), { description, amount: parseFloat(amount), type, category, date });
    } else {
        addTransaction(description, amount, type, category, date);
    }
    closeTransactionModal();
}

function editTransactionPrompt(id) {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) openTransactionModal(transaction);
}

function askDeleteTransaction(id) {
    deleteTransactionId = id;
    document.getElementById('confirmModal').style.display = 'block';
}

function confirmDeleteTransaction() {
    if (deleteTransactionId) {
        deleteTransaction(deleteTransactionId);
        deleteTransactionId = null;
    }
    closeConfirmModal();
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// ============ DASHBOARD ============
function updateDashboard() {
    const totalEntradas = transactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + t.amount, 0);
    const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0);
    const saldo = totalEntradas - totalDespesas;
    const taxaEconomia = totalEntradas > 0 ? ((saldo / totalEntradas) * 100).toFixed(1) : 0;

    document.getElementById('saldoTotal').textContent = formatCurrency(saldo);
    document.getElementById('totalEntradas').textContent = formatCurrency(totalEntradas);
    document.getElementById('totalDespesas').textContent = formatCurrency(totalDespesas);
    document.getElementById('taxaEconomia').textContent = `${taxaEconomia}%`;
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('pt-BR', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    // Gráfico de despesas por categoria (canvas)
    drawCategoryChart();
    
    // Transações recentes (últimas 5)
    const recent = [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    document.getElementById('recentTransactionsList').innerHTML = recent.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-description">${t.description}</div>
                <div class="transaction-meta">
                    <span>${t.category}</span>
                    <span>${formatDate(t.date)}</span>
                </div>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
        </div>
    `).join('') || '<p>Nenhuma transação recente</p>';

    // Resumo do desafio no dashboard
    updateChallengeSummary();
}

function drawCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const despesas = transactions.filter(t => t.type === 'despesa');
    const categories = {};
    despesas.forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    const labels = Object.keys(categories);
    const values = Object.values(categories);
    const total = values.reduce((a,b) => a+b, 0);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (labels.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Sem despesas registradas', canvas.width/2, canvas.height/2);
        return;
    }
    
    const barWidth = canvas.width / labels.length * 0.6;
    const gap = canvas.width / labels.length * 0.4;
    const maxVal = Math.max(...values);
    
    labels.forEach((label, i) => {
        const barHeight = (values[i] / maxVal) * (canvas.height - 40);
        const x = i * (barWidth + gap) + gap/2;
        const y = canvas.height - barHeight - 20;
        
        // Barra
        ctx.fillStyle = '#6c63ff';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Label categoria
        ctx.fillStyle = '#666';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(label.length > 10 ? label.substring(0,10)+'...' : label, x + barWidth/2, canvas.height - 5);
        
        // Valor
        ctx.fillStyle = '#333';
        ctx.font = 'bold 9px Inter';
        ctx.fillText(formatCurrency(values[i]), x + barWidth/2, y - 5);
    });
}

function updateChallengeSummary() {
    const summaryDiv = document.getElementById('challengeSummary');
    if (!summaryDiv) return;
    summaryDiv.innerHTML = `
        <p>Progresso: ${challenge.completedDeposits}/80 depósitos</p>
        <p>Total: ${formatCurrency(challenge.totalSaved)}</p>
        <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width: ${(challenge.totalSaved / challenge.target) * 100}%"></div>
        </div>
    `;
}

// ============ RELATÓRIOS ============
function updateReports() {
    const despesas = transactions.filter(t => t.type === 'despesa');
    if (despesas.length === 0) {
        document.getElementById('avgDaily').textContent = 'R$ 0,00';
        document.getElementById('maxExpense').textContent = 'Nenhuma despesa';
        document.getElementById('minExpense').textContent = 'Nenhuma despesa';
        document.getElementById('topCategories').innerHTML = '<p>Sem dados</p>';
        return;
    }

    // Média diária (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDespesas = despesas.filter(d => new Date(d.date) >= thirtyDaysAgo);
    const totalRecent = recentDespesas.reduce((sum, d) => sum + d.amount, 0);
    const avgDaily = totalRecent / 30;
    document.getElementById('avgDaily').textContent = formatCurrency(avgDaily);

    // Maior e menor despesa
    const sorted = [...despesas].sort((a, b) => b.amount - a.amount);
    document.getElementById('maxExpense').textContent = `${sorted[0].description} - ${formatCurrency(sorted[0].amount)}`;
    document.getElementById('minExpense').textContent = `${sorted[sorted.length-1].description} - ${formatCurrency(sorted[sorted.length-1].amount)}`;

    // Top 5 categorias
    const catTotals = {};
    despesas.forEach(d => {
        catTotals[d.category] = (catTotals[d.category] || 0) + d.amount;
    });
    const topCats = Object.entries(catTotals).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('topCategories').innerHTML = topCats.map(([cat, val]) => `
        <div style="display:flex; justify-content:space-between; margin:5px 0;">
            <span>${cat}</span>
            <span>${formatCurrency(val)}</span>
        </div>
    `).join('');
}

// ============ METAS ============
function addGoal(title, target) {
    goals.push({
        id: Date.now(),
        title,
        target,
        saved: 0,
        createdAt: new Date().toISOString()
    });
    saveGoals();
    renderGoals();
    showToast('Meta criada!', 'success');
}

function renderGoals() {
    const list = document.getElementById('goalsList');
    if (goals.length === 0) {
        list.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 40px;">Nenhuma meta definida. Clique em "+ Nova Meta" para começar.</p>';
        return;
    }
    list.innerHTML = goals.map(goal => {
        const percent = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0;
        return `
            <div class="goal-card">
                <div class="goal-header">
                    <span class="goal-title">${goal.title}</span>
                    <button class="action-btn delete" onclick="deleteGoal(${goal.id})">🗑️</button>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${percent}%"></div>
                </div>
                <div class="goal-stats">
                    <span>${formatCurrency(goal.saved)}</span>
                    <span>${formatCurrency(goal.target)}</span>
                </div>
                <div style="margin-top:10px;">
                    <input type="number" id="goalAmount-${goal.id}" placeholder="Valor para adicionar" style="width:100%; padding:8px; margin-bottom:5px;">
                    <button onclick="addToGoal(${goal.id})" class="btn-primary" style="width:100%;">Adicionar</button>
                </div>
            </div>
        `;
    }).join('');
}

function addToGoal(goalId) {
    const input = document.getElementById(`goalAmount-${goalId}`);
    const amount = parseFloat(input.value);
    if (amount > 0) {
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
            goal.saved += amount;
            saveGoals();
            renderGoals();
            showToast('Valor adicionado à meta!', 'success');
        }
    }
}

function deleteGoal(goalId) {
    goals = goals.filter(g => g.id !== goalId);
    saveGoals();
    renderGoals();
    showToast('Meta removida.', 'info');
}

// ============ DESAFIO ============
function addChallengeDeposit() {
    if (challenge.completedDeposits >= 80) {
        showToast('🎉 Desafio completo! Parabéns!', 'success');
        return;
    }
    const level = Math.floor(challenge.completedDeposits / 20);
    const depositInfo = challenge.deposits[level];
    if (!depositInfo) return;
    
    const amount = depositInfo.amount;
    const date = new Date().toISOString().split('T')[0];
    
    // Adiciona transação automaticamente
    addTransaction(`Depósito Desafio (Nível ${level+1})`, amount, 'entrada', 'Investimentos', date);
    
    // Atualiza desafio
    challenge.completedDeposits++;
    challenge.totalSaved += amount;
    challenge.history.push({ amount, date, level: level+1 });
    saveChallenge();
    updateChallengeDisplay();
    showToast(`Depósito de ${formatCurrency(amount)} registrado!`, 'success');
}

function updateChallengeDisplay() {
    const percent = (challenge.completedDeposits / 80) * 100;
    document.getElementById('challengePercent').textContent = `${percent.toFixed(0)}%`;
    document.getElementById('challengeProgress').textContent = `${challenge.completedDeposits}/80`;
    document.getElementById('challengeTotal').textContent = formatCurrency(challenge.totalSaved);
    document.getElementById('challengeRemaining').textContent = formatCurrency(Math.max(0, challenge.target - challenge.totalSaved));
    
    // Anel de progresso
    const ring = document.getElementById('progressRing');
    ring.style.background = `conic-gradient(var(--accent) ${percent}%, var(--bg-primary) ${percent}%)`;
    
    // Histórico
    const historyDiv = document.getElementById('challengeHistory');
    if (challenge.history.length === 0) {
        historyDiv.innerHTML = '<p>Nenhum depósito registrado ainda.</p>';
    } else {
        historyDiv.innerHTML = challenge.history.slice().reverse().slice(0, 10).map(h => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
                <span>${formatDate(h.date)} - Nível ${h.level}</span>
                <span>${formatCurrency(h.amount)}</span>
            </div>
        `).join('');
    }
}

// ============ UTILITÁRIOS ============
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function populateCategoryFilter() {
    const select = document.getElementById('filterCategory');
    const categories = [...new Set(transactions.map(t => t.category))];
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function saveGoals() {
    localStorage.setItem('goals', JSON.stringify(goals));
}

function saveChallenge() {
    localStorage.setItem('challenge', JSON.stringify(challenge));
}

function updateAllViews() {
    updateDashboard();
    renderTransactions();
    updateReports();
    renderGoals();
    updateChallengeDisplay();
    populateCategoryFilter();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function exportData() {
    const data = {
        transactions,
        goals,
        challenge,
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financas-pro-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Dados exportados com sucesso!', 'success');
}

// Inicialização final
updateAllViews();
