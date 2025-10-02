/**
 * Web3Modal 配置文件
 * 支持多种钱包连接，包括二维码扫描功能
 */

// 动态加载脚本（用于CDN兜底）
function loadScript(url) {
    return new Promise((resolve, reject) => {
        try {
            const s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = () => resolve(true);
            s.onerror = (e) => reject(e);
            document.head.appendChild(s);
        } catch (e) {
            reject(e);
        }
    });
}

// 等待浏览器注入 window.ethereum（Chrome 上可能延迟）
function waitForEthereum(timeoutMs = 3000) {
    return new Promise((resolve) => {
        if (typeof window.ethereum !== 'undefined') return resolve(true);
        const onInit = () => resolve(true);
        window.addEventListener('ethereum#initialized', onInit, { once: true });
        setTimeout(() => {
            window.removeEventListener('ethereum#initialized', onInit);
            resolve(typeof window.ethereum !== 'undefined');
        }, timeoutMs);
    });
}

// 确保加载 MetaMask 官方 provider 检测库（用于 Chrome 兜底）
async function ensureDetectProviderLoaded() {
    if (typeof window.detectEthereumProvider === 'function') return true;
    try {
        await loadScript('https://unpkg.com/@metamask/detect-provider/dist/detect-provider.min.js');
        return typeof window.detectEthereumProvider === 'function';
    } catch (e) {
        console.warn('加载 detect-provider 失败:', e);
        return false;
    }
}

// 确保加载 WalletConnect v2 EthereumProvider（优先动态导入 ESM，其次 UMD）
async function ensureWalletConnectV2Loaded() {
    if (typeof window.EthereumProvider !== 'undefined') return true;

    // 1) 优先尝试通过 ESM 动态导入，避免依赖全局变量名
    const esmCandidates = [
        'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.21.8/dist/index.js',
        'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.9.0/dist/index.js',
        'https://unpkg.com/@walletconnect/ethereum-provider@2.21.8/dist/index.js'
    ];
    for (const url of esmCandidates) {
        try {
            const mod = await import(/* @vite-ignore */ url);
            const EP = (mod && (mod.EthereumProvider || mod.default)) || null;
            if (EP) {
                window.EthereumProvider = EP;
                return true;
            }
        } catch (e) {
            console.warn('动态导入 WalletConnect v2 EthereumProvider 失败，尝试下一个源:', url, e);
        }
    }

    // 2) 回退到 UMD 构建，通过 <script> 标签加载，并尝试常见全局变量名
    const umdCandidates = [
        'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.21.8/dist/index.umd.min.js',
        'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.9.0/dist/index.umd.min.js',
        'https://unpkg.com/@walletconnect/ethereum-provider@2.21.8/dist/index.umd.min.js'
    ];
    for (const url of umdCandidates) {
        try {
            await loadScript(url);
            let EP = window.EthereumProvider;
            // 常见的 UMD 全局变量兜底（不同版本可能挂载到不同命名空间）
            if (!EP && window.WalletConnectEthereumProvider && window.WalletConnectEthereumProvider.EthereumProvider) {
                EP = window.WalletConnectEthereumProvider.EthereumProvider;
            }
            if (!EP && window.walletconnect && (window.walletconnect.EthereumProvider || window.walletconnect.ethereumProvider)) {
                EP = window.walletconnect.EthereumProvider || window.walletconnect.ethereumProvider;
            }
            if (EP) {
                window.EthereumProvider = EP;
                return true;
            }
        } catch (e) {
            console.warn('加载 WalletConnect v2 EthereumProvider (UMD) 失败，尝试下一个源:', url, e);
        }
    }
    return typeof window.EthereumProvider !== 'undefined';
}

// 通过 EIP-6963 标准发现注入的钱包提供者（多钱包兼容）
function detectProvidersViaEIP6963(timeoutMs = 2000) {
    return new Promise((resolve) => {
        const providers = [];
        const onAnnounce = (event) => {
            try {
                const providerDetail = event && event.detail && event.detail.provider;
                if (providerDetail) providers.push(providerDetail);
            } catch (_) {}
        };
        try {
            window.addEventListener('eip6963:announceProvider', onAnnounce);
            // 请求已注入页面的提供者广播自己
            window.dispatchEvent(new Event('eip6963:requestProvider'));
        } catch (e) {
            console.warn('EIP-6963 事件订阅失败:', e);
        }
        setTimeout(() => {
            try { window.removeEventListener('eip6963:announceProvider', onAnnounce); } catch (_) {}
            resolve(providers);
        }, timeoutMs);
    });
}

// Web3Modal 配置
class Web3ModalManager {
    constructor() {
        this.web3Modal = null;
        this.provider = null;
        this.web3 = null;
        this.account = null;
        this.chainId = null;
        this.isConnected = false;
        
        // 支持的钱包列表
        this.supportedWallets = [
            'metamask',
            'walletconnect',
            'coinbase',
            'trust',
            'rainbow',
            'argent',
            'imtoken',
            'tokenpocket',
            'mathwallet',
            'safepal',
            'binance',
            'okx'
        ];
        
        this.init();
    }

    /**
     * 初始化 Web3Modal
     */
    async init() {
        try {
            // 兼容 UMD 导出：window.Web3Modal.default 或 window.Web3Modal
            const Web3ModalCtor = (window.Web3Modal && (window.Web3Modal.default || window.Web3Modal)) || null;
            console.log("Web3Modal 构造函数存在:", !!Web3ModalCtor);
            
            // 如果Web3Modal不可用，使用简单的钱包连接
            if (!Web3ModalCtor) {
                // 先尝试CDN兜底加载（避免外部CDN被拦截导致不可用）
                try {
                    console.log('尝试加载 Web3Modal 与 WalletConnectProvider 的备用CDN...');
                    // 加载 Web3Modal（unpkg）
                    await loadScript('https://unpkg.com/web3modal@1.9.0/dist/index.js');
                    // 加载 WalletConnectProvider（unpkg）
                    await loadScript('https://unpkg.com/@walletconnect/web3-provider@1.8.0/dist/umd/index.min.js');
                } catch (e) {
                    console.warn('备用CDN加载失败:', e);
                }
                const FallbackCtor = (window.Web3Modal && (window.Web3Modal.default || window.Web3Modal)) || null;
                if (!FallbackCtor) {
                    console.log("Web3Modal 不可用，使用简单钱包连接");
                    this.useSimpleWallet = true;
                    return;
                }
            }
            
            // 配置可选钱包提供者（移除 WalletConnect v1 入口，避免混淆）
            const providerOptions = {};

            // 创建 Web3Modal 实例（使用兼容的构造函数）
            // 注意：移除无效的 network: "binance" 设置，避免出现
            // Error: No chainId found match binance
            // WalletConnect 的网络通过 providerOptions.rpc 明确指定，无需在此设置 network
            this.web3Modal = new Web3ModalCtor({
                cacheProvider: true, // 缓存用户选择的钱包
                providerOptions,
                theme: {
                    background: "rgb(39, 49, 56)",
                    main: "rgb(199, 199, 199)",
                    secondary: "rgb(136, 136, 136)",
                    border: "rgba(195, 195, 195, 0.14)",
                    hover: "rgb(16, 26, 32)"
                }
            });

            console.log("Web3Modal 初始化成功", this.web3Modal);
            
            // 检查是否有缓存的连接（失败则清除缓存，避免卡死）
            if (this.web3Modal.cachedProvider) {
                try {
                    await this.connectWallet();
                } catch (e) {
                    console.warn('自动恢复缓存连接失败，清除缓存后继续:', e);
                    try {
                        await this.web3Modal.clearCachedProvider();
                    } catch (e2) {
                        console.warn('清除缓存失败:', e2);
                    }
                }
            }
            
        } catch (error) {
            console.error("Web3Modal 初始化失败:", error);
            this.useSimpleWallet = true;
        }
    }

    /**
     * 连接钱包
     */
    async connectWallet() {
        try {
            console.log("开始连接钱包...");
            
            // 如果使用简单钱包连接
            if (this.useSimpleWallet) {
                // Chrome 上注入可能延迟，增加等待与检测兜底
                const hasEth = await waitForEthereum(5000);
                if (hasEth && typeof window.ethereum !== 'undefined') {
                    this.provider = window.ethereum;
                    console.log("使用 window.ethereum 连接");
                } else {
                    // 尝试使用 detect-provider 进行检测
                    const loaded = await ensureDetectProviderLoaded();
                    if (loaded) {
                        try {
                            const detected = await window.detectEthereumProvider();
                            if (detected) {
                                this.provider = detected;
                                console.log('使用 detect-provider 检测到注入钱包');
                            }
                        } catch (e) {
                            console.warn('detect-provider 检测失败:', e);
                        }
                    }
                    // EIP-6963 作为进一步兜底：发现多注入钱包
                    if (!this.provider) {
                        try {
                            const providers = await detectProvidersViaEIP6963(2500);
                            if (providers && providers.length) {
                                this.provider = providers[0];
                                console.log('使用 EIP-6963 检测到注入钱包', providers.length);
                            }
                        } catch (e) {
                            console.warn('EIP-6963 检测失败:', e);
                        }
                    }
                    if (!this.provider) {
                        throw new Error("未检测到钱包，请安装 MetaMask 或其他支持的钱包");
                    }
                }
            } else {
                // 打开钱包选择模态框
                this.provider = await this.web3Modal.connect();
            }
            
            if (!this.provider) {
                throw new Error("无法获取钱包提供者");
            }

            // 创建 Web3 实例
            this.web3 = new Web3(this.provider);
            
            // 获取账户信息
            const accounts = await this.web3.eth.getAccounts();
            if (accounts.length === 0) {
                throw new Error("未找到账户");
            }
            
            this.account = accounts[0];
            this.chainId = await this.web3.eth.getChainId();
            this.isConnected = true;
            
            console.log("钱包连接成功:", {
                account: this.account,
                chainId: this.chainId
            });
            
            // 监听账户和网络变化
            this.subscribeToEvents();
            
            // 触发连接成功事件
            this.onWalletConnected();
            
            return {
                account: this.account,
                chainId: this.chainId,
                provider: this.provider
            };
            
        } catch (error) {
            console.error("钱包连接失败:", error);
            
            // 用户取消连接
            if (error.message.includes("User closed modal")) {
                console.log("用户取消了钱包连接");
                return null;
            }
            
            throw error;
        }
    }

    /**
     * 通过 WalletConnect 扫码连接（优先直接打开扫码）
     */
    async connectViaWalletConnect() {
        try {
            // 若配置了 WalletConnect v2 项目ID，优先使用 v2 的二维码授权
            const cfg = window.ContractConfig || {};
            const projectId = cfg.walletConnectProjectId;
            const targetChainId = cfg.chainId || 1952;
            if (projectId && String(projectId).length > 8) {
                const ok = await ensureWalletConnectV2Loaded();
                const EP = ok ? window.EthereumProvider : null;
                if (EP) {
                    const rpcMap = (() => {
                        const base = {
                            1: 'https://rpc.ankr.com/eth',
                            56: 'https://bsc-dataseed.binance.org/',
                            137: 'https://polygon-rpc.com',
                            66: 'https://exchainrpc.okex.org',
                            195: 'https://xlayertestrpc.okx.com/terigon',
                            1952: 'https://xlayertestrpc.okx.com/terigon'
                        };
                        try { if (cfg.chainId && cfg.rpcUrl) base[cfg.chainId] = cfg.rpcUrl; } catch (e) {}
                        return base;
                    })();
                    const provider = await EP.init({
                        projectId,
                        showQrModal: true,
                        chains: [targetChainId],
                        optionalChains: [1, 56, 137, 66, 195, 1952],
                        rpcMap,
                        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData'],
                        events: ['chainChanged', 'accountsChanged']
                    });
                    await provider.connect();
                    this.provider = provider;
                    this.web3 = new Web3(provider);
                    await this.fetchAccountAndChain();
                    this.subscribeToEvents();
                    this.onWalletConnected();
                    return { account: this.account, chainId: this.chainId, provider: this.provider };
                } else {
                    throw new Error('WalletConnect v2 Provider 未加载，请检查网络/CDN访问');
                }
            }
            // 若未配置项目ID，直接报错（不再回退到 v1）
            throw new Error('未配置 WalletConnect v2 项目ID，无法扫码连接');
        } catch (error) {
            console.error('WalletConnect 扫码连接失败:', error);
            throw error;
        }
    }

    /**
     * 通过 WalletConnect 在手机上直连指定钱包App，发起连接请求
     * 不展示二维码，监听 display_uri 事件并跳转到对应钱包的WC深链
     */
    async connectViaWalletConnectMobile(targetWallet = 'metamask') {
        try {
            // 优先使用 WalletConnect v2（若配置了 projectId）
            const cfg = window.ContractConfig || {};
            const projectId = cfg.walletConnectProjectId;
            const targetChainId = cfg.chainId || 1952;
            if (projectId && String(projectId).length > 8) {
                const ok = await ensureWalletConnectV2Loaded();
                const EP = ok ? window.EthereumProvider : null;
                if (!EP) {
                    throw new Error('WalletConnect v2 Provider 未加载，请检查网络/CDN访问');
                } else {
                    const rpcMap = (() => {
                        const base = {
                            1: 'https://rpc.ankr.com/eth',
                            56: 'https://bsc-dataseed.binance.org/',
                            137: 'https://polygon-rpc.com',
                            66: 'https://exchainrpc.okex.org',
                            195: 'https://xlayertestrpc.okx.com/terigon',
                            1952: 'https://xlayertestrpc.okx.com/terigon'
                        };
                        try {
                            if (cfg.chainId && cfg.rpcUrl) base[cfg.chainId] = cfg.rpcUrl;
                        } catch (e) {
                            console.warn('注入 WalletConnect v2 rpcMap 失败:', e);
                        }
                        return base;
                    })();

                    const provider = await EP.init({
                        projectId,
                        showQrModal: false,
                        chains: [targetChainId],
                        optionalChains: [1, 56, 137, 66, 195, 1952],
                        rpcMap,
                        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData'],
                        events: ['chainChanged', 'accountsChanged']
                    });

                    // 监听 v2 的 display_uri 并深链唤起钱包
                    try {
                        provider.on('display_uri', (uri) => {
                            try { openMobileWallet(targetWallet, uri); } catch (e) { console.warn('处理 v2 display_uri 失败:', e); }
                        });
                    } catch (e) {
                        console.warn('监听 v2 display_uri 失败:', e);
                    }

                    // 触发连接，钱包内应弹出授权
                    await provider.connect();

                    // 设置当前provider并初始化web3
                    this.provider = provider;
                    this.web3 = new Web3(provider);
                    await this.fetchAccountAndChain();
                    this.subscribeToEvents();
                    this.onWalletConnected();
                    return {
                        account: this.account,
                        chainId: this.chainId,
                        provider: this.provider
                    };
                }
            }
            // 若未配置项目ID，直接报错（不再回退到 v1）
            throw new Error('未配置 WalletConnect v2 项目ID，无法进行手机直连');
        } catch (error) {
            console.error('WalletConnect 手机直连失败:', error);
            throw error;
        }
    }
    /**
     * 直接连接浏览器已安装钱包 (Injected，如 MetaMask)
     */
    async connectViaInjected() {
        try {
            // 优先使用浏览器注入的 provider
            if (typeof window.ethereum === 'undefined') {
                // Chrome 场景：先等注入，再用 detect-provider 兜底
                await waitForEthereum(5000);
                if (typeof window.ethereum === 'undefined') {
                    const loaded = await ensureDetectProviderLoaded();
                    if (loaded) {
                        try {
                            const detected = await window.detectEthereumProvider();
                            if (detected) {
                                this.provider = detected;
                                console.log('使用 detect-provider 检测到注入钱包');
                            }
                        } catch (e) {
                            console.warn('detect-provider 检测失败:', e);
                        }
                    }
                    if (!this.provider) {
                        try {
                            const providers = await detectProvidersViaEIP6963(2500);
                            if (providers && providers.length) {
                                this.provider = providers[0];
                                console.log('使用 EIP-6963 检测到注入钱包', providers.length);
                            }
                        } catch (e) {
                            console.warn('EIP-6963 检测失败:', e);
                        }
                    }
                    if (!this.provider) {
                        throw new Error('未检测到浏览器钱包，请安装 MetaMask 或其他钱包');
                    }
                } else {
                    this.provider = window.ethereum;
                }
            } else {
                this.provider = window.ethereum;
            }
            this.web3 = new Web3(this.provider);
            // 统一使用 provider.request 方式请求账户
            let accounts = [];
            if (this.provider && typeof this.provider.request === 'function') {
                accounts = await this.provider.request({ method: 'eth_requestAccounts' });
            } else {
                accounts = await this.web3.eth.getAccounts();
            }
            if (!accounts || accounts.length === 0) {
                // 部分钱包不支持 web3.eth.requestAccounts
                try {
                    const req = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    this.account = req && req[0] ? req[0] : null;
                } catch (e) {
                    // 兜底：部分钱包需要先请求权限
                    await window.ethereum.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }]
                    });
                    const req2 = await window.ethereum.request({ method: 'eth_accounts' });
                    this.account = req2 && req2[0] ? req2[0] : null;
                }
            } else {
                this.account = accounts[0];
            }
            if (!this.account) throw new Error('未找到账户');
            this.chainId = await this.web3.eth.getChainId();
            this.isConnected = true;
            this.subscribeToEvents();
            this.onWalletConnected();
            return { account: this.account, chainId: this.chainId, provider: this.provider };
        } catch (error) {
            console.error('Injected 浏览器钱包连接失败:', error);
            throw error;
        }
    }

    /**
     * 获取已安装的钱包列表（基础检测）
     */
    getInstalledWallets() {
        const injected = !!window.ethereum; // 泛化检测：至少有注入
        const installed = {
            metamask: !!(window.ethereum && window.ethereum.isMetaMask),
            okx: !!(window.okxwallet || (window.ethereum && window.ethereum.isOkxWallet)),
            tokenpocket: !!(window.tokenpocket || (window.ethereum && window.ethereum.isTokenPocket)),
            injected
        };
        return installed;
    }

    /**
     * 直接连接指定钱包类型
     * @param {('metamask'|'okx'|'tokenpocket')} walletType
     */
    async connectSpecificWallet(walletType) {
        try {
            let provider = null;
            switch (walletType) {
                case 'metamask':
                    if (window.ethereum && window.ethereum.isMetaMask) {
                        provider = window.ethereum;
                    } else {
                        throw new Error('MetaMask未安装或不可用');
                    }
                    break;
                case 'okx':
                    if (window.okxwallet) {
                        provider = window.okxwallet;
                    } else if (window.ethereum && window.ethereum.isOkxWallet) {
                        provider = window.ethereum;
                    } else {
                        throw new Error('OKX钱包未安装或不可用');
                    }
                    break;
                case 'tokenpocket':
                    if (window.tokenpocket && window.tokenpocket.ethereum) {
                        provider = window.tokenpocket.ethereum;
                    } else if (window.ethereum && window.ethereum.isTokenPocket) {
                        provider = window.ethereum;
                    } else {
                        throw new Error('TokenPocket未安装或不可用');
                    }
                    break;
                default:
                    throw new Error('不支持的钱包类型');
            }

            // 统一连接流程
            this.provider = provider;
            this.web3 = new Web3(this.provider);
            const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) throw new Error('未找到账户');
            this.account = accounts[0];
            this.chainId = await this.web3.eth.getChainId();
            this.isConnected = true;
            this.subscribeToEvents();
            this.onWalletConnected();
            return { account: this.account, chainId: this.chainId, provider: this.provider };
        } catch (error) {
            console.error('指定钱包连接失败:', error);
            throw error;
        }
    }

    /**
     * 断开钱包连接
     */
    async disconnectWallet() {
        try {
            if (this.provider && this.provider.disconnect) {
                await this.provider.disconnect();
            }
            
            // 清除缓存（仅在Web3Modal可用时）
            if (!this.useSimpleWallet && this.web3Modal) {
                await this.web3Modal.clearCachedProvider();
            }
            
            // 重置状态
            this.provider = null;
            this.web3 = null;
            this.account = null;
            this.chainId = null;
            this.isConnected = false;
            
            console.log("钱包已断开连接");
            
            // 触发断开连接事件
            this.onWalletDisconnected();
            
        } catch (error) {
            console.error("断开钱包连接失败:", error);
        }
    }

    /**
     * 监听钱包事件
     */
    subscribeToEvents() {
        if (!this.provider) return;

        if (typeof this.provider.on === 'function') {
            // 监听账户变化
            this.provider.on("accountsChanged", (accounts) => {
                console.log("账户已变化:", accounts);
                if (accounts.length === 0) {
                    this.disconnectWallet();
                } else {
                    this.account = accounts[0];
                    this.onAccountChanged(this.account);
                }
            });

            // 监听网络变化
            this.provider.on("chainChanged", (chainId) => {
                console.log("网络已变化:", chainId);
                this.chainId = parseInt(chainId, 16);
                this.onChainChanged(this.chainId);
            });

            // 监听连接状态
            this.provider.on("connect", (info) => {
                console.log("钱包已连接:", info);
            });

            // 监听断开连接
            this.provider.on("disconnect", (error) => {
                console.log("钱包已断开:", error);
                this.disconnectWallet();
            });
        } else {
            console.log('当前provider不支持事件订阅（on），跳过事件绑定');
        }
    }

    /**
     * 获取账户余额
     */
    async getBalance(tokenAddress = null) {
        if (!this.web3 || !this.account) {
            throw new Error("钱包未连接");
        }

        try {
            if (tokenAddress) {
                // 获取代币余额
                const erc20Abi = [
                    {
                        "constant": true,
                        "inputs": [{"name": "_owner", "type": "address"}],
                        "name": "balanceOf",
                        "outputs": [{"name": "balance", "type": "uint256"}],
                        "type": "function"
                    },
                    {
                        "constant": true,
                        "inputs": [],
                        "name": "decimals",
                        "outputs": [{"name": "", "type": "uint8"}],
                        "type": "function"
                    }
                ];

                const tokenContract = new this.web3.eth.Contract(erc20Abi, tokenAddress);
                let balance;
                let decimals = 18;
                try {
                    balance = await tokenContract.methods.balanceOf(this.account).call();
                    try {
                        decimals = await tokenContract.methods.decimals().call();
                    } catch (e) {
                        console.warn('代币未实现 decimals()，默认按 18 位处理');
                    }
                } catch (primaryErr) {
                    console.warn('钱包网络读取代币余额失败，尝试只读RPC回退:', primaryErr);
                    // 回退：使用前端配置的只读RPC读取余额，避免因钱包网络未切换导致失败
                    if (window.ContractConfig && window.ContractConfig.rpcUrl) {
                        try {
                            const roWeb3 = new Web3(window.ContractConfig.rpcUrl);
                            const roToken = new roWeb3.eth.Contract(erc20Abi, tokenAddress);
                            balance = await roToken.methods.balanceOf(this.account).call();
                            try {
                                decimals = await roToken.methods.decimals().call();
                            } catch (_) {
                                // 保持默认 18
                            }
                        } catch (fallbackErr) {
                            console.error('只读RPC读取余额失败:', fallbackErr);
                            throw primaryErr;
                        }
                    } else {
                        throw primaryErr;
                    }
                }
                // 根据代币 decimals 做转换；若为18则使用 fromWei
                if (Number(decimals) === 18) {
                    return this.web3.utils.fromWei(balance, 'ether');
                }
                // 非18位：使用 BN 根据 decimals 转换
                const BN = this.web3.utils.BN;
                const balBN = new BN(balance);
                const divisor = new BN(10).pow(new BN(Number(decimals)));
                const whole = balBN.div(divisor).toString();
                const fracBN = balBN.mod(divisor);
                if (fracBN.isZero()) return whole;
                const frac = fracBN.toString().padStart(Number(decimals), '0').replace(/0+$/,'');
                return `${whole}.${frac}`;
            } else {
                // 获取原生代币余额
                const balance = await this.web3.eth.getBalance(this.account);
                return this.web3.utils.fromWei(balance, 'ether');
            }
        } catch (error) {
            console.error("获取余额失败:", error);
            return "0";
        }
    }

    /**
     * 获取 XWAWA 代币地址（从 Lottery 合约读取）
     * 优先使用前端配置中的 Lottery 地址与 ABI
     */
    async getXwawaTokenAddress() {
        if (!this.web3 || !this.account) {
            throw new Error('钱包未连接');
        }

        // 若前端已配置代币地址，直接使用该地址
        if (window.ContractConfig && window.ContractConfig.xwawaTokenAddress) {
            return window.ContractConfig.xwawaTokenAddress;
        }

        // 否则，从 Lottery 合约读取 XWAWA_COIN
        if (!window.ContractConfig || !window.ContractConfig.lotteryAddress || typeof window.ContractConfig.loadLotteryAbi !== 'function') {
            throw new Error('ContractConfig 未正确加载');
        }

        try {
            const abi = await window.ContractConfig.loadLotteryAbi();
            const lottery = new this.web3.eth.Contract(abi, window.ContractConfig.lotteryAddress);
            const tokenAddress = await lottery.methods.XWAWA_COIN().call();
            return tokenAddress;
        } catch (err) {
            console.error('获取 XWAWA 代币地址失败:', err);
            throw err;
        }
    }

    /**
     * 切换网络
     */
    async switchNetwork(chainId) {
        if (!this.provider) {
            throw new Error("钱包未连接");
        }

        try {
            await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }],
            });
        } catch (error) {
            console.error("切换网络失败:", error);
            // 若钱包未添加该网络（错误代码 4902），尝试添加网络后再切换
            const isUnknownChain = (error && (error.code === 4902 || error.message && /Unrecognized chain ID|Unknown chain/i.test(error.message)));
            if (isUnknownChain) {
                const hexChainId = `0x${chainId.toString(16)}`;
                // 优先使用前端 ContractConfig 作为添加网络的参数（支持 1952 或其他）
                let params = null;
                if (window.ContractConfig && window.ContractConfig.chainId === chainId && window.ContractConfig.rpcUrl) {
                    const native = window.ContractConfig.nativeCurrency || { name: 'ETH', symbol: 'ETH', decimals: 18 };
                    const chainName = window.ContractConfig.chainName || `Chain ${chainId}`;
                    const explorers = window.ContractConfig.blockExplorerUrls || [];
                    params = {
                        chainId: hexChainId,
                        chainName,
                        nativeCurrency: native,
                        rpcUrls: [window.ContractConfig.rpcUrl],
                        blockExplorerUrls: explorers
                    };
                }
                // 回退：已知 X Layer Testnet（195）
                if (!params && chainId === 195) {
                    params = {
                        chainId: hexChainId,
                        chainName: 'OKX X Layer Testnet (Terigon)',
                        nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
                        rpcUrls: ['https://xlayertestrpc.okx.com/terigon'],
                        blockExplorerUrls: ['https://www.okx.com/web3/explorer/xlayer-test']
                    };
                }
                if (params) {
                    try {
                        await this.provider.request({ method: 'wallet_addEthereumChain', params: [params] });
                        // 添加成功后再次尝试切换
                        await this.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChainId }] });
                        return;
                    } catch (addErr) {
                        console.error('添加网络失败:', addErr);
                        throw addErr;
                    }
                }
            }
            throw error;
        }
    }

    /**
     * 获取支持的钱包列表
     */
    getSupportedWallets() {
        return this.supportedWallets;
    }

    /**
     * 检查是否支持指定钱包
     */
    isWalletSupported(walletName) {
        return this.supportedWallets.includes(walletName.toLowerCase());
    }

    // 事件回调函数 - 可以被外部重写
    onWalletConnected() {
        // 钱包连接成功回调
        console.log("钱包连接成功回调");
    }

    onWalletDisconnected() {
        // 钱包断开连接回调
        console.log("钱包断开连接回调");
    }

    onAccountChanged(account) {
        // 账户变化回调
        console.log("账户变化回调:", account);
    }

    onChainChanged(chainId) {
        // 网络变化回调
        console.log("网络变化回调:", chainId);
    }
}

// 导出 Web3ModalManager
window.Web3ModalManager = Web3ModalManager;