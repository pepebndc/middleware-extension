// Background Script for Uniswap Fee Injector Extension
// Handles communication between popup and content scripts

class BackgroundService {
    constructor() {
        this.isActive = true;
        this.stats = {
            totalTransactions: 0,
            totalFeesUSD: 0,
            successRate: 100,
            lastTransactionTime: null
        };
        
        this.init();
    }
    
    init() {
        this.setupMessageHandlers();
        this.setupBadgeUpdates();
        this.setupStorageListener();
        this.loadInitialData();
    }
    
    setupMessageHandlers() {
        // Handle messages from content scripts and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
    }
    
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.type) {
                case 'feeInjected':
                    await this.handleFeeInjection(request.data);
                    sendResponse({ success: true });
                    break;
                    
                case 'getStats':
                    const stats = await this.getStats();
                    sendResponse({ success: true, data: stats });
                    break;
                    
                case 'getSettings':
                    const settings = await this.getSettings();
                    sendResponse({ success: true, data: settings });
                    break;
                    
                case 'updateSettings':
                    await this.updateSettings(request.data);
                    sendResponse({ success: true });
                    break;
                    
                case 'log':
                    await this.addLog(request.level, request.message);
                    sendResponse({ success: true });
                    break;
                    
                case 'ping':
                    sendResponse({ success: true, timestamp: Date.now() });
                    break;
                    
                case 'extensionStatus':
                    sendResponse({ 
                        success: true, 
                        isActive: this.isActive,
                        stats: this.stats 
                    });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async handleFeeInjection(data) {
        // Update statistics
        this.stats.totalTransactions++;
        this.stats.totalFeesUSD += data.feeUSD || 0;
        this.stats.lastTransactionTime = new Date().toISOString();
        
        // Save to storage
        await this.saveStats();
        
        // Update badge
        this.updateBadge();
        
        // Log the event
        await this.addLog('success', `Fee injected: ${data.feeAmount}`);
        
        // Notify popup if open
        this.notifyPopup('feeInjected', data);
        
        console.log('🎯 Fee injection recorded:', data);
    }
    
    async getStats() {
        const stored = await chrome.storage.local.get(['extensionStatistics']);
        return stored.extensionStatistics || this.stats;
    }
    
    async saveStats() {
        await chrome.storage.local.set({ extensionStatistics: this.stats });
    }
    
    async getSettings() {
        const stored = await chrome.storage.local.get(['extensionSettings']);
        return stored.extensionSettings || {};
    }
    
    async updateSettings(settings) {
        await chrome.storage.local.set({ extensionSettings: settings });
        this.isActive = settings.enableExtension !== false;
        this.updateBadge();
    }
    
    async addLog(level, message) {
        const logs = await this.getLogs();
        const newLog = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            level: level,
            message: message
        };
        
        logs.unshift(newLog);
        
        // Keep only last 500 logs
        if (logs.length > 500) {
            logs.splice(500);
        }
        
        await chrome.storage.local.set({ extensionLogs: logs });
        
        // Notify popup if open
        this.notifyPopup('newLog', newLog);
    }
    
    async getLogs() {
        const stored = await chrome.storage.local.get(['extensionLogs']);
        return stored.extensionLogs || [];
    }
    
    setupBadgeUpdates() {
        this.updateBadge();
        
        // Update badge every 30 seconds
        setInterval(() => {
            this.updateBadge();
        }, 30000);
    }
    
    updateBadge() {
        try {
            if (!this.isActive) {
                chrome.action.setBadgeText({ text: 'OFF' });
                chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
                chrome.action.setTitle({ title: 'Uniswap Fee Injector (Disabled)' });
            } else if (this.stats.totalTransactions > 0) {
                chrome.action.setBadgeText({ text: this.stats.totalTransactions.toString() });
                chrome.action.setBadgeBackgroundColor({ color: '#45F67B' });
                chrome.action.setTitle({ title: `Uniswap Fee Injector (${this.stats.totalTransactions} transactions)` });
            } else {
                chrome.action.setBadgeText({ text: '' });
                chrome.action.setTitle({ title: 'Uniswap Fee Injector (Active)' });
            }
        } catch (error) {
            console.error('Error updating badge:', error);
        }
    }
    
    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                if (changes.extensionSettings) {
                    const settings = changes.extensionSettings.newValue;
                    this.isActive = settings.enableExtension !== false;
                    this.updateBadge();
                }
                
                if (changes.extensionStatistics) {
                    this.stats = changes.extensionStatistics.newValue;
                    this.updateBadge();
                }
            }
        });
    }
    
    async loadInitialData() {
        try {
            const stats = await this.getStats();
            this.stats = { ...this.stats, ...stats };
            
            const settings = await this.getSettings();
            this.isActive = settings.enableExtension !== false;
            
            this.updateBadge();
            
            console.log('🔥 Background service initialized', {
                isActive: this.isActive,
                stats: this.stats
            });
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }
    
    notifyPopup(type, data) {
        // Try to send message to popup (will fail silently if popup is not open)
        // Note: This sends to the popup, not back to the background script
        try {
            chrome.runtime.sendMessage({ type: `popup_${type}`, data });
        } catch (error) {
            // Popup not open or other error, ignore
        }
    }
    
    // Handle extension lifecycle
    async handleInstall() {
        console.log('🎉 Extension installed');
        
        // Set default settings
        const defaultSettings = {
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
        
        await chrome.storage.local.set({ extensionSettings: defaultSettings });
        
        // Add welcome log
        await this.addLog('info', '🎉 Uniswap Fee Injector installed and ready');
    }
    
    async handleUpdate() {
        console.log('🔄 Extension updated');
        await this.addLog('info', '🔄 Extension updated to latest version');
    }
    
    async handleStartup() {
        console.log('🚀 Extension started');
        await this.addLog('info', '🚀 Extension started');
    }
}

// Initialize background service with error handling
let backgroundService;

try {
    // Check if Chrome APIs are available
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.storage) {
        backgroundService = new BackgroundService();
        console.log('🚀 Background service initialized successfully');
    } else {
        console.error('Chrome APIs not available');
    }
} catch (error) {
    console.error('Failed to initialize background service:', error);
}

// Handle extension lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        // Create context menu
        chrome.contextMenus.create({
            id: 'uniswap-fee-injector',
            title: 'Uniswap Fee Injector',
            contexts: ['page'],
            documentUrlPatterns: ['https://app.uniswap.org/*']
        });
        
        // Handle lifecycle events
        if (backgroundService) {
            if (details.reason === 'install') {
                await backgroundService.handleInstall();
            } else if (details.reason === 'update') {
                await backgroundService.handleUpdate();
            }
        }
    } catch (error) {
        console.error('Extension installation error:', error);
    }
});

chrome.runtime.onStartup.addListener(async () => {
    try {
        if (backgroundService) {
            await backgroundService.handleStartup();
        }
    } catch (error) {
        console.error('Extension startup error:', error);
    }
});

// Handle tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('uniswap.org')) {
        // Ensure content script is injected
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['utils.js', 'decode.js', 'injector.js']
        }).catch(error => {
            console.log('Content script already injected or failed:', error.message);
        });
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'uniswap-fee-injector') {
        // Context menu clicked - extension popup will open automatically when icon is clicked
        console.log('Context menu clicked for Uniswap Fee Injector');
    }
});

// Export for debugging (only in Node.js environment)
if (typeof module !== 'undefined' && module.exports && typeof chrome === 'undefined') {
    module.exports = BackgroundService;
} 