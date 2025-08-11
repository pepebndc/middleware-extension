// Extension Settings and State Management
class ExtensionManager {
    constructor() {
        this.settings = {
            feePercentage: 1.0,
            feeRecipient: '0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed',
            enableExtension: true,
            enableLogging: true,
            enableNotifications: true,
            enableAutoUpdate: true,
            universalRouterAddress: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
            supportedTokens: [
                '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
                '0xa0b86a33e6c3c73429c7e8adeef8f1c6b21d6c43', // USDC
                '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'  // WETH
            ]
        };
        
        this.statistics = {
            totalTransactions: 0,
            totalFeesUSD: 0,
            successRate: 100,
            lastTransactionTime: null
        };
        
        this.transactions = [];
        this.logs = [];
        this.currentTab = 'dashboard';
        
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        await this.loadStatistics();
        await this.loadTransactions();
        await this.loadLogs();
        this.setupEventListeners();
        this.updateUI();
        this.startRealtimeUpdates();
    }
    
    // Settings Management
    async loadSettings() {
        try {
            const stored = await chrome.storage.local.get(['extensionSettings']);
            if (stored.extensionSettings) {
                this.settings = { ...this.settings, ...stored.extensionSettings };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    
    async saveSettings() {
        try {
            await chrome.storage.local.set({ extensionSettings: this.settings });
            this.showNotification('Settings saved successfully', 'success');
            this.updateUI();
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showNotification('Failed to save settings', 'error');
        }
    }
    
    // Statistics Management
    async loadStatistics() {
        try {
            const stored = await chrome.storage.local.get(['extensionStatistics']);
            if (stored.extensionStatistics) {
                this.statistics = { ...this.statistics, ...stored.extensionStatistics };
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }
    
    async saveStatistics() {
        try {
            await chrome.storage.local.set({ extensionStatistics: this.statistics });
        } catch (error) {
            console.error('Failed to save statistics:', error);
        }
    }
    
    // Transaction History Management
    async loadTransactions() {
        try {
            const stored = await chrome.storage.local.get(['extensionTransactions']);
            if (stored.extensionTransactions) {
                this.transactions = stored.extensionTransactions;
            }
        } catch (error) {
            console.error('Failed to load transactions:', error);
        }
    }
    
    async saveTransactions() {
        try {
            // Keep only last 100 transactions
            if (this.transactions.length > 100) {
                this.transactions = this.transactions.slice(-100);
            }
            await chrome.storage.local.set({ extensionTransactions: this.transactions });
        } catch (error) {
            console.error('Failed to save transactions:', error);
        }
    }
    
    // Log Management
    async loadLogs() {
        try {
            const stored = await chrome.storage.local.get(['extensionLogs']);
            if (stored.extensionLogs) {
                this.logs = stored.extensionLogs;
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    }
    
    async saveLogs() {
        try {
            // Keep only last 500 logs
            if (this.logs.length > 500) {
                this.logs = this.logs.slice(-500);
            }
            await chrome.storage.local.set({ extensionLogs: this.logs });
        } catch (error) {
            console.error('Failed to save logs:', error);
        }
    }
    
    // Add new transaction
    addTransaction(transaction) {
        const newTransaction = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...transaction
        };
        
        this.transactions.unshift(newTransaction);
        this.statistics.totalTransactions++;
        this.statistics.totalFeesUSD += transaction.feeUSD || 0;
        this.statistics.lastTransactionTime = new Date().toISOString();
        
        this.saveTransactions();
        this.saveStatistics();
        this.updateUI();
        
        if (this.settings.enableNotifications) {
            this.showNotification(`Fee injected: ${transaction.feeAmount}`, 'success');
        }
    }
    
    // Add new log entry
    addLog(level, message) {
        const newLog = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            level: level,
            message: message
        };
        
        this.logs.unshift(newLog);
        this.saveLogs();
        this.updateDebugConsole();
    }
    
    // Event Listeners Setup
    setupEventListeners() {
        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Settings Form
        document.getElementById('feePercentage').addEventListener('change', (e) => {
            this.settings.feePercentage = parseFloat(e.target.value);
        });
        
        document.getElementById('feeRecipient').addEventListener('change', (e) => {
            this.settings.feeRecipient = e.target.value;
        });
        
        document.getElementById('enableExtension').addEventListener('change', (e) => {
            this.settings.enableExtension = e.target.checked;
        });
        
        document.getElementById('enableLogging').addEventListener('change', (e) => {
            this.settings.enableLogging = e.target.checked;
        });
        
        document.getElementById('enableNotifications').addEventListener('change', (e) => {
            this.settings.enableNotifications = e.target.checked;
        });
        
        document.getElementById('enableAutoUpdate').addEventListener('change', (e) => {
            this.settings.enableAutoUpdate = e.target.checked;
        });
        
        document.getElementById('universalRouterAddress').addEventListener('change', (e) => {
            this.settings.universalRouterAddress = e.target.value;
        });
        
        document.getElementById('supportedTokens').addEventListener('change', (e) => {
            this.settings.supportedTokens = e.target.value.split(',').map(t => t.trim());
        });
        
        // Action Buttons
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetSettings();
        });
        
        document.getElementById('testExtension').addEventListener('click', () => {
            this.testExtension();
        });
        
        document.getElementById('clearData').addEventListener('click', () => {
            this.clearData();
        });
        
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
        
        // Debug Controls
        document.getElementById('clearLogs').addEventListener('click', () => {
            this.clearLogs();
        });
        
        document.getElementById('downloadLogs').addEventListener('click', () => {
            this.downloadLogs();
        });
        
        document.getElementById('refreshHistory').addEventListener('click', () => {
            this.refreshTransactionHistory();
        });
        
        // Diagnostic Tools
        document.getElementById('testConnection').addEventListener('click', () => {
            this.testConnection();
        });
        
        document.getElementById('validateSettings').addEventListener('click', () => {
            this.validateSettings();
        });
        
        document.getElementById('checkPermissions').addEventListener('click', () => {
            this.checkPermissions();
        });
        
        // Filter Controls
        document.getElementById('filterType').addEventListener('change', (e) => {
            this.filterTransactions(e.target.value);
        });
    }
    
    // UI Management
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        this.currentTab = tabName;
        
        // Update content based on tab
        if (tabName === 'history') {
            this.updateTransactionHistory();
        } else if (tabName === 'debug') {
            this.updateDebugConsole();
        }
    }
    
    updateUI() {
        this.updateStatistics();
        this.updateSettings();
        this.updateStatus();
        this.updateActivityList();
    }
    
    updateStatistics() {
        document.getElementById('totalTransactions').textContent = this.statistics.totalTransactions;
        document.getElementById('totalFees').textContent = `$${this.statistics.totalFeesUSD.toFixed(2)}`;
        document.getElementById('successRate').textContent = `${this.statistics.successRate}%`;
    }
    
    updateSettings() {
        document.getElementById('feePercentage').value = this.settings.feePercentage;
        document.getElementById('feeRecipient').value = this.settings.feeRecipient;
        document.getElementById('enableExtension').checked = this.settings.enableExtension;
        document.getElementById('enableLogging').checked = this.settings.enableLogging;
        document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
        document.getElementById('enableAutoUpdate').checked = this.settings.enableAutoUpdate;
        document.getElementById('universalRouterAddress').value = this.settings.universalRouterAddress;
        document.getElementById('supportedTokens').value = this.settings.supportedTokens.join(', ');
    }
    
    updateStatus() {
        const statusBadge = document.getElementById('statusBadge');
        const statusText = statusBadge.querySelector('.status-text');
        const statusDot = statusBadge.querySelector('.status-dot');
        
        if (this.settings.enableExtension) {
            statusText.textContent = 'Active';
            statusDot.style.background = 'var(--success)';
        } else {
            statusText.textContent = 'Disabled';
            statusDot.style.background = 'var(--error)';
        }
    }
    
    updateActivityList() {
        const activityList = document.getElementById('activityList');
        activityList.innerHTML = '';
        
        // Add recent transactions to activity
        const recentTransactions = this.transactions.slice(0, 5);
        recentTransactions.forEach(transaction => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div class="activity-icon ${transaction.status === 'success' ? 'success' : 'error'}">
                    ${transaction.status === 'success' ? '✅' : '❌'}
                </div>
                <div class="activity-content">
                    <div class="activity-title">${transaction.type || 'Fee Injection'}</div>
                    <div class="activity-time">${this.formatTime(transaction.timestamp)}</div>
                </div>
            `;
            activityList.appendChild(activityItem);
        });
        
        // Add default message if no transactions
        if (recentTransactions.length === 0) {
            const defaultItem = document.createElement('div');
            defaultItem.className = 'activity-item';
            defaultItem.innerHTML = `
                <div class="activity-icon success">✅</div>
                <div class="activity-content">
                    <div class="activity-title">Fee Injection Ready</div>
                    <div class="activity-time">Extension loaded and monitoring</div>
                </div>
            `;
            activityList.appendChild(defaultItem);
        }
    }
    
    updateTransactionHistory() {
        const transactionList = document.getElementById('transactionList');
        transactionList.innerHTML = '';
        
        this.transactions.forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item';
            transactionItem.innerHTML = `
                <div class="transaction-status ${transaction.status === 'success' ? 'success' : 'error'}">
                    ${transaction.status === 'success' ? '✅' : '❌'}
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">${transaction.type || 'Fee Injection'}</div>
                    <div class="transaction-meta">
                        <span class="transaction-amount">Fee: ${transaction.feeAmount}</span>
                        <span class="transaction-time">${this.formatTime(transaction.timestamp)}</span>
                    </div>
                </div>
                <div class="transaction-actions">
                    <button class="btn btn-small" onclick="extensionManager.viewTransaction('${transaction.id}')">View</button>
                </div>
            `;
            transactionList.appendChild(transactionItem);
        });
        
        if (this.transactions.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'transaction-item';
            emptyState.innerHTML = `
                <div class="transaction-details">
                    <div class="transaction-title">No transactions yet</div>
                    <div class="transaction-meta">
                        <span class="transaction-time">Start using Uniswap to see transaction history</span>
                    </div>
                </div>
            `;
            transactionList.appendChild(emptyState);
        }
    }
    
    updateDebugConsole() {
        const debugConsole = document.getElementById('debugConsole');
        debugConsole.innerHTML = '';
        
        this.logs.slice(0, 50).forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.innerHTML = `
                <span class="log-time">${this.formatTime(log.timestamp, true)}</span>
                <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                <span class="log-message">${log.message}</span>
            `;
            debugConsole.appendChild(logEntry);
        });
        
        if (this.logs.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'log-entry';
            emptyState.innerHTML = `
                <span class="log-time">--:--:--</span>
                <span class="log-level info">INFO</span>
                <span class="log-message">No logs available</span>
            `;
            debugConsole.appendChild(emptyState);
        }
        
        // Auto-scroll to bottom
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
    
    // Action Handlers
    async resetSettings() {
        this.settings = {
            feePercentage: 1.0,
            feeRecipient: '0x237D4cfE852DB65d6b170f4F9BDcB09acA2375Ed',
            enableExtension: true,
            enableLogging: true,
            enableNotifications: true,
            enableAutoUpdate: true,
            universalRouterAddress: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
            supportedTokens: [
                '0xdac17f958d2ee523a2206206994597c13d831ec7',
                '0xa0b86a33e6c3c73429c7e8adeef8f1c6b21d6c43',
                '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
            ]
        };
        
        await this.saveSettings();
        this.showNotification('Settings reset to default', 'success');
    }
    
    async testExtension() {
        this.showNotification('Testing extension...', 'info');
        
        try {
            // Test chrome.storage
            await chrome.storage.local.set({ testKey: 'testValue' });
            await chrome.storage.local.remove('testKey');
            
            // Test content script communication
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                await chrome.tabs.sendMessage(tabs[0].id, { type: 'test' });
            }
            
            this.addLog('success', 'Extension test completed successfully');
            this.showNotification('Extension test passed', 'success');
        } catch (error) {
            this.addLog('error', `Extension test failed: ${error.message}`);
            this.showNotification('Extension test failed', 'error');
        }
    }
    
    async clearData() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            this.transactions = [];
            this.logs = [];
            this.statistics = {
                totalTransactions: 0,
                totalFeesUSD: 0,
                successRate: 100,
                lastTransactionTime: null
            };
            
            await Promise.all([
                chrome.storage.local.remove(['extensionTransactions']),
                chrome.storage.local.remove(['extensionLogs']),
                chrome.storage.local.remove(['extensionStatistics'])
            ]);
            
            this.updateUI();
            this.showNotification('All data cleared', 'success');
        }
    }
    
    exportData() {
        const data = {
            settings: this.settings,
            statistics: this.statistics,
            transactions: this.transactions,
            logs: this.logs,
            exportTime: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uniswap-fee-injector-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Data exported successfully', 'success');
    }
    
    clearLogs() {
        this.logs = [];
        this.saveLogs();
        this.updateDebugConsole();
        this.showNotification('Logs cleared', 'success');
    }
    
    downloadLogs() {
        const logsText = this.logs.map(log => 
            `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
        ).join('\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uniswap-fee-injector-logs-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Logs downloaded', 'success');
    }
    
    refreshTransactionHistory() {
        this.loadTransactions();
        this.updateTransactionHistory();
        this.showNotification('Transaction history refreshed', 'success');
    }
    
    async testConnection() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url.includes('uniswap.org')) {
                this.showNotification('Connected to Uniswap', 'success');
                this.addLog('success', 'Connection test successful');
            } else {
                this.showNotification('Not on Uniswap page', 'warning');
                this.addLog('warning', 'Current page is not Uniswap');
            }
        } catch (error) {
            this.showNotification('Connection test failed', 'error');
            this.addLog('error', `Connection test failed: ${error.message}`);
        }
    }
    
    validateSettings() {
        const errors = [];
        
        // Validate fee percentage
        if (this.settings.feePercentage < 0 || this.settings.feePercentage > 100) {
            errors.push('Fee percentage must be between 0 and 100');
        }
        
        // Validate fee recipient address
        if (!this.settings.feeRecipient.match(/^0x[a-fA-F0-9]{40}$/)) {
            errors.push('Invalid fee recipient address');
        }
        
        // Validate Universal Router address
        if (!this.settings.universalRouterAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            errors.push('Invalid Universal Router address');
        }
        
        // Validate supported tokens
        const invalidTokens = this.settings.supportedTokens.filter(token => 
            !token.match(/^0x[a-fA-F0-9]{40}$/)
        );
        if (invalidTokens.length > 0) {
            errors.push(`Invalid token addresses: ${invalidTokens.join(', ')}`);
        }
        
        if (errors.length === 0) {
            this.showNotification('Settings validation passed', 'success');
            this.addLog('success', 'Settings validation completed');
        } else {
            this.showNotification('Settings validation failed', 'error');
            errors.forEach(error => this.addLog('error', error));
        }
    }
    
    async checkPermissions() {
        try {
            const permissions = await chrome.permissions.getAll();
            this.addLog('info', `Permissions: ${permissions.permissions.join(', ')}`);
            this.addLog('info', `Host permissions: ${permissions.origins.join(', ')}`);
            this.showNotification('Permissions checked', 'success');
        } catch (error) {
            this.showNotification('Failed to check permissions', 'error');
            this.addLog('error', `Permission check failed: ${error.message}`);
        }
    }
    
    filterTransactions(filterType) {
        const filteredTransactions = filterType === 'all' 
            ? this.transactions 
            : this.transactions.filter(t => t.status === filterType);
        
        // Update display with filtered transactions
        this.updateTransactionHistory();
    }
    
    viewTransaction(transactionId) {
        const transaction = this.transactions.find(t => t.id == transactionId);
        if (transaction) {
            this.showNotification(`Transaction: ${transaction.type || 'Fee Injection'}`, 'info');
            this.addLog('info', `Viewing transaction: ${transactionId}`);
        }
    }
    
    // Real-time Updates
    startRealtimeUpdates() {
        // Update statistics every 10 seconds
        setInterval(() => {
            this.updateStatistics();
        }, 10000);
        
        // Listen for content script messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'feeInjected') {
                this.addTransaction(message.data);
            } else if (message.type === 'log') {
                this.addLog(message.level, message.message);
            }
            
            sendResponse({ success: true });
        });
    }
    
    // Utility Functions
    formatTime(timestamp, timeOnly = false) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (timeOnly) {
            return date.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        }
        
        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)} minutes ago`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)} hours ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize Extension Manager
let extensionManager;

document.addEventListener('DOMContentLoaded', () => {
    extensionManager = new ExtensionManager();
});

// Global function for HTML onclick handlers
function viewTransaction(transactionId) {
    extensionManager.viewTransaction(transactionId);
} 