/**
 * 钱包管理器 - 基于Web3Modal
 * 处理多钱包连接、状态管理和UI交互
 */

class WalletManager {
    constructor() {
        this.web3ModalManager = null;
        this.currentAccount = null;
        this.currentChainId = null;
        this.isConnected = false;
        this.balance = '0';
        this.connectOptionsModal = null;
        
        this.init();
    }

    /**
     * 初始化钱包管理器
     */
    async init() {
        // 等待Web3ModalManager初始化
        if (typeof window.web3ModalManager !== 'undefined') {
            this.web3ModalManager = window.web3ModalManager;
            this.bindEvents();
            
            // 延迟更新钱包状态，确保语言设置已完成
            setTimeout(() => {
                this.updateWalletStatus();
                this.renderConnectModalOptions();
            }, 200);
            
            // 设置Web3Modal事件回调
            this.setupWeb3ModalCallbacks();
        } else {
            // 如果Web3ModalManager还未初始化，等待一下
            setTimeout(() => this.init(), 100);
        }
    }

    /**
     * 设置Web3Modal事件回调
     */
    setupWeb3ModalCallbacks() {
        if (!this.web3ModalManager) return;

        // 重写Web3Modal的事件回调
        this.web3ModalManager.onWalletConnected = () => {
            this.currentAccount = this.web3ModalManager.account;
            this.currentChainId = this.web3ModalManager.chainId;
            this.isConnected = true;
            
            // 连接后检查并切换到前端配置的目标网络（如 X Layer Testnet 195）
            try {
                const targetChainId = (window.ContractConfig && window.ContractConfig.chainId) ? window.ContractConfig.chainId : null;
                if (targetChainId && this.currentChainId !== targetChainId) {
                    console.log('检测到网络不一致，尝试切换网络:', { current: this.currentChainId, target: targetChainId });
                    this.switchNetwork(targetChainId).catch(e => console.warn('自动切换网络失败:', e));
                }
            } catch (e) {
                console.warn('网络切换检查失败:', e);
            }

            this.updateWalletStatus();
            this.loadBalance();
            this.onWalletConnected();
            
            console.log('钱包连接成功:', {
                account: this.currentAccount,
                chainId: this.currentChainId
            });
        };

        this.web3ModalManager.onWalletDisconnected = () => {
            this.currentAccount = null;
            this.currentChainId = null;
            this.isConnected = false;
            this.balance = '0';
            
            this.updateWalletStatus();
            this.onWalletDisconnected();
            
            console.log('钱包已断开连接');
        };

        this.web3ModalManager.onAccountChanged = (account) => {
            this.currentAccount = account;
            this.updateWalletStatus();
            this.loadBalance();
            
            console.log('账户已切换:', account);
        };

        this.web3ModalManager.onChainChanged = (chainId) => {
            this.currentChainId = chainId;
            this.updateWalletStatus();
            this.loadBalance();
            
            console.log('网络已切换:', chainId);
        };
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 连接钱包按钮
        const connectBtn = document.getElementById('connect-wallet-btn');
        console.log('连接钱包按钮:', connectBtn);
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                console.log('连接钱包按钮被点击');
                this.handleWalletConnection();
            });
        } else {
            console.error('未找到连接钱包按钮');
        }

        // 绑定弹窗按钮（若存在）
        this.connectOptionsModal = document.getElementById('connect-wallet-modal');
        const scanBtn = document.getElementById('scan-connect-btn');
        const injectedBtn = document.getElementById('injected-connect-btn');
        const closeModalButtons = document.querySelectorAll('.connect-modal-close');
        if (scanBtn) {
            scanBtn.addEventListener('click', async () => {
                try {
                    await this.web3ModalManager.connectViaWalletConnect();
                    this.closeConnectOptionsModal();
                } catch (e) {
                    this.showMessage('扫码连接失败: ' + e.message, 'error');
                }
            });
        }
        if (injectedBtn) {
            injectedBtn.addEventListener('click', async () => {
                try {
                    await this.web3ModalManager.connectViaInjected();
                    this.closeConnectOptionsModal();
                } catch (e) {
                    this.showMessage('浏览器钱包连接失败: ' + e.message, 'error');
                }
            });
        }
        if (closeModalButtons && closeModalButtons.length) {
            closeModalButtons.forEach(btn => btn.addEventListener('click', () => this.closeConnectOptionsModal()));
        }
    }

    /**
     * 处理钱包连接/断开
     */
    async handleWalletConnection() {
        console.log('handleWalletConnection 被调用');
        console.log('web3ModalManager:', this.web3ModalManager);
        console.log('isConnected:', this.isConnected);
        
        if (!this.web3ModalManager) {
            console.error('Web3ModalManager 未初始化');
            // 尝试直接使用window.ethereum作为备选方案
            if (typeof window.ethereum !== 'undefined') {
                console.log('尝试使用 window.ethereum 直接连接');
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    console.log('连接成功，账户:', accounts);
                    this.showMessage('钱包连接成功!', 'success');
                } catch (error) {
                    console.error('直接连接失败:', error);
                    this.showMessage('钱包连接失败: ' + error.message, 'error');
                }
            } else {
                 // 提供测试模式选项
                 const useTestMode = confirm('未检测到钱包。是否使用测试模式模拟连接？');
                 if (useTestMode) {
                     this.simulateWalletConnection();
                 } else {
                     this.showMessage('未检测到钱包，请安装 MetaMask 或其他支持的钱包', 'error');
                 }
             }
            return;
        }

        try {
            if (this.isConnected) {
                // 如果已连接，则断开连接
                console.log('断开钱包连接');
                await this.web3ModalManager.disconnectWallet();
            } else {
                // 如果未连接，则弹出两种连接方式选择
                console.log('显示连接方式弹窗');
                this.showConnectOptionsModal();
            }
        } catch (error) {
            console.error('钱包操作失败:', error);
            this.showMessage('钱包操作失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示连接方式弹窗
     */
    showConnectOptionsModal() {
        if (!this.connectOptionsModal) {
            // 若页面未包含弹窗，回退到 Web3Modal 原生弹窗
            if (this.web3ModalManager && typeof this.web3ModalManager.connectWallet === 'function') {
                this.web3ModalManager.connectWallet().catch(e => this.showMessage('连接失败: ' + e.message, 'error'));
            }
            return;
        }
        this.connectOptionsModal.style.display = 'flex';
        document.body.classList.add('connect-modal-open');
    }

    /**
     * 关闭连接方式弹窗
     */
    closeConnectOptionsModal() {
        if (this.connectOptionsModal) {
            this.connectOptionsModal.style.display = 'none';
            document.body.classList.remove('connect-modal-open');
        }
    }

    /**
     * 渲染连接弹窗中的"已安装钱包列表"和扫码区
     */
    renderConnectModalOptions() {
        const container = document.getElementById('installed-wallet-list');
        if (!container || !this.web3ModalManager) return;

        const installed = this.web3ModalManager.getInstalledWallets();
        const wallets = [
            { id: 'metamask', name: 'MetaMask' },
            { id: 'okx', name: 'OKX Wallet' },
            { id: 'tokenpocket', name: 'TokenPocket' }
        ];

        const currentLang = this.getCurrentLanguage();

        container.innerHTML = '';
        wallets.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'connect-option';
            btn.id = `installed-${w.id}-btn`;
            
            const installedText = currentLang === 'en' ? 'Installed' : '已安装';
            const notDetectedText = currentLang === 'en' ? 'Not Detected' : '未检测到';
            
            btn.textContent = installed[w.id] ? 
                `${w.name} (${installedText})` : 
                `${w.name} (${notDetectedText})`;
            btn.disabled = !installed[w.id];
            btn.dataset.wallet = w.id;
            btn.addEventListener('click', async () => {
                try {
                    await this.web3ModalManager.connectSpecificWallet(w.id);
                    this.closeConnectOptionsModal();
                } catch (e) {
                    const errorText = currentLang === 'en' ? 
                        `${w.name} connection failed: ` : 
                        `${w.name} 连接失败: `;
                    this.showMessage(errorText + e.message, 'error');
                }
            });
            container.appendChild(btn);
        });
    }

    /**
     * 加载账户余额
     */
    async loadBalance() {
        if (!this.web3ModalManager || !this.isConnected) {
            this.balance = '0';
            return;
        }

        try {
            // 优先显示 XWAWA 代币余额
            const tokenAddr = await this.web3ModalManager.getXwawaTokenAddress();
            this.balance = await this.web3ModalManager.getBalance(tokenAddr);
            this.updateWalletStatus();
        } catch (error) {
            console.error('获取余额失败:', error);
            this.balance = '0';
        }
    }

    /**
     * 获取当前语言设置
     */
    getCurrentLanguage() {
        // 检查按钮式语言切换器（抽奖页面使用）
        const enBtn = document.getElementById('en-btn');
        const zhBtn = document.getElementById('zh-btn');
        
        if (enBtn && enBtn.classList.contains('active')) {
            return 'en';
        } else if (zhBtn && zhBtn.classList.contains('active')) {
            return 'zh';
        }
        
        // 检查开关式语言切换器（其他页面可能使用）
        const languageSwitch = document.getElementById('language-switch');
        if (languageSwitch) {
            return languageSwitch.checked ? 'en' : 'zh';
        }
        
        // 如果没有找到语言切换器，回退到localStorage，默认为英语
        return localStorage.getItem('preferred-language') || 'en';
    }

    /**
     * 更新钱包状态UI
     */
    updateWalletStatus() {
        const walletStatus = document.getElementById('wallet-status');
        const statusText = document.querySelector('.status-text');
        const walletAddress = document.getElementById('wallet-address');
        const walletBalance = document.getElementById('wallet-balance');
        const connectBtn = document.getElementById('connect-wallet-btn');

        if (!walletStatus || !statusText || !connectBtn) return;

        const currentLang = this.getCurrentLanguage();

        if (this.isConnected && this.currentAccount) {
            // 已连接状态
            walletStatus.className = 'wallet-status connected';
            statusText.textContent = currentLang === 'en' ? 'Wallet Connected' : '钱包已连接';
            
            if (walletAddress) {
                walletAddress.textContent = this.formatAddress(this.currentAccount);
                walletAddress.style.display = 'inline';
            }
            
            if (walletBalance) {
                const balanceText = currentLang === 'en' ? 
                    `Balance: ${parseFloat(this.balance).toFixed(4)} XWAWA` : 
                    `余额: ${parseFloat(this.balance).toFixed(4)} XWAWA`;
                walletBalance.textContent = balanceText;
                walletBalance.style.display = 'inline';
            }
            
            const disconnectText = currentLang === 'en' ? 'Disconnect' : '断开连接';
            connectBtn.innerHTML = `
                <span class="button-text">${disconnectText}</span>
                <span class="button-icon">🔓</span>
            `;
            connectBtn.className = 'wallet-connect-button connected';
        } else {
            // 未连接状态
            walletStatus.className = 'wallet-status not-connected';
            statusText.textContent = currentLang === 'en' ? 'Wallet Not Connected' : '钱包未连接';
            
            if (walletAddress) {
                walletAddress.style.display = 'none';
            }
            
            if (walletBalance) {
                walletBalance.style.display = 'none';
            }
            
            const connectText = currentLang === 'en' ? 'Connect Wallet' : '连接钱包';
            connectBtn.innerHTML = `
                <span class="button-text">${connectText}</span>
                <span class="button-icon">🔗</span>
            `;
            connectBtn.className = 'wallet-connect-button';
        }
    }

    /**
     * 格式化地址显示
     */
    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * 模拟钱包连接（测试模式）
     */
    simulateWalletConnection() {
        console.log('启动测试模式，模拟钱包连接');
        
        // 模拟账户信息
        const mockAccount = '0x1234567890123456789012345678901234567890';
        const mockBalance = '1.5';
        
        // 更新连接状态
        this.isConnected = true;
        this.currentAccount = mockAccount;
        this.balance = mockBalance;
        
        // 更新UI
        this.updateWalletStatus();
        
        // 显示成功消息
        this.showMessage('测试模式：钱包连接成功！', 'success');
        
        console.log('测试模式连接完成:', {
            account: this.currentAccount,
            balance: this.balance
        });
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        // 添加样式
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // 根据类型设置背景色
        switch (type) {
            case 'success':
                messageEl.style.backgroundColor = '#10b981';
                break;
            case 'error':
                messageEl.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                messageEl.style.backgroundColor = '#f59e0b';
                break;
            default:
                messageEl.style.backgroundColor = '#3b82f6';
        }
        
        // 添加到页面
        document.body.appendChild(messageEl);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    messageEl.remove();
                }, 300);
            }
        }, 3000);
    }

    /**
     * 获取网络名称
     */
    getNetworkName(chainId) {
        const networks = {
            1: 'Ethereum',
            56: 'BSC',
            137: 'Polygon',
            250: 'Fantom',
            43114: 'Avalanche'
        };
        return networks[chainId] || `Chain ${chainId}`;
    }

    /**
     * 切换网络
     */
    async switchNetwork(chainId) {
        if (!this.web3ModalManager) {
            throw new Error('Web3ModalManager 未初始化');
        }

        try {
            await this.web3ModalManager.switchNetwork(chainId);
            this.showMessage(`已切换到 ${this.getNetworkName(chainId)} 网络`, 'success');
        } catch (error) {
            console.error('切换网络失败:', error);
            this.showMessage('切换网络失败: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * 钱包连接成功回调
     */
    onWalletConnected() {
        // 触发自定义事件
        const event = new CustomEvent('walletConnected', {
            detail: {
                account: this.currentAccount,
                chainId: this.currentChainId,
                balance: this.balance
            }
        });
        document.dispatchEvent(event);
        
        this.showMessage('钱包连接成功!', 'success');
    }

    /**
     * 钱包断开连接回调
     */
    onWalletDisconnected() {
        // 触发自定义事件
        const event = new CustomEvent('walletDisconnected');
        document.dispatchEvent(event);
        
        this.showMessage('钱包已断开连接', 'info');
    }

    /**
     * 获取连接状态
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            account: this.currentAccount,
            chainId: this.currentChainId,
            balance: this.balance,
            web3: this.web3ModalManager ? this.web3ModalManager.web3 : null
        };
    }

    /**
     * 获取Web3实例
     */
    getWeb3Instance() {
        return this.web3ModalManager ? this.web3ModalManager.web3 : null;
    }

    /**
     * 获取当前提供者
     */
    getProvider() {
        return this.web3ModalManager ? this.web3ModalManager.provider : null;
    }
}

// 全局钱包管理器实例
let walletManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    walletManager = new WalletManager();
    window.walletManager = walletManager; // 暴露到全局
});

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);