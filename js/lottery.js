/**
 * Xwawa 抽奖系统 - 核心JavaScript功能实现
 * 
 * 主要功能:
 * 1. Web3钱包连接 (MetaMask等)
 * 2. 智能合约交互 (抽奖合约、代币合约)
 * 3. 抽奖转盘动画和音效
 * 4. 抽奖结果处理和显示
 * 5. 用户界面状态管理
 * 
 * 智能合约集成:
 * - 抽奖合约: 处理抽奖逻辑、奖池管理、随机数生成
 * - XWAWA代币合约: 处理代币支付和余额查询
 * - 事件监听: 抽奖结果、代币转账等区块链事件
 * 
 * 后端API需求:
 * - POST /api/lottery/draw - 记录抽奖历史
 * - GET /api/lottery/history - 获取用户抽奖记录
 * - GET /api/lottery/stats - 获取抽奖统计数据
 * 
 * 安全考虑:
 * - 客户端随机数仅用于动画，实际结果由智能合约生成
 * - 交易签名验证
 * - 防止重复提交
 */

/**
 * API配置
 * 支持本地开发和生产环境的灵活配置
 */
const API_CONFIG = {
    // 获取API基础URL，优先级：window.API_BASE_URL > 环境检测 > 默认本地地址
    getBaseUrl() {
        // 1. 优先使用全局配置
        if (window.API_BASE_URL) {
            return window.API_BASE_URL;
        }
        
        // 2. 自动检测环境
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        
        // 生产环境：使用同域相对路径
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return `${protocol}//${hostname}`;
        }
        
        // 本地开发环境：默认使用3001端口
        return 'http://localhost:3001';
    },
    
    // 获取完整的API端点URL
    getEndpoint(path) {
        const baseUrl = this.getBaseUrl();
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    }
};

/**
 * 全局变量定义
 * 用于管理Web3连接、合约实例和抽奖状态
 */
let web3;                    // Web3实例
let lotteryContract;         // 抽奖智能合约实例
let userAccount;             // 用户钱包地址
let isConnected = false;     // 钱包连接状态
let drawTimes = 1;           // 抽奖次数
let drawCost = 10000;        // 每次抽奖花费的XWAWA代币数量 (从合约获取)
let isSpinning = false;      // 转盘旋转状态锁

/**
 * 奖项映射（仅用于 UI 展示）
 * 说明：不在前端维护概率；所有抽奖结果与概率完全由合约控制
 */
// 按合约枚举 Lottery.WinningType (0~5) 对齐前端ID
// 0: 一等奖周边, 1: 二等奖周边, 2: 三等奖周边, 3: 奖池分红, 4: 双倍奖励, 5: 谢谢参与
const prizes = [
    { id: 0, name: "一等奖", nameEn: "First Prize", color: "#FF6B6B", className: "first-prize" },
    { id: 1, name: "二等奖", nameEn: "Second Prize", color: "#4ECDC4", className: "second-prize" },
    { id: 2, name: "三等奖", nameEn: "Third Prize", color: "#FFD166", className: "third-prize" },
    { id: 3, name: "奖池分红", nameEn: "Pool Dividend", color: "#06D6A0", className: "pool-prize" },
    { id: 4, name: "双倍奖励", nameEn: "Double Reward", color: "#118AB2", className: "double" },
    { id: 5, name: "谢谢参与", nameEn: "Thank You", color: "#073B4C", className: "nothing" }
];

/**
 * 智能合约ABI配置
 * 
 * 重要说明:
 * 1. 此ABI需要与部署的智能合约完全匹配
 * 2. 部署合约后，需要从编译输出中获取完整ABI
 * 3. 建议将ABI存储在单独的JSON文件中，通过fetch动态加载
 * 
 * 主要合约方法:
 * - draw(): 执行抽奖，返回奖项ID
 * - drawCost(): 获取抽奖费用
 * - getBalance(): 获取用户代币余额
 * - getPrizePool(): 获取奖池金额
 * - getUserDrawHistory(): 获取用户抽奖历史
 * 
 * 事件监听:
 * - DrawResult: 抽奖结果事件
 * - PrizeAwarded: 奖品发放事件
 * - PoolUpdated: 奖池更新事件
 */
const lotteryABI = [
    // TODO: 从实际部署的合约中获取完整ABI
    // 以下是示例结构，实际使用时需要替换
    {
        "inputs": [
            { "internalType": "uint256", "name": "_times", "type": "uint256" }
        ],
        "name": "draw",
        "outputs": [
            { "internalType": "uint8[]", "name": "winningType", "type": "uint8[]" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "drawCost",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
    // 更多方法和事件定义...
];

/**
 * 智能合约地址配置
 * 
 * 部署说明:
 * 1. 在测试网部署合约后，更新此地址
 * 2. 主网部署前，确保合约经过充分测试和审计
 * 3. 建议使用环境变量管理不同网络的合约地址
 * 
 * 网络配置:
 * - 测试网: Goerli, Sepolia等
 * - 主网: Ethereum Mainnet
 * - 侧链: Polygon, BSC等
 */
const lotteryContractAddress = "0xdD8ce9b7493af5A7a40e2Ca7f1c23F8d030e6c8e"; // TODO: 替换为实际部署地址

/**
 * XWAWA代币合约地址
 * 用于代币余额查询和授权操作
 */
const xwawaTokenAddress = "0x50c7e04b3DfFab021c9Ab258D62eFb23E41DC6f4"; // TODO: 替换为实际代币地址

/**
 * 关闭结果弹窗
 */
function closeResultModal() {
    const modal = document.getElementById('result-modal');
    if (modal) {
        modal.style.display = 'none';
        
        // 重置领取按钮的显示状态，防止下次显示时出现问题
        const claimBtn = document.getElementById('claim-result');
        if (claimBtn) {
            claimBtn.style.display = 'block';
        }
    }
}

/**
 * 页面初始化
 * 在DOM加载完成后执行所有初始化操作
 */
document.addEventListener('DOMContentLoaded', function() {
    // 首先初始化多语言功能，确保语言设置在其他组件之前完成
    initLanguageSwitch();
    
    // 注册钱包事件监听，确保 WalletManager 连接后能同步到本模块
    registerWalletEventListeners();
    // 初始化用户界面状态（现在由WalletManager处理）
    // updateUI();
    
    // 绑定用户交互事件
    // 注意：钱包连接现在由WalletManager处理
    const drawButton = document.getElementById('draw-button');
    const drawTimesMinusBtn = document.getElementById('draw-times-minus');
    const drawTimesPlusBtn = document.getElementById('draw-times-plus');
    const drawTimesInput = document.getElementById('draw-times-input');
    
    if (drawButton) drawButton.addEventListener('click', startDraw);
    if (drawTimesMinusBtn) drawTimesMinusBtn.addEventListener('click', () => updateDrawTimes(-1));
    if (drawTimesPlusBtn) drawTimesPlusBtn.addEventListener('click', () => updateDrawTimes(1));
    if (drawTimesInput) drawTimesInput.addEventListener('change', validateDrawTimes);
    
    // 绑定弹窗关闭事件
    document.querySelectorAll('.close-modal, .close-result-btn').forEach(element => {
        element.addEventListener('click', closeResultModal);
    });
    
    // 检查是否已连接钱包 (页面刷新后恢复状态)
    checkWalletConnection();
});

/**
 * 监听 WalletManager 派发的连接/断开事件，统一本模块的连接状态
 */
function registerWalletEventListeners() {
    try {
        // 连接成功事件
        document.addEventListener('walletConnected', async (e) => {
            try {
                const detail = (e && e.detail) ? e.detail : {};
                isConnected = true;
                userAccount = detail.account || userAccount;

                // 同步 Web3 实例，优先取 WalletManager 的 web3
                if (window.walletManager && typeof window.walletManager.getWeb3Instance === 'function') {
                    const wmWeb3 = window.walletManager.getWeb3Instance();
                    if (wmWeb3) {
                        web3 = wmWeb3;
                    }
                }
                // 兜底：若仍未获取到 web3，但存在 window.ethereum，则创建
                if (!web3 && window.ethereum) {
                    web3 = new Web3(window.ethereum);
                }

                // 初始化 Lottery 合约并同步抽奖成本
                try {
                    await ensureLotteryContractInitialized();
                    await updateDrawCostFromContract();
                } catch (initErr) {
                    console.warn('初始化合约或抽奖成本失败（将继续运行）:', initErr);
                }

                // 在连接钱包后，拉取并展示该地址的最新30条抽奖记录
                try {
                    if (userAccount) {
                        await fetchAndRenderUserHistory(userAccount);
                    }
                } catch (histErr) {
                    console.warn('获取抽奖历史失败（不影响其他功能）:', histErr);
                }
            } catch (err) {
                console.warn('处理 walletConnected 事件时出错:', err);
            }
        });

        // 断开连接事件
        document.addEventListener('walletDisconnected', () => {
            try {
                isConnected = false;
                userAccount = null;
                // 保持UI由 WalletManager 自行更新；本模块仅同步内部状态
            } catch (err) {
                console.warn('处理 walletDisconnected 事件时出错:', err);
            }
        });
    } catch (e) {
        console.warn('注册钱包事件监听失败:', e);
    }
}

/**
 * 初始化语言切换功能
 * 绑定语言切换开关的事件监听器
 */
function initLanguageSwitch() {
    const enBtn = document.getElementById('en-btn');
    const zhBtn = document.getElementById('zh-btn');
    
    if (enBtn && zhBtn) {
        // 绑定英文按钮点击事件
        enBtn.addEventListener('click', function() {
            if (!this.classList.contains('active')) {
                this.classList.add('active');
                zhBtn.classList.remove('active');
                switchLanguage('en');
                localStorage.setItem('preferred-language', 'en');
            }
        });
        
        // 绑定中文按钮点击事件
        zhBtn.addEventListener('click', function() {
            if (!this.classList.contains('active')) {
                this.classList.add('active');
                enBtn.classList.remove('active');
                switchLanguage('zh');
                localStorage.setItem('preferred-language', 'zh');
            }
        });
        
        // 恢复用户语言偏好，默认为英语
        const savedLang = localStorage.getItem('preferred-language') || 'en';
        if (savedLang === 'en') {
            enBtn.classList.add('active');
            zhBtn.classList.remove('active');
        } else {
            zhBtn.classList.add('active');
            enBtn.classList.remove('active');
        }
        switchLanguage(savedLang);
    }
}

/**
 * 语言切换功能
 * 根据选择的语言更新页面文本内容
 * @param {string} lang - 语言代码 ('zh' 或 'en')
 */
function switchLanguage(lang) {
    const elements = document.querySelectorAll('[data-lang-zh], [data-lang-en]');
    
    elements.forEach(element => {
        if (lang === 'zh') {
            if (element.hasAttribute('data-lang-zh')) {
                const text = element.getAttribute('data-lang-zh');
                if (element.tagName === 'INPUT' && element.type === 'email') {
                    element.placeholder = text;
                } else {
                    element.textContent = text;
                }
            }
        } else {
            if (element.hasAttribute('data-lang-en')) {
                const text = element.getAttribute('data-lang-en');
                if (element.tagName === 'INPUT' && element.type === 'email') {
                    element.placeholder = text;
                } else {
                    element.textContent = text;
                }
            }
        }
    });
    
    // 更新钱包状态文本
    if (window.walletManager) {
        window.walletManager.updateWalletStatus();
    }
}

/**
 * 获取当前语言设置
 * @returns {string} 'zh' 或 'en'
 */
function getCurrentLanguage() {
    // 检查按钮式语言切换器
    const enBtn = document.getElementById('en-btn');
    const zhBtn = document.getElementById('zh-btn');
    
    if (enBtn && enBtn.classList.contains('active')) {
        return 'en';
    } else if (zhBtn && zhBtn.classList.contains('active')) {
        return 'zh';
    }
    
    // 如果没有找到按钮，回退到localStorage，默认为英语
    return localStorage.getItem('preferred-language') || 'en';
}

/**
 * 检查钱包连接状态
 * 页面加载时检查是否已连接钱包，恢复连接状态
 */
async function checkWalletConnection() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                userAccount = accounts[0];
                web3 = new Web3(window.ethereum);
                // 动态加载ABI与部署地址
                try {
                    const abi = await window.ContractConfig.loadLotteryAbi();
                    const addr = window.ContractConfig.lotteryAddress;
                    if (!addr) {
                        console.error('Lottery合约地址未配置，请在 js/contract-config.js 中填写 lotteryAddress');
                    } else {
                        lotteryContract = new web3.eth.Contract(abi, addr);
                    }
                } catch (e) {
                    console.error('加载Lottery ABI失败:', e);
                }
                isConnected = true;
                // updateUI(); // 现在由WalletManager处理
                
                // 获取最新的抽奖成本
                await updateDrawCostFromContract();
            }
        } catch (error) {
            console.error("检查钱包连接失败:", error);
        }
    }
}

/**
 * 从后端API获取并渲染用户抽奖历史
 * 后端地址： /api/lottery/history?address=0x...&limit=30 (自动适配环境)
 * 渲染到： #results-container
 */
async function fetchAndRenderUserHistory(address) {
    const container = document.getElementById('results-container');
    const noResultsEl = container ? container.querySelector('.no-results') : null;
    if (!container) return;

    // 显示加载状态
    const isEnglish = getCurrentLanguage() === 'en';
    container.innerHTML = `<div class="loading">${isEnglish ? 'Loading lottery records...' : '正在加载抽奖记录...'}</div>`;

    const apiUrl = `${API_CONFIG.getEndpoint('/api/lottery/history')}?address=${encodeURIComponent(address)}&limit=30`;
    let data;
    try {
        const resp = await fetch(apiUrl);
        if (!resp.ok) throw new Error(`API返回错误: ${resp.status}`);
        data = await resp.json();
        console.log('API返回的数据:', data);
    } catch (err) {
        console.warn('拉取抽奖历史API失败:', err);
        container.innerHTML = `<div class="no-results">${isEnglish ? 'Unable to retrieve lottery records at the moment' : '暂时无法获取抽奖记录'}</div>`;
        return;
    }

    const records = (data && Array.isArray(data.records)) ? data.records : [];
    console.log('处理的记录数组:', records);

    if (!records.length) {
        container.innerHTML = `<div class="no-results">${isEnglish ? 'No lottery records yet. Try your luck!' : '还没有抽奖记录。试试您的运气吧！'}</div>`;
        return;
    }

    // 构建列表
    const fragment = document.createDocumentFragment();
    records.forEach((r) => {
        const item = document.createElement('div');
        item.className = 'result-item';

        const icon = document.createElement('span');
        icon.className = 'result-icon';
        const prizeIdLike = Number(r.prize);
        icon.textContent = getResultIcon(Number.isFinite(prizeIdLike) ? prizeIdLike : 0);

        const name = document.createElement('span');
        name.className = 'result-name';
        name.textContent = normalizePrizeName(r.prize);

        const value = document.createElement('span');
        value.className = 'result-value';
        const ts = r.created_at ? new Date(r.created_at) : new Date();
        value.textContent = ts.toLocaleString();

        // 判断是否为一二三等奖
        const needsShipping = Number.isFinite(prizeIdLike) && [0, 1, 2].includes(prizeIdLike);
        const autoSent = Number.isFinite(prizeIdLike) && [3, 4].includes(prizeIdLike);
        const isThanks = Number.isFinite(prizeIdLike) && prizeIdLike === 5;

        const trailing = document.createElement('div');
        trailing.className = 'result-action';
        trailing.style.display = 'flex';
        trailing.style.gap = '8px';
        trailing.style.alignItems = 'center';

        if (needsShipping) {
            // 添加详情按钮
            const detailBtn = document.createElement('button');
            detailBtn.className = 'detail-btn btn-small';
            const currentLangIsEnglish = getCurrentLanguage() === 'en';
            detailBtn.textContent = currentLangIsEnglish ? 'Details' : '详情';
            detailBtn.title = currentLangIsEnglish ? 'View prize details' : '查看中奖详情';
            detailBtn.addEventListener('click', () => {
                // 构造result对象传递给详情弹窗
                console.log('原始记录数据 r:', r);
                const resultObj = {
                    id: r.id,  // 使用数据库记录ID，而不是奖品ID
                    prize_id: prizeIdLike,  // 奖品ID单独存储
                    name: normalizePrizeName(r.prize),
                    record_id: r.id,  // 保持向后兼容
                    wallet_address: r.wallet_address,
                    created_at: r.created_at,
                    email: r.email,
                    claim_status: r.claim_status,
                    claimed_at: r.claimed_at
                };
                console.log('构造的resultObj:', resultObj);
                openPrizeDetailModal(resultObj);
            });
            trailing.appendChild(detailBtn);

            // 显示状态
            const statusSpan = document.createElement('span');
            statusSpan.className = 'result-status';
            const statusLangIsEnglish = getCurrentLanguage() === 'en';
            
            if (r.claim_status === 'claimed') {
                statusSpan.textContent = statusLangIsEnglish ? '✅ Claimed' : '✅ 已领取';
                statusSpan.style.color = '#28a745';
            } else if (r.email) {
                statusSpan.textContent = statusLangIsEnglish ? '📧 Email Filled' : '📧 已填写邮箱';
                statusSpan.style.color = '#007bff';
            } else {
                statusSpan.textContent = statusLangIsEnglish ? '⏳ Pending' : '⏳ 待领取';
                statusSpan.style.color = '#ffc107';
            }
            trailing.appendChild(statusSpan);
        } else {
            const statusSpan = document.createElement('span');
            statusSpan.className = 'result-status';
            const otherStatusLangIsEnglish = getCurrentLanguage() === 'en';
            if (autoSent) {
                statusSpan.textContent = otherStatusLangIsEnglish ? '✅ Reward Auto-sent' : '✅ 奖励已自动发放';
                statusSpan.style.color = '#28a745';
            } else if (isThanks) {
                statusSpan.textContent = otherStatusLangIsEnglish ? '❌ No Prize' : '❌ 未中奖';
                statusSpan.style.color = '#6c757d';
            } else {
                const confirmedText = otherStatusLangIsEnglish ? '✅ Confirmed' : '✅ 已确认';
                const processingText = otherStatusLangIsEnglish ? '⏳ Processing' : '⏳ 处理中';
                statusSpan.textContent = r.status === 'confirmed' ? confirmedText : (r.status || processingText);
            }
            trailing.appendChild(statusSpan);
        }

        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(value);
        item.appendChild(trailing);

        fragment.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

// 规范化奖项名称显示
function normalizePrizeName(prize) {
    const isEnglish = getCurrentLanguage() === 'en';
    
    if (prize == null) return isEnglish ? 'Unknown Prize' : '未知奖项';
    const n = Number(prize);
    if (Number.isFinite(n)) {
        switch (n) {
            case 0: return isEnglish ? 'First Prize' : '一等奖';
            case 1: return isEnglish ? 'Second Prize' : '二等奖';
            case 2: return isEnglish ? 'Third Prize' : '三等奖';
            case 3: return isEnglish ? 'Pool Prize' : '奖池奖';
            case 4: return isEnglish ? 'Double Reward' : '双倍奖励';
            case 5: return isEnglish ? 'Thank You' : '谢谢参与';
            default: return isEnglish ? `Prize(${n})` : `奖项(${n})`;
        }
    }
    // 字符串
    return String(prize);
}

/**
 * 连接钱包功能
 * 检测并连接用户的Web3钱包 (主要支持MetaMask)
 * 
 * 功能流程:
 * 1. 检测钱包是否安装
 * 2. 请求用户授权连接
 * 3. 初始化Web3实例和智能合约
 * 4. 获取合约参数 (抽奖成本等)
 * 5. 更新UI状态
 * 
 * 错误处理:
 * - 钱包未安装: 提示用户安装MetaMask
 * - 用户拒绝连接: 显示连接失败信息
 * - 网络错误: 提示检查网络连接
 * - 合约调用失败: 使用默认参数
 */
async function connectWallet() {
    try {
        // 检查是否安装了Web3钱包 (MetaMask等)
        if (window.ethereum) {
            console.log("Web3钱包已检测到");
            
            // 请求用户授权连接钱包
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accounts[0];
            
            // 创建Web3实例
            web3 = new Web3(window.ethereum);
            
            // 初始化抽奖智能合约实例
            // 动态加载ABI与部署地址
            try {
                const abi = await window.ContractConfig.loadLotteryAbi();
                const addr = window.ContractConfig.lotteryAddress;
                if (!addr) {
                    console.error('Lottery合约地址未配置，请在 js/contract-config.js 中填写 lotteryAddress');
                } else {
                    lotteryContract = new web3.eth.Contract(abi, addr);
                }
            } catch (e) {
                console.error('加载Lottery ABI失败:', e);
            }
            
            // 从智能合约获取最新的抽奖成本（仅当合约已初始化）
            if (lotteryContract) {
                await updateDrawCostFromContract();
            }
            
            // 监听账户变化事件
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            
            // 监听网络变化事件
            window.ethereum.on('chainChanged', handleChainChanged);
            
            // 更新连接状态
            isConnected = true;
            
            // 更新用户界面
            // updateUI(); // 现在由WalletManager处理
            
            console.log("钱包连接成功:", userAccount);
            
        } else {
            // 钱包未安装的处理
            alert("请安装MetaMask钱包以使用抽奖功能！");
            window.open("https://metamask.io/download/", "_blank");
        }
    } catch (error) {
        console.error("连接钱包失败:", error);
        
        // 根据错误类型显示不同的提示信息
        if (error.code === 4001) {
            alert("用户拒绝了钱包连接请求");
        } else if (error.code === -32002) {
            alert("钱包连接请求已在处理中，请检查MetaMask");
        } else {
            alert("连接钱包时发生错误，请重试");
        }
        
        // 重置连接状态
        isConnected = false;
        // updateUI(); // 现在由WalletManager处理
    }
}

/**
 * 从智能合约更新抽奖成本
 * 获取合约中设置的最新抽奖费用
 */
async function updateDrawCostFromContract() {
    try {
        if (!lotteryContract) throw new Error('Lottery 合约未初始化');
        const contractDrawCost = await lotteryContract.methods.drawCost().call();
        drawCost = web3.utils.fromWei(contractDrawCost, 'ether');
        console.log("合约抽奖成本:", drawCost);
        
        // 更新UI显示
        const costElement = document.getElementById('cost-amount');
        if (costElement) {
            costElement.textContent = drawCost;
        }
        
        // 更新总费用显示
        updateTotalCost();
        
    } catch (error) {
        console.error("获取抽奖成本失败:", error);
        // 使用默认值，不影响用户体验
        const costElement = document.getElementById('cost-amount');
        if (costElement) {
            costElement.textContent = drawCost;
        }
    }
}

/**
 * 处理账户变化事件
 * 当用户在MetaMask中切换账户时触发
 */
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // 用户断开了钱包连接
        isConnected = false;
        userAccount = null;
        console.log("钱包已断开连接");
    } else {
        // 用户切换了账户
        userAccount = accounts[0];
        console.log("账户已切换:", userAccount);
    }
    // updateUI(); // 现在由WalletManager处理
}

/**
 * 处理网络变化事件
 * 当用户在MetaMask中切换网络时触发
 */
function handleChainChanged(chainId) {
    console.log("网络已切换:", chainId);
    // 重新加载页面以确保应用状态正确
    window.location.reload();
}

/**
 * 更新抽奖次数
 * 通过加减按钮调整抽奖次数
 * @param {number} change - 变化量 (+1 或 -1)
 */
function updateDrawTimes(change) {
    const input = document.getElementById('draw-times-input');
    let newValue = parseInt(input.value) + change;
    
    // 确保次数在有效范围内 (1-100次)
    if (newValue < 1) newValue = 1;
    if (newValue > 100) newValue = 100;
    
    input.value = newValue;
    drawTimes = newValue;
    updateTotalCost();
}

/**
 * 验证抽奖次数输入
 * 当用户直接在输入框中输入数字时进行验证
 */
function validateDrawTimes() {
    const input = document.getElementById('draw-times-input');
    let value = parseInt(input.value);
    
    // 确保输入是有效数字且在允许范围内
    if (isNaN(value) || value < 1) {
        value = 1;
    } else if (value > 100) {
        value = 100;
    }
    
    input.value = value;
    drawTimes = value;
    updateTotalCost();
}

/**
 * 更新总花费显示
 * 根据抽奖次数和单次费用计算总费用
 */
function updateTotalCost() {
    const totalCost = drawTimes * drawCost;
    const totalCostElement = document.getElementById('total-cost-amount');
    if (totalCostElement) {
        totalCostElement.textContent = totalCost;
    }
}

/**
 * 与 WalletManager 同步连接状态
 * 当 Lottery 自身未更新 isConnected 时，从全局 walletManager 读取连接信息
 */
function syncConnectionFromWalletManager() {
    try {
        if (window.walletManager && typeof window.walletManager.getConnectionStatus === 'function') {
            const status = window.walletManager.getConnectionStatus();
            if (status && status.isConnected && status.account) {
                isConnected = true;
                userAccount = status.account;
                if (typeof window.walletManager.getWeb3Instance === 'function') {
                    const wmWeb3 = window.walletManager.getWeb3Instance();
                    if (wmWeb3) {
                        web3 = wmWeb3;
                    }
                }
            }
        } else if (window.web3ModalManager && window.web3ModalManager.account) {
            // 兼容未暴露 walletManager 的场景
            isConnected = true;
            userAccount = window.web3ModalManager.account;
            if (window.ethereum && !web3) {
                web3 = new Web3(window.ethereum);
            }
        }
    } catch (e) {
        console.warn('同步钱包连接状态失败:', e);
    }
}

/**
 * 开始抽奖功能
 * 执行抽奖流程，包括智能合约交互和结果处理
 * 
 * 抽奖流程:
 * 1. 验证钱包连接状态
 * 2. 检查用户代币余额
 * 3. 调用智能合约执行抽奖
 * 4. 处理抽奖结果和动画
 * 5. 更新用户界面和历史记录
 * 
 * 智能合约交互:
 * - 检查用户XWAWA代币余额
 * - 授权合约扣除代币
 * - 调用抽奖合约方法
 * - 监听抽奖结果事件
 * 
 * 后端API调用:
 * - POST /api/lottery/draw - 记录抽奖历史
 * - PUT /api/users/balance - 更新用户余额
 */
async function startDraw() {
    // 与 WalletManager 同步连接状态，避免因 isConnected 未更新而无法抽奖
    syncConnectionFromWalletManager();
    // 检查钱包连接状态
    if (!isConnected) {
        alert('请先连接钱包');
        return;
    }

    // 确保当前网络为配置的链（例如 1952）并初始化合约
    try {
        await ensureCorrectChain();
        await ensureLotteryContractInitialized();
    } catch (netErr) {
        console.error('网络或合约初始化失败:', netErr);
        alert(`请切换到链ID ${((window.ContractConfig && window.ContractConfig.chainId) || 1952)} 并重试`);
        return;
    }
    
    // 防止重复抽奖
    if (isSpinning) {
        return;
    }
    
    // 设置抽奖状态，禁用抽奖按钮
    isSpinning = true;
    const drawButton = document.getElementById('draw-button');
    if (drawButton) {
        drawButton.disabled = true;
        const currentLang = getCurrentLanguage();
        const isEnglish = currentLang === 'en';
        drawButton.textContent = isEnglish ? 'Drawing...' : '抽奖中...';
    }
    
    try {
        // 开始动画和音效，链上交易确认后再定位到真实奖项
        startMagicAnimation();
        try { if (typeof playSpinSound === 'function') playSpinSound(); } catch (e) { console.warn('播放音效失败或未定义:', e); }
        // 预旋转提升交互感
        beginPreSpin();

        const { tx, prizeId } = await drawFromContract(1);

        // 仅按合约结果显示；无合约结果则不显示任何前端随机文案
        let finalPrize = null;
        if (typeof prizeId === 'number' && !Number.isNaN(prizeId)) {
            finalPrize = prizes.find(p => p.id === prizeId) || prizes.find(p => p.id === 5);
        } else {
            console.warn('未获取到链上中奖结果，取消前端随机兜底显示');
            alert('未获取到链上抽奖结果，请稍后重试。');
            // 停止预旋转
            try { stopPreSpin(); } catch (e) {}
            resetDrawState();
            return;
        }

        // 停止预旋转并转盘旋转到真实结果（健壮性处理，避免函数未定义中断流程）
        try { stopPreSpin(); } catch (e) {}
        try { if (typeof spinWheel === 'function') { spinWheel(finalPrize.id); } } catch (e) { console.warn('spinWheel 未定义或执行失败:', e); }

        // 使用转盘过渡结束事件，确保弹窗出现的瞬间转盘停止
        const wheelEl = document.querySelector('.wheel-inner');
        const onSpinEnd = () => {
            try {
                // 触发获奖效果（含烟花）
                if (finalPrize.id <= 4 && typeof addWinEffect === 'function') {
                    addWinEffect(finalPrize.id);
                }
                // 显示结果弹窗（与停止同步）
                if (typeof showResultModal === 'function') {
                    showResultModal(finalPrize);
                } else {
                    console.warn('showResultModal 未定义，使用备用提示');
                    const safeMessage = (typeof getResultMessage === 'function')
                        ? getResultMessage(finalPrize.id)
                        : '抽奖已完成，结果显示模块暂不可用。';
                    const currentLang = getCurrentLanguage();
                    const isEnglish = currentLang === 'en';
                    const congratsText = isEnglish ? 'Congratulations! You won:' : '恭喜获得:';
                    const prizeName = isEnglish ? finalPrize.nameEn : finalPrize.name;
                    alert(`${congratsText} ${prizeName}\n${safeMessage}`);
                }
                // 抽奖完成后写入后端数据库
                try {
                    const txHash = (tx && (tx.transactionHash || tx.hash)) || null;
                    persistDrawResult({
                        wallet_address: (userAccount || '').toLowerCase(),
                        prize: finalPrize.id,
                        amount: null,
                        tx_hash: txHash,
                        status: 'confirmed'
                    }).then(() => {
                        if (userAccount) fetchAndRenderUserHistory(userAccount);
                    }).catch(err => {
                        console.warn('写入抽奖记录失败（不影响前端显示）:', err);
                    });
                } catch (e) {
                    console.warn('持久化抽奖记录异常（已忽略）:', e);
                }
                if (typeof addResultsToList === 'function') {
                    addResultsToList([finalPrize]);
                }
            } catch (e) {
                console.error('显示抽奖结果时出错:', e);
                alert('显示结果失败，但抽奖已完成。');
            } finally {
                resetDrawState();
                try { refreshWalletBalance(); } catch (e) { console.warn('刷新余额失败:', e); }
            }
        };
        // 一次性触发保护，避免 transitionend 未触发导致流程卡住
        let spinCompleted = false;
        const onSpinEndOnce = () => {
            if (spinCompleted) return;
            spinCompleted = true;
            onSpinEnd();
        };
        if (wheelEl) {
            wheelEl.addEventListener('transitionend', onSpinEndOnce, { once: true });
            // 兜底：与动画时长一致稍微延后，确保必触发
            setTimeout(onSpinEndOnce, 5400);
        } else {
            // 元素不存在时直接走兜底
            setTimeout(onSpinEndOnce, 5200);
        }
    } catch (error) {
        console.error('抽奖失败:', error);
        alert('抽奖失败，请重试');
        resetDrawState();
    }
}

/**
 * 重置抽奖状态
 * 恢复抽奖按钮和相关UI状态
 */
function resetDrawState() {
    isSpinning = false;
    const drawButton = document.getElementById('draw-button');
    if (drawButton) {
        drawButton.disabled = false;
        const currentLang = getCurrentLanguage();
        const isEnglish = currentLang === 'en';
        drawButton.textContent = isEnglish ? 'Start Draw' : '开始抽奖';
    }
    // 清理预旋转状态
    try { stopPreSpin(); } catch (e) {}
}

// 预旋转控制：在等待链上结果时保持转盘轻快旋转
function beginPreSpin() {
    const wheel = document.querySelector('.wheel-inner');
    const pointer = document.querySelector('.wheel-pointer');
    const wheelContainer = document.querySelector('.lottery-wheel-container');
    const wheelAura = document.querySelector('.wheel-magic-aura');

    if (wheel) {
        wheel.classList.add('pre-spin');
    }
    if (pointer) {
        pointer.classList.add('pointer-active');
    }
    if (wheelContainer) {
        wheelContainer.classList.add('spinning');
    }
    if (wheelAura) {
        wheelAura.classList.add('spinning-aura');
    }
}

function stopPreSpin() {
    const wheel = document.querySelector('.wheel-inner');
    const pointer = document.querySelector('.wheel-pointer');
    const wheelContainer = document.querySelector('.lottery-wheel-container');
    const wheelAura = document.querySelector('.wheel-magic-aura');

    if (wheel) {
        wheel.classList.remove('pre-spin');
        // 清除内联 transition 以避免叠加影响（保护性处理）
        wheel.style.transition = '';
    }
    if (pointer) {
        pointer.classList.remove('pointer-active');
    }
    if (wheelContainer) {
        wheelContainer.classList.remove('spinning', 'mid-spin', 'magic-spinning', 'magic-burst');
    }
    if (wheelAura) {
        wheelAura.classList.remove('spinning-aura');
    }
}

/**
 * 获取用户代币余额
 * 从XWAWA代币合约查询用户余额
 * @returns {Promise<number>} 用户代币余额
 */
async function getUserTokenBalance() {
    try {
        const xwawaContract = await getXwawaContract();
        const balance = await xwawaContract.methods.balanceOf(userAccount).call();
        return parseFloat(web3.utils.fromWei(balance, 'ether'));
    } catch (error) {
        console.error("获取用户余额失败:", error);
        return 0;
    }
}

/**
 * 更新UI状态
 */
function updateUI() {
    const walletStatusEl = document.getElementById('wallet-status');
    const walletAddressEl = document.getElementById('wallet-address');
    const walletBalanceEl = document.getElementById('wallet-balance');
    const connectButton = document.getElementById('connect-wallet-btn');
    const drawButton = document.getElementById('draw-button');

    if (isConnected) {
        if (walletStatusEl) {
            walletStatusEl.classList.remove('not-connected');
            walletStatusEl.classList.add('connected');
        }
        if (walletAddressEl) {
            walletAddressEl.textContent = shortenAddress(userAccount);
        }
        if (connectButton) {
            connectButton.textContent = '已连接';
            connectButton.disabled = true;
        }
        if (drawButton) {
            drawButton.disabled = false;
        }
        // 已连接时刷新余额显示（容错处理，WalletManager也会刷新）
        try { refreshWalletBalance(); } catch (e) { console.warn('刷新余额失败:', e); }
    } else {
        if (walletStatusEl) {
            walletStatusEl.classList.remove('connected');
            walletStatusEl.classList.add('not-connected');
        }
        if (walletAddressEl) {
            walletAddressEl.textContent = '';
        }
        if (walletBalanceEl) {
            walletBalanceEl.textContent = '';
        }
        if (connectButton) {
            connectButton.textContent = '连接钱包';
            connectButton.disabled = false;
        }
        if (drawButton) {
            drawButton.disabled = true;
        }
    }

    // 更新抽奖成本和总成本（单次抽奖）
    const costEl = document.getElementById('cost-amount');
    if (costEl) costEl.textContent = drawCost;
    const totalCostEl = document.getElementById('total-cost-amount');
    if (totalCostEl) totalCostEl.textContent = drawCost;
}

/**
 * 将抽奖结果写入后端数据库（钱包地址作为"用户名"）
 */
async function persistDrawResult(payload) {
    const apiUrl = API_CONFIG.getEndpoint('/api/lottery/draw');
    const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`写入抽奖记录失败: ${resp.status}`);
    return await resp.json();
}

/**
 * 刷新并显示钱包余额
 * 在抽奖完成后调用，确保余额及时更新
 */
async function refreshWalletBalance() {
    try {
        const balance = await getUserTokenBalance();
        const walletBalanceEl = document.getElementById('wallet-balance');
        if (walletBalanceEl) {
            walletBalanceEl.textContent = `余额: ${balance.toFixed(4)} XWAWA`;
        }
    } catch (error) {
        console.error('刷新余额失败:', error);
    }
}

/**
 * 缩短地址显示
 * @param {string} address - 钱包地址
 * @returns {string} 缩短后的地址
 */
function shortenAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * 模拟抽奖结果生成 (仅用于开发测试)
 * 实际生产环境中，结果应完全由智能合约生成
 * @returns {Array} 抽奖结果数组
 */
// 已移除：本地模拟结果生成。请使用链上合约结果。
function generateMockResults() {
    // 已禁用：请使用链上合约结果，不进行任何本地随机
    throw new Error('本地模拟已禁用，请使用链上合约结果');
    for (let i = 0; i < drawTimes; i++) {
        // 随机选择一个奖项 (仅用于前端展示)
        const result = getRandomPrize();
        results.push(result);
            
        // 如果是第一次抽奖，旋转转盘
        if (i === 0) {
            spinWheel(result.id);
        }
    }
        
    // 添加抽奖结果到结果列表
    addResultsToList(results);
        
    // 如果只抽奖一次，显示结果弹窗
    if (drawTimes === 1) {
        setTimeout(() => {
            showResultModal(results[0]);
        }, 5500); // 等待转盘停止后显示
    }
        
    console.log("抽奖完成，结果:", results);
    try {
        console.error("抽奖失败:", error);
        alert('抽奖失败，请重试');
        isSpinning = false;
        document.getElementById('draw-button').disabled = false;
    }
    catch (error) {
        console.error("抽奖失败:", error);
        alert('抽奖失败，请重试');
        isSpinning = false;
        document.getElementById('draw-button').disabled = false;
    }

    // 已移除：不在前端计算随机奖项，结果由合约事件提供

    // 魔法转盘旋转 - 魔法主题优化版本
    function spinWheel(prizeId) {
        const wheel = document.querySelector('.wheel-inner');
        const wheelContainer = document.querySelector('.lottery-wheel-container');
        const pointer = document.querySelector('.wheel-pointer');
        const wheelAura = document.querySelector('.wheel-magic-aura');
        if (typeof stopPreSpin === 'function') { try { stopPreSpin(); } catch (e) {} }
    
        // 添加魔法旋转开始的视觉效果
        wheelContainer.classList.add('spinning', 'magic-spinning');
        pointer.classList.add('pointer-active');
        
        // 激活魔法光环
        if (wheelAura) {
            wheelAura.classList.add('spinning-aura');
        }
    
        // 计算旋转角度
        // 每个奖项占60度，计算目标奖项的中心角度
        // 使用0基索引：0->30°, 1->90°, 2->150°, 3->210°, 4->270°, 5->330°
        const targetAngle = (prizeId) * 60 + 30;
    
        // 添加随机的额外旋转圈数 (8-12圈，更多圈数增加魔法感)
        const extraRotations = (8 + Math.random() * 4) * 360;
    
        // 最终旋转角度 = 额外圈数 + (360 - 目标角度)
        const finalRotation = extraRotations + (360 - targetAngle);
    
        // 应用魔法旋转动画 - 更长的动画时间和魔法曲线
        wheel.style.transition = 'transform 5s cubic-bezier(0.23, 1, 0.32, 1)';
        wheel.style.transform = `rotate(${finalRotation}deg)`;
    
        // 添加音效和震动效果 (如果支持)
        try { if (typeof playSpinSound === 'function') playSpinSound(); } catch (e) { console.warn('播放音效失败或未定义:', e); }
        addVibration();
        
        // 创建魔法旋转粒子效果
        createSpinningMagicParticles();
    
        // 动画过程中的魔法效果
        setTimeout(() => {
            // 中途添加魔法能量爆发
            wheelContainer.classList.add('mid-spin', 'magic-burst');
            createMagicEnergyWave();
        }, 2500);
    
        // 动画结束后的处理
        setTimeout(() => {
            isSpinning = false;
            wheelContainer.classList.remove('spinning', 'mid-spin', 'magic-spinning', 'magic-burst');
            pointer.classList.remove('pointer-active');
            wheelContainer.classList.add('spin-complete');
            
            if (wheelAura) {
                wheelAura.classList.remove('spinning-aura');
            }
            // 获奖效果与弹窗展示改为在 transitionend 钩子中统一触发
            document.getElementById('draw-button').disabled = false;
        
            // 清除完成状态
            setTimeout(() => {
                wheelContainer.classList.remove('spin-complete');
            }, 1000);
        }, 5000); // 延长到5秒匹配新的动画时间
    }

    // 播放旋转音效
    function playSpinSound() {
        try {
            // 创建音频上下文来播放简单的音效
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
        
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
        
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
        
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // 如果音频API不支持，静默失败
            console.log('Audio not supported');
        }
    }

    // 添加震动效果
    function addVibration() {
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    // 添加获奖效果
    function addWinEffect(prizeId) {
        const wheelContainer = document.querySelector('.lottery-wheel-container');
    
        // 根据奖项等级添加不同的效果（主要特效≤2秒）
        if (prizeId <= 2) {
            // 高级奖项：更强闪光与较多烟花，时长约1.5秒
            wheelContainer.classList.add('major-win');
            createFireworks(18);
            setTimeout(() => {
                wheelContainer.classList.remove('major-win');
            }, 1500);
        } else if (prizeId <= 4) {
            // 中级奖项：发光效果与少量烟花，时长约1.2秒
            wheelContainer.classList.add('minor-win');
            createFireworks(12);
            setTimeout(() => {
                wheelContainer.classList.remove('minor-win');
            }, 1200);
        } else {
            // 谢谢参与：轻微完成闪光
            wheelContainer.classList.add('spin-complete');
            setTimeout(() => {
                wheelContainer.classList.remove('spin-complete');
            }, 800);
        }
    }

    // 创建烟花效果（时长控制 ≤ ~1.8秒）- 全屏覆盖层版本
    function createFireworks(count = 12) {
        let overlay = document.querySelector('.fireworks-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'fireworks-overlay';
            document.body.appendChild(overlay);
        }

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'firework-particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                // 传递随机方向给 CSS 动画变量
                particle.style.setProperty('--random-x', Math.random().toString());
                particle.style.setProperty('--random-y', Math.random().toString());
                overlay.appendChild(particle);

                setTimeout(() => {
                    if (particle.parentNode) particle.parentNode.removeChild(particle);
                }, 1000);
            }, i * 70);
        }

        // 清理覆盖层（所有粒子结束后尝试移除）
        const cleanupDelay = count * 70 + 1400;
        setTimeout(() => {
            if (overlay && overlay.childElementCount === 0 && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, cleanupDelay);

        // 兜底：最长3秒后强制清理残留空层
        setTimeout(() => {
            if (overlay && overlay.childElementCount === 0 && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 3000);
    }

    // 添加结果到列表（包含领取按钮）
    function addResultsToList(results) {
        const resultsList = document.querySelector('.results-list');
        const noResults = document.querySelector('.no-results');

        if (noResults) {
            noResults.style.display = 'none';
        }

        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${result.className}`;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'result-name';
            nameSpan.textContent = result.name;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'result-value';
            timeSpan.textContent = new Date().toLocaleTimeString();

    const isWin = result.id && result.id <= 5; // 1~5视为可领取（包含双倍奖励）
            const claimBtn = document.createElement('button');
            claimBtn.className = 'claim-btn';
            claimBtn.textContent = '领取';
            claimBtn.disabled = !isWin;
            if (!isWin) {
                claimBtn.title = '未中奖不可领取';
            }

            claimBtn.addEventListener('click', async () => {
                try {
                    claimBtn.disabled = true;
                    claimBtn.textContent = '领取中...';
                    await claimPrize(result);
                    claimBtn.textContent = '已领取';
                } catch (e) {
                    console.error('领取失败:', e);
                    alert('领取失败：' + (e && e.message ? e.message : e));
                    claimBtn.disabled = false;
                    claimBtn.textContent = '领取';
                }
            });

            resultItem.appendChild(nameSpan);
            resultItem.appendChild(timeSpan);
            resultItem.appendChild(claimBtn);

            resultsList.prepend(resultItem);
        });
    }

    // 领奖：检测合约是否提供相关接口
    async function claimPrize(result) {
        if (!lotteryContract) throw new Error('Lottery 合约未初始化');
        const methods = lotteryContract.methods || {};
        // 依次尝试常见领奖方法名
        const tryCalls = [
            () => methods.claimPrize && methods.claimPrize(result && result.id ? result.id : 0),
            () => methods.claim && methods.claim(result && result.id ? result.id : 0),
            () => methods.redeem && methods.redeem(result && result.id ? result.id : 0)
        ];

        for (const getCall of tryCalls) {
            const call = getCall();
            if (call && typeof call.send === 'function') {
                return await call.send({ from: userAccount });
            }
        }

        throw new Error('当前合约未提供领奖接口（claimPrize/claim/redeem）。请在合约中实现后再试。');
    }

    // 显示结果弹窗
    function showResultModal(result) {
        const modal = document.getElementById('result-modal');
        const resultTitle = document.querySelector('.result-title'); // HTML为class而非id
        const resultMessageEl = document.getElementById('result-message');
        const resultIconEl = document.getElementById('result-icon');
        const claimBtn = document.getElementById('claim-result');

        // 如果缺少弹窗容器，使用兜底方式提示用户
        if (!modal) {
            console.warn('结果弹窗容器 #result-modal 未找到，使用 alert 兜底');
            const safeMessage = (typeof getResultMessage === 'function')
                ? getResultMessage(result && result.id ? result.id : 0)
                : '抽奖已完成，结果显示模块暂不可用。';
            const currentLang = getCurrentLanguage();
            const isEnglish = currentLang === 'en';
            const congratsText = isEnglish ? 'Congratulations! You won:' : '恭喜获得:';
            const prizeName = result && result.name ? (isEnglish ? result.nameEn : result.name) : (isEnglish ? 'Unknown Prize' : '未知奖项');
            alert(`${congratsText} ${prizeName}\n${safeMessage}`);
            return;
        }

        // 设置结果信息（节点存在时才更新）
        const currentLang = getCurrentLanguage();
        const isEnglish = currentLang === 'en';
        const congratsText = isEnglish ? 'Congratulations! You won:' : '恭喜获得:';
        const prizeName = isEnglish ? result.nameEn : result.name;
        if (resultTitle) resultTitle.textContent = `${congratsText} ${prizeName}`;
        const safeMessage = (typeof getResultMessage === 'function') ? getResultMessage(result.id) : '抽奖已完成，结果显示模块暂不可用。';
        if (resultMessageEl) resultMessageEl.textContent = safeMessage;
        if (resultIconEl) {
            const safeIcon = (typeof getResultIcon === 'function') ? getResultIcon(result.id) : '🎉';
            resultIconEl.textContent = safeIcon;
            resultIconEl.style.color = result.color || '#fff';
        }

        // 显示弹窗
        modal.style.display = 'block';

        // 配置“领取奖励”按钮
        if (claimBtn) {
            const isWin = result && result.id && result.id <= 5; // 1~5 视为可领取（包含双倍奖励）
            claimBtn.disabled = !isWin;
            claimBtn.textContent = isWin ? '领取奖励' : '不可领取';
            claimBtn.title = isWin ? '' : '未中奖不可领取';
            claimBtn.onclick = null;
            if (isWin) {
                claimBtn.onclick = async () => {
                    try {
                        claimBtn.disabled = true;
                        claimBtn.textContent = '领取中...';
                        await claimPrize(result);
                        claimBtn.textContent = '已领取';
                    } catch (e) {
                        console.error('领取失败:', e);
                        alert('领取失败：' + (e && e.message ? e.message : e));
                        claimBtn.disabled = false;
                        claimBtn.textContent = '领取奖励';
                    }
                };
            }
        }
    }

    // 关闭结果弹窗 - 移除，将在文件顶部重新定义

    // 获取结果消息
    function getResultMessage(prizeId) {
        switch (prizeId) {
            case 0:
                return "恭喜您获得一等奖！奖励已发放到您的账户。";
            case 1:
                return "恭喜您获得二等奖！奖励已发放到您的账户。";
            case 2:
                return "恭喜您获得三等奖！奖励已发放到您的账户。";
            case 3:
                return "您获得了奖池分红！奖励已发放到您的账户。";
            case 4:
                return "恭喜获得双倍奖励：本次抽奖成本的两倍XWAWA币，可立即领取。";
            case 5:
                return "谢谢参与，下次再接再厉！";
            default:
                return "抽奖结果未知，请联系客服。";
        }
    }

    // 获取结果图标
    function getResultIcon(prizeId) {
        switch (prizeId) {
            case 0:
                return "🏆";
            case 1:
                return "🥈";
            case 2:
                return "🥉";
            case 3:
                return "💰";
            case 4:
                return "🎯";
            case 5:
                return "😊";
            default:
                return "❓";
        }
    }


}

// 顶层定义：魔法转盘旋转与特效（确保 startDraw 可调用）
function spinWheel(prizeId) {
    const wheel = document.querySelector('.wheel-inner');
    const wheelContainer = document.querySelector('.lottery-wheel-container');
    const pointer = document.querySelector('.wheel-pointer');
    const wheelAura = document.querySelector('.wheel-magic-aura');
    if (typeof stopPreSpin === 'function') { try { stopPreSpin(); } catch (e) {} }

    if (!wheel || !wheelContainer || !pointer) {
        console.warn('转盘元素未找到，无法执行旋转');
        return;
    }

    // 开始视觉效果
    wheelContainer.classList.add('spinning', 'magic-spinning');
    pointer.classList.add('pointer-active');
    if (wheelAura) wheelAura.classList.add('spinning-aura');

    // 计算旋转角度（每项60°，中心对齐30°）
    const targetAngle = (prizeId) * 60 + 30;
    const extraRotations = (8 + Math.random() * 4) * 360; // 8-12圈
    const finalRotation = extraRotations + (360 - targetAngle);

    // 应用旋转动画
    wheel.style.transition = 'transform 5s cubic-bezier(0.23, 1, 0.32, 1)';
    wheel.style.transform = `rotate(${finalRotation}deg)`;

    // 音效与震动
    try { if (typeof playSpinSound === 'function') playSpinSound(); } catch (e) { console.warn('播放音效失败或未定义:', e); }
    addVibration();

    // 过程特效
    try { if (typeof createSpinningMagicParticles === 'function') createSpinningMagicParticles(); } catch (e) {}
    setTimeout(() => {
        wheelContainer.classList.add('mid-spin', 'magic-burst');
        try { if (typeof createMagicEnergyWave === 'function') createMagicEnergyWave(); } catch (e) {}
    }, 2500);

    // 动画结束视觉复位（结果展示在 transitionend 钩子完成）
    setTimeout(() => {
        try { if (typeof isSpinning !== 'undefined') { isSpinning = false; } } catch (e) {}
        wheelContainer.classList.remove('spinning', 'mid-spin', 'magic-spinning', 'magic-burst');
        pointer.classList.remove('pointer-active');
        wheelContainer.classList.add('spin-complete');
        if (wheelAura) wheelAura.classList.remove('spinning-aura');
        const btn = document.getElementById('draw-button');
        if (btn) btn.disabled = false;
        setTimeout(() => { wheelContainer.classList.remove('spin-complete'); }, 1000);
    }, 5000);
}

function playSpinSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.log('Audio not supported');
    }
}

function addVibration() {
    if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
    }
}

function addWinEffect(prizeId) {
    const wheelContainer = document.querySelector('.lottery-wheel-container');
    if (!wheelContainer) return;
    if (prizeId <= 2) {
        wheelContainer.classList.add('major-win');
        createFireworks(18);
        setTimeout(() => { wheelContainer.classList.remove('major-win'); }, 1500);
    } else if (prizeId <= 4) {
        wheelContainer.classList.add('minor-win');
        createFireworks(12);
        setTimeout(() => { wheelContainer.classList.remove('minor-win'); }, 1200);
    } else {
        wheelContainer.classList.add('spin-complete');
        setTimeout(() => { wheelContainer.classList.remove('spin-complete'); }, 800);
    }
}

function createFireworks(count = 12) {
    let overlay = document.querySelector('.fireworks-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'fireworks-overlay';
        document.body.appendChild(overlay);
    }
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'firework-particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.setProperty('--random-x', Math.random().toString());
            particle.style.setProperty('--random-y', Math.random().toString());
            overlay.appendChild(particle);
            setTimeout(() => { if (particle.parentNode) particle.parentNode.removeChild(particle); }, 1000);
        }, i * 70);
    }
    const cleanupDelay = count * 70 + 1400;
    setTimeout(() => {
        if (overlay && overlay.childElementCount === 0 && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, cleanupDelay);
    setTimeout(() => {
        if (overlay && overlay.childElementCount === 0 && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 3000);
}

// 顶层定义：结果展示与领奖相关函数（从 generateMockResults 内提升到全局作用域）
function addResultsToList(results) {
    const resultsList = document.querySelector('.results-list');
    const noResults = document.querySelector('.no-results');

    if (noResults) {
        noResults.style.display = 'none';
    }

    results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.className}`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'result-name';
        nameSpan.textContent = result.name;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'result-value';
        timeSpan.textContent = new Date().toLocaleTimeString();

        // 设置领取与状态：仅 0,1,2 显示领取按钮；3,4 显示到账提示；5 显示未中奖
        const needsShipping = (typeof result.id === 'number') && [0, 1, 2].includes(result.id);
        const autoSent = (typeof result.id === 'number') && [3, 4].includes(result.id);
        const isThanks = (typeof result.id === 'number') && result.id === 5;

        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'result-buttons';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.alignItems = 'center';

        if (needsShipping) {
            const currentLangIsEnglish = getCurrentLanguage() === 'en';
            
            // 添加详情按钮
            const detailBtn = document.createElement('button');
            detailBtn.className = 'detail-btn';
            detailBtn.textContent = currentLangIsEnglish ? 'Details' : '详情';
            detailBtn.title = currentLangIsEnglish ? 'View prize details' : '查看中奖详情';
            detailBtn.addEventListener('click', () => openPrizeDetailModal(result));
            buttonContainer.appendChild(detailBtn);

            // 添加领取按钮
            const claimBtn = document.createElement('button');
            claimBtn.className = 'claim-btn';
            claimBtn.textContent = currentLangIsEnglish ? 'Claim Reward' : '领取奖励';
            claimBtn.disabled = false;
            claimBtn.title = currentLangIsEnglish ? 'View details and fill in email address' : '查看详情并填写邮箱地址';
            claimBtn.addEventListener('click', () => openPrizeDetailModal(result));
            buttonContainer.appendChild(claimBtn);
        } else {
            const statusSpan = document.createElement('span');
            statusSpan.className = 'result-status ' + (autoSent ? 'status-auto' : 'status-none');
            statusSpan.textContent = autoSent ? '奖励已自动发放' : '未中奖';
            buttonContainer.appendChild(statusSpan);
        }

        resultItem.appendChild(nameSpan);
        resultItem.appendChild(timeSpan);
        resultItem.appendChild(buttonContainer);

        resultsList.prepend(resultItem);
    });
}

// 领奖：检测合约是否提供相关接口
async function claimPrize(result) {
    if (!lotteryContract) throw new Error('Lottery 合约未初始化');
    const methods = lotteryContract.methods || {};
    // 依次尝试常见领奖方法名
    const tryCalls = [
        () => methods.claimPrize && methods.claimPrize(result && result.id ? result.id : 0),
        () => methods.claim && methods.claim(result && result.id ? result.id : 0),
        () => methods.redeem && methods.redeem(result && result.id ? result.id : 0)
    ];

    for (const getCall of tryCalls) {
        const call = getCall();
        if (call && typeof call.send === 'function') {
            return await call.send({ from: userAccount });
        }
    }

    throw new Error('当前合约未提供领奖接口（claimPrize/claim/redeem）。请在合约中实现后再试。');
}

// 显示结果弹窗
function showResultModal(result) {
    const modal = document.getElementById('result-modal');
    const resultTitle = document.querySelector('.result-title'); // HTML为class而非id
    const resultMessageEl = document.getElementById('result-message');
    const resultIconEl = document.getElementById('result-icon');
    const claimBtn = document.getElementById('claim-result');

    // 如果缺少弹窗容器，使用兜底方式提示用户
    if (!modal) {
        console.warn('结果弹窗容器 #result-modal 未找到，使用 alert 兜底');
        const safeMessage = (typeof getResultMessage === 'function')
            ? getResultMessage(result && result.id ? result.id : 0)
            : '抽奖已完成，结果显示模块暂不可用。';
        alert(`恭喜获得: ${result && result.name ? result.name : '未知奖项'}\n${safeMessage}`);
        return;
    }

    // 设置结果信息（节点存在时才更新）
    const currentLang = getCurrentLanguage();
    const isEnglish = currentLang === 'en';
    const congratsText = isEnglish ? 'Congratulations! You won:' : '恭喜获得:';
    const prizeName = isEnglish ? result.nameEn : result.name;
    if (resultTitle) resultTitle.textContent = `${congratsText} ${prizeName}`;
    const safeMessage = (typeof getResultMessage === 'function') ? getResultMessage(result.id) : (isEnglish ? 'Lottery completed, result display module unavailable.' : '抽奖已完成，结果显示模块暂不可用。');
    if (resultMessageEl) resultMessageEl.textContent = safeMessage;
    if (resultIconEl) {
        const safeIcon = (typeof getResultIcon === 'function') ? getResultIcon(result.id) : '🎉';
        resultIconEl.textContent = safeIcon;
        resultIconEl.style.color = result.color || '#fff';
    }

    // 显示弹窗
    modal.style.display = 'block';

    // 配置“领取奖励”按钮：0,1,2 需填写收货信息；3,4 自动发放；5 谢谢参与
    if (claimBtn) {
        const needsShipping = (typeof result.id === 'number') && [0, 1, 2].includes(result.id);
        const autoSent = (typeof result.id === 'number') && [3, 4].includes(result.id);
        const isThanks = (typeof result.id === 'number') && result.id === 5;

        claimBtn.onclick = null;
        if (needsShipping) {
            // 对于需要填写收货信息的奖品，隐藏领取按钮，引导用户到中奖记录
            claimBtn.style.display = 'none';
        } else if (autoSent) {
            claimBtn.disabled = true;
            claimBtn.textContent = '奖励已自动发放';
            claimBtn.title = '奖金已自动发送到钱包，无需手动领取';
        } else {
            claimBtn.disabled = true;
            claimBtn.textContent = '不可领取';
            claimBtn.title = isThanks ? '未中奖不可领取' : '不可领取';
        }
    }
}

// 获取结果文案
function getResultMessage(prizeId) {
    const isEnglish = getCurrentLanguage() === 'en';
    
    switch (prizeId) {
        case 0:
            return isEnglish ? 
                'Congratulations! You won the First Prize! Please click details in the winning records to claim.' :
                '恭喜您获得一等奖！请在中奖记录中点击详情领取。';
        case 1:
            return isEnglish ? 
                'Congratulations! You won the Second Prize! Please click details in the winning records to claim.' :
                '恭喜您获得二等奖！请在中奖记录中点击详情领取。';
        case 2:
            return isEnglish ? 
                'Congratulations! You won the Third Prize! Please click details in the winning records to claim.' :
                '恭喜您获得三等奖！请在中奖记录中点击详情领取。';
        case 3:
            return isEnglish ? 
                'Prize money has been automatically sent to your wallet, please check.' :
                '奖金已自动发送到钱包，注意查收。';
        case 4:
            return isEnglish ? 
                'Prize money has been automatically sent to your wallet, please check.' :
                '奖金已自动发送到钱包，注意查收。';
        case 5:
            return isEnglish ? 
                'Thank you for participating, better luck next time!' :
                '谢谢参与，下次再接再厉！';
        default:
            return isEnglish ? 
                'Unknown lottery result, please contact customer service.' :
                '抽奖结果未知，请联系客服。';
    }
}

// 获取结果图标
function getResultIcon(prizeId) {
    switch (prizeId) {
        case 0:
            return '🏆';
        case 1:
            return '🥈';
        case 2:
            return '🥉';
        case 3:
            return '💰';
        case 4:
            return '🎯';
        case 5:
            return '😊';
        default:
            return '❓';
    }
}

// 收货信息弹窗逻辑
function openShippingModal(result) {
    const modal = document.getElementById('shipping-modal');
    if (!modal) { alert('未找到收货信息弹窗'); return; }
    const titleEl = document.getElementById('shippingModalTitle');
    if (titleEl) titleEl.textContent = `领取奖励 - ${result && result.name ? result.name : '实物奖品'}`;

    const emailInput = document.getElementById('shipping-email');
    const addressInput = document.getElementById('shipping-address');
    const nameInput = document.getElementById('shipping-name');
    const phoneInput = document.getElementById('shipping-phone');
    const submitBtn = document.getElementById('shipping-submit');
    const cancelBtn = document.getElementById('shipping-cancel');
    const closeBtn = document.getElementById('shipping-close');
    const overlay = document.getElementById('shipping-overlay');

    // 预填本地数据
    try {
        const ls = window.localStorage;
        if (ls) {
            emailInput && (emailInput.value = ls.getItem('xwawa_shipping_email') || '');
            addressInput && (addressInput.value = ls.getItem('xwawa_shipping_address') || '');
            nameInput && (nameInput.value = ls.getItem('xwawa_shipping_name') || '');
            phoneInput && (phoneInput.value = ls.getItem('xwawa_shipping_phone') || '');
        }
    } catch (e) {}

    const handleClose = () => { modal.style.display = 'none'; };
    if (cancelBtn) cancelBtn.onclick = handleClose;
    if (closeBtn) closeBtn.onclick = handleClose;
    if (overlay) overlay.onclick = handleClose;

    const formEl = document.getElementById('shipping-form');
    if (formEl) {
        formEl.onsubmit = (ev) => {
            ev.preventDefault();
            const email = (emailInput && emailInput.value || '').trim();
            const address = (addressInput && addressInput.value || '').trim();
            const name = (nameInput && nameInput.value || '').trim();
            const phone = (phoneInput && phoneInput.value || '').trim();
            if (!email || !address) { alert('请填写邮箱和收货地址'); return; }
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '提交中...'; }

            try {
                const ls = window.localStorage;
                if (ls) {
                    ls.setItem('xwawa_shipping_email', email);
                    ls.setItem('xwawa_shipping_address', address);
                    ls.setItem('xwawa_shipping_name', name);
                    ls.setItem('xwawa_shipping_phone', phone);
                }
            } catch (e) {}

            setTimeout(() => {
                alert('提交成功！我们将尽快安排发货，请留意邮箱或电话通知。');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '提交信息'; }
                handleClose();
            }, 300);
        };
    }

    modal.style.display = 'flex';
}

function closeShippingModal() {
    const modal = document.getElementById('shipping-modal');
    if (modal) modal.style.display = 'none';
}

// openClaimModal 函数已删除，统一使用 openPrizeDetailModal

/**
 * 打开中奖详情弹窗
 */
function openPrizeDetailModal(result) {
    const modal = document.getElementById('prize-detail-modal');
    const isEnglish = getCurrentLanguage() === 'en';
    
    if (!modal) { 
        alert(isEnglish ? 'Detail modal not found' : '未找到详情弹窗'); 
        return; 
    }

    // 更新弹窗标题和标签的多语言显示
    const modalTitle = document.getElementById('prizeDetailModalTitle');
    if (modalTitle) {
        modalTitle.textContent = isEnglish ? 'Prize Details' : '中奖详情';
    }

    // 更新所有标签的多语言显示
    const labels = modal.querySelectorAll('label[data-lang-zh][data-lang-en]');
    labels.forEach(label => {
        const zhText = label.getAttribute('data-lang-zh');
        const enText = label.getAttribute('data-lang-en');
        if (zhText && enText) {
            label.textContent = isEnglish ? enText : zhText;
        }
    });

    // 更新按钮的多语言显示
    const cancelBtn = document.getElementById('prize-detail-cancel');
    if (cancelBtn) {
        cancelBtn.textContent = isEnglish ? 'Close' : '关闭';
    }

    // 设置详情信息
    const prizeNameEl = document.getElementById('detail-prize-name');
    const drawTimeEl = document.getElementById('detail-draw-time');
    const walletAddressEl = document.getElementById('detail-wallet-address');
    const claimStatusEl = document.getElementById('detail-claim-status');
    const emailInput = document.getElementById('detail-email');
    const updateEmailBtn = document.getElementById('update-email-btn');
    const claimPrizeBtn = document.getElementById('claim-prize-btn');

    // 更新邮箱输入框的占位符
    if (emailInput) {
        emailInput.placeholder = isEnglish ? 'Please enter email address' : '请输入邮箱地址';
    }

    // 更新按钮文本
    if (updateEmailBtn) {
        updateEmailBtn.textContent = isEnglish ? 'Update Email' : '更新邮箱';
    }
    if (claimPrizeBtn) {
        claimPrizeBtn.textContent = isEnglish ? 'Claim Prize' : '领取奖励';
    }

    if (prizeNameEl) {
        // 根据语言显示对应的奖项名称
        let prizeName = isEnglish ? 'Unknown Prize' : '未知奖项';
        if (result.name) {
            // 如果有奖项ID，从prizes数组中获取对应的名称
            if (result.prize_id !== undefined) {
                const prize = prizes.find(p => p.id === result.prize_id);
                if (prize) {
                    prizeName = isEnglish ? prize.nameEn : prize.name;
                }
            } else {
                // 如果没有奖项ID，尝试根据名称匹配
                const prize = prizes.find(p => p.name === result.name);
                if (prize) {
                    prizeName = isEnglish ? prize.nameEn : prize.name;
                } else {
                    prizeName = result.name; // 使用原始名称作为后备
                }
            }
        }
        prizeNameEl.textContent = prizeName;
    }
    
    // 使用created_at字段作为中奖时间
    const drawTime = result.created_at ? new Date(result.created_at).toLocaleString() : 
                     result.draw_time || new Date().toLocaleString();
    if (drawTimeEl) drawTimeEl.textContent = drawTime;
    
    if (walletAddressEl) walletAddressEl.textContent = result.wallet_address || userAccount || (isEnglish ? 'Unknown Address' : '未知地址');
    
    // 设置领取状态
    const claimStatus = result.claim_status || 'unclaimed';
    if (claimStatusEl) {
        claimStatusEl.textContent = claimStatus === 'claimed' ? 
            (isEnglish ? 'Claimed' : '已领取') : 
            (isEnglish ? 'Unclaimed' : '未领取');
        claimStatusEl.style.color = claimStatus === 'claimed' ? '#28a745' : '#dc3545';
    }

    // 设置邮箱
    if (emailInput) {
        emailInput.value = result.email || '';
    }

    // 设置按钮状态
    if (claimPrizeBtn) {
        if (claimStatus === 'claimed') {
            claimPrizeBtn.style.display = 'none';
        } else {
            claimPrizeBtn.style.display = 'inline-block';
            claimPrizeBtn.onclick = async () => {
                const email = emailInput.value.trim();
                if (!email) { 
                    alert(isEnglish ? 'Please fill in the email address first' : '请先填写邮箱地址'); 
                    return; 
                }
                
                try {
                    await claimPrizeWithEmail(result, email);
                    alert(isEnglish ? 'Claim successful!' : '领取成功！');
                    closeModal();
                    if (userAccount) {
                        await fetchAndRenderUserHistory(userAccount);
                    }
                } catch (error) {
                    alert((isEnglish ? 'Claim failed: ' : '领取失败：') + (error.message || (isEnglish ? 'Network error' : '网络错误')));
                }
            };
        }
    }

    // 更新邮箱按钮
    if (updateEmailBtn) {
        updateEmailBtn.onclick = async () => {
            const email = emailInput.value.trim();
            if (!email) { 
                alert(isEnglish ? 'Please fill in the email address' : '请填写邮箱地址'); 
                return; 
            }
            
            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) { 
                alert(isEnglish ? 'Please enter a valid email address' : '请输入有效的邮箱地址'); 
                return; 
            }

            try {
                updateEmailBtn.disabled = true;
                updateEmailBtn.textContent = isEnglish ? 'Updating...' : '更新中...';
                
                await updatePrizeEmail(result, email);
                alert(isEnglish ? 'Email updated successfully!' : '邮箱更新成功！');
                
                // 刷新中奖记录
                if (userAccount) {
                    await fetchAndRenderUserHistory(userAccount);
                }
            } catch (error) {
                alert((isEnglish ? 'Update failed: ' : '更新失败：') + (error.message || (isEnglish ? 'Network error' : '网络错误')));
            } finally {
                updateEmailBtn.disabled = false;
                updateEmailBtn.textContent = isEnglish ? 'Update Email' : '更新邮箱';
            }
        };
    }

    const closeModal = () => { modal.style.display = 'none'; };
    
    // 绑定关闭事件
    const closeBtn = document.getElementById('prize-detail-close');
    const overlay = document.getElementById('prize-detail-overlay');
    
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (closeBtn) closeBtn.onclick = closeModal;
    if (overlay) overlay.onclick = closeModal;

    modal.style.display = 'flex';
}

/**
 * 调用后端API领取奖励
 */
async function claimPrizeWithEmail(result, email) {
    const response = await fetch(API_CONFIG.getEndpoint('/api/lottery/claim'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            record_id: result.id || result.record_id,
            wallet_address: userAccount,
            email: email
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
}

/**
 * 调用后端API更新邮箱
 */
async function updatePrizeEmail(result, email) {
    console.log('updatePrizeEmail 接收到的 result:', result);
    console.log('updatePrizeEmail 使用的 record_id:', result.id || result.record_id);
    console.log('updatePrizeEmail 使用的 wallet_address:', userAccount);
    
    const requestBody = {
        record_id: result.id || result.record_id,
        wallet_address: userAccount,
        email: email
    };
    console.log('发送的请求体:', requestBody);
    
    const response = await fetch(API_CONFIG.getEndpoint('/api/lottery/update-email'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
}

// 将关键展示与文案方法显式挂到 window，避免作用域问题
if (typeof window !== 'undefined') {
    window.showResultModal = window.showResultModal || showResultModal;
    window.getResultMessage = window.getResultMessage || getResultMessage;
    window.getResultIcon = window.getResultIcon || getResultIcon;
    window.openShippingModal = window.openShippingModal || openShippingModal;
    window.openPrizeDetailModal = window.openPrizeDetailModal || openPrizeDetailModal;
}

    /**
     * 以下是与智能合约交互的函数
     * 注意: 这些函数需要根据实际的合约ABI进行调整
     * 
     * 合约函数说明:
     * 1. draw(): 进行一次抽奖，返回抽奖结果
     * 2. drawCost(): 获取每次抽奖的成本
     * 3. drawTimes(): 获取用户的抽奖次数
     * 4. XWAWA_COIN(): 获取Xwawa代币合约地址
     * 
     * 这些函数在实际部署时需要根据Lottery.abi文件中的实际合约接口进行调整
     */

    // 实际调用合约的draw函数
    async function drawFromContract(times) {
        try {
            if (!lotteryContract) throw new Error('Lottery 合约未初始化');

            // 计算所需代币总额（使用合约raw值进行BN计算）
            const drawCostRaw = await lotteryContract.methods.drawCost().call();
            const totalCost = web3.utils.toBN(drawCostRaw).mul(web3.utils.toBN(times));

            // 检查并执行approve
            const xwawa = await getXwawaContract();
            const spender = lotteryContract.options.address;
            const currentAllowance = await xwawa.methods.allowance(userAccount, spender).call();
            if (web3.utils.toBN(currentAllowance).lt(totalCost)) {
                await xwawa.methods.approve(spender, totalCost.toString()).send({ from: userAccount });
            }

            // 执行抽奖交易（兼容 draw(times) 与 draw() 两种签名）
            let tx;
            try {
                tx = await lotteryContract.methods.draw(times).send({ from: userAccount });
            } catch (e) {
                // 如果合约不支持次数参数，回退到无参版本
                if (String(e && e.message || '').includes('invalid number of parameters')) {
                    tx = await lotteryContract.methods.draw().send({ from: userAccount });
                } else {
                    throw e;
                }
            }

            // 解析事件中的中奖结果，仅信任链上返回
            let prizeId = null;
            const evts = tx && tx.events ? tx.events : null;
            // Web3 常见返回：events 映射
            if (evts && evts.DrawResult && evts.DrawResult.returnValues) {
                const rv = evts.DrawResult.returnValues;
                prizeId = Number(rv.prizeId ?? rv[1]);
            } else if (evts && evts.Draw && evts.Draw.returnValues) {
                const rv = evts.Draw.returnValues;
                if (rv.prizeId != null) {
                    prizeId = Number(rv.prizeId);
                } else if (rv.winningType != null) {
                    const wt = rv.winningType;
                    prizeId = Number(Array.isArray(wt) ? wt[0] : wt);
                }
            }

            // Ethers 风格（如 tx.logs/tx.events 数组）兜底解析，但仍需链上事件存在
            if ((prizeId == null || Number.isNaN(prizeId)) && Array.isArray(evts)) {
                const evt = evts.find(e => e.event === 'DrawResult' || e.event === 'Draw');
                const args = evt && (evt.args || evt.returnValues);
                if (args) {
                    prizeId = Number(args.prizeId ?? (args.winningType ? (Array.isArray(args.winningType) ? args.winningType[0] : args.winningType) : args[1]));
                }
            }

            if (prizeId == null || Number.isNaN(prizeId)) {
                console.warn('未能从链上事件解析出 prizeId');
            }

            return { tx, prizeId };
        } catch (error) {
            console.error('合约抽奖失败:', error);
            throw error;
        }
    }

    // 确保切换到正确网络（默认 1952），必要时尝试添加网络
    async function ensureCorrectChain() {
        try {
            if (!window.ethereum || !web3) return;
            const currentId = await web3.eth.getChainId();
            const targetId = (window.ContractConfig && window.ContractConfig.chainId) || 1952;
            if (currentId === targetId) return;

            const hexId = `0x${targetId.toString(16)}`;
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: hexId }]
                });
                return;
            } catch (switchErr) {
                const needAdd = (switchErr && (switchErr.code === 4902 || (switchErr.message && /Unrecognized chain ID|Unknown chain/i.test(switchErr.message))));
                if (!needAdd) throw switchErr;

                const params = {
                    chainId: hexId,
                    chainName: (window.ContractConfig && window.ContractConfig.chainName) || `Chain ${targetId}`,
                    nativeCurrency: (window.ContractConfig && window.ContractConfig.nativeCurrency) || { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: [((window.ContractConfig && window.ContractConfig.rpcUrl) || '')].filter(Boolean),
                    blockExplorerUrls: (window.ContractConfig && window.ContractConfig.blockExplorerUrls) || []
                };
                await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [params] });
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
            }
        } catch (e) {
            console.error('确保正确网络失败:', e);
            throw e;
        }
    }

    // 若未初始化，使用前端配置初始化 Lottery 合约实例
    async function ensureLotteryContractInitialized() {
        if (lotteryContract) return;
        // 优先使用现有 web3；若不存在则尝试从 WalletManager 获取；再兜底使用 window.ethereum
        if (!web3) {
            try {
                if (window.walletManager && typeof window.walletManager.getWeb3Instance === 'function') {
                    const wmWeb3 = window.walletManager.getWeb3Instance();
                    if (wmWeb3) {
                        web3 = wmWeb3;
                    }
                }
            } catch (e) {
                console.warn('从 WalletManager 获取 web3 失败:', e);
            }
        }
        if (!web3) {
            if (window.ethereum) {
                web3 = new Web3(window.ethereum);
            } else {
                throw new Error('未检测到可用的钱包提供者');
            }
        }
        if (!window.ContractConfig || !window.ContractConfig.lotteryAddress || typeof window.ContractConfig.loadLotteryAbi !== 'function') {
            throw new Error('ContractConfig 未正确配置 (lotteryAddress/ABI)');
        }
        const abi = await window.ContractConfig.loadLotteryAbi();
        lotteryContract = new web3.eth.Contract(abi, window.ContractConfig.lotteryAddress);
    }

    // 获取Xwawa代币合约
    async function getXwawaContract() {
        try {
            // 优先使用前端配置的测试代币地址
            let xwawaAddress = window.ContractConfig && window.ContractConfig.xwawaTokenAddress
                ? window.ContractConfig.xwawaTokenAddress
                : null;
            // 若未配置，则尝试从 Lottery 合约读取
            if (!xwawaAddress) {
                if (!lotteryContract) throw new Error('Lottery 合约未初始化，且未配置 xwawaTokenAddress');
                xwawaAddress = await lotteryContract.methods.XWAWA_COIN().call();
            }
        
            // 这里需要Xwawa代币的ABI，这只是一个示例
            const xwawaABI = [
                {
                    "constant": true,
                    "inputs": [{ "name": "_owner", "type": "address" }],
                    "name": "balanceOf",
                    "outputs": [{ "name": "balance", "type": "uint256" }],
                    "type": "function"
                },
                {
                    "constant": true,
                    "inputs": [
                        { "name": "_owner", "type": "address" },
                        { "name": "_spender", "type": "address" }
                    ],
                    "name": "allowance",
                    "outputs": [{ "name": "", "type": "uint256" }],
                    "type": "function"
                },
                {
                    "constant": false,
                    "inputs": [
                        { "name": "_spender", "type": "address" },
                        { "name": "_value", "type": "uint256" }
                    ],
                    "name": "approve",
                    "outputs": [{ "name": "", "type": "bool" }],
                    "type": "function"
                }
            ];
        
            return new web3.eth.Contract(xwawaABI, xwawaAddress);
        } catch (error) {
            console.error("获取Xwawa合约失败:", error);
            throw error;
        }
    }

/**
 * 魔法师Xwawa动画系统
 * 实现魔法棒挥动、魔法粒子效果和转盘魔法化
 */

// 启动魔法动画序列
function startMagicAnimation() {
    const magicWizard = document.querySelector('.magic-wizard');
    const magicWand = document.querySelector('.magic-wand');
    const magicArm = document.querySelector('#magic-arm');
    const magicParticles = document.querySelector('.magic-particles');
    const magicSpell = document.querySelector('.magic-spell');
    const wheelAura = document.querySelector('.wheel-magic-aura');
    
    if (!magicWizard) return;
    
    // 1. 魔法师准备施法
    magicWizard.classList.add('casting');
    
    // 2. 显示魔法咒语
    if (magicSpell) {
        magicSpell.style.opacity = '1';
        magicSpell.style.transform = 'translateY(-10px)';
    }
    
    // 3. 手臂和魔法棒开始挥动
    setTimeout(() => {
        // 手臂挥动动画
        if (magicArm) {
            magicArm.classList.add('casting');
        }
        
        // 魔法棒挥动动画
        if (magicWand) {
            magicWand.classList.add('waving');
        }
        
        // 激活魔法粒子效果
        if (magicParticles) {
            magicParticles.classList.add('active');
        }
        
        // 播放魔法音效
        playMagicSound();
        
    }, 500);
    
    // 4. 转盘获得魔法光环
    setTimeout(() => {
        if (wheelAura) {
            wheelAura.classList.add('active');
        }
        
        // 创建魔法粒子爆发效果
        createMagicBurst();
        
    }, 1000);
    
    // 5. 动画结束后重置状态
    setTimeout(() => {
        resetMagicAnimation();
    }, 6000);
}

// 重置魔法动画状态
function resetMagicAnimation() {
    const magicWizard = document.querySelector('.magic-wizard');
    const magicWand = document.querySelector('.magic-wand');
    const magicArm = document.querySelector('#magic-arm');
    const magicParticles = document.querySelector('.magic-particles');
    const magicSpell = document.querySelector('.magic-spell');
    const wheelAura = document.querySelector('.wheel-magic-aura');
    
    if (magicWizard) magicWizard.classList.remove('casting');
    if (magicWand) magicWand.classList.remove('waving');
    if (magicArm) magicArm.classList.remove('casting');
    if (magicParticles) magicParticles.classList.remove('active');
    if (wheelAura) wheelAura.classList.remove('active');
    
    if (magicSpell) {
        magicSpell.style.opacity = '0';
        magicSpell.style.transform = 'translateY(0)';
    }
}

// 播放魔法音效
function playMagicSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 创建魔法音效序列
        const frequencies = [440, 554, 659, 880]; // A4, C#5, E5, A5 - 魔法和弦
        
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            }, index * 150);
        });
        
    } catch (e) {
        console.log('Magic audio not supported');
    }
}

// 创建魔法粒子爆发效果
function createMagicBurst() {
    const wheelContainer = document.querySelector('.lottery-wheel-container');
    if (!wheelContainer) return;
    
    // 创建多个魔法粒子
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'magic-burst-particle';
            
            // 随机位置和颜色
            const colors = ['#FFD700', '#FF69B4', '#00FFFF', '#FF6347', '#98FB98'];
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.left = (50 + (Math.random() - 0.5) * 60) + '%';
            particle.style.top = (50 + (Math.random() - 0.5) * 60) + '%';
            
            // 随机运动方向
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 100;
            const endX = Math.cos(angle) * distance;
            const endY = Math.sin(angle) * distance;
            
            particle.style.setProperty('--end-x', endX + 'px');
            particle.style.setProperty('--end-y', endY + 'px');
            
            wheelContainer.appendChild(particle);
            
            // 粒子动画
            setTimeout(() => {
                particle.style.transform = `translate(var(--end-x), var(--end-y)) scale(0)`;
                particle.style.opacity = '0';
            }, 50);
            
            // 清理粒子
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 2000);
            
        }, i * 50);
    }
}

// 创建魔法旋转粒子效果
function createSpinningMagicParticles() {
    const wheelContainer = document.querySelector('.lottery-wheel-container');
    if (!wheelContainer) return;
    
    // 创建围绕转盘旋转的魔法粒子
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'spinning-magic-particle';
            
            // 魔法颜色
            const colors = ['#FFD700', '#FF69B4', '#00FFFF', '#9370DB', '#FF6347'];
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            
            // 设置初始位置（圆形轨道）
            const angle = (i / 20) * Math.PI * 2;
            const radius = 150;
            const x = 50 + Math.cos(angle) * radius / 4; // 转换为百分比
            const y = 50 + Math.sin(angle) * radius / 4;
            
            particle.style.left = x + '%';
            particle.style.top = y + '%';
            particle.style.setProperty('--orbit-angle', angle + 'rad');
            
            wheelContainer.appendChild(particle);
            
            // 清理粒子
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 5000);
            
        }, i * 100);
    }
}

// 创建魔法能量波效果
function createMagicEnergyWave() {
    const wheelContainer = document.querySelector('.lottery-wheel-container');
    if (!wheelContainer) return;
    
    // 创建能量波
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const wave = document.createElement('div');
            wave.className = 'magic-energy-wave';
            
            // 设置波的颜色
            const colors = ['#FFD700', '#FF69B4', '#00FFFF'];
            wave.style.borderColor = colors[i];
            wave.style.left = '50%';
            wave.style.top = '50%';
            wave.style.transform = 'translate(-50%, -50%)';
            
            wheelContainer.appendChild(wave);
            
            // 波动画
            setTimeout(() => {
                wave.style.width = '400px';
                wave.style.height = '400px';
                wave.style.opacity = '0';
            }, 50);
            
            // 清理波
            setTimeout(() => {
                if (wave.parentNode) {
                    wave.parentNode.removeChild(wave);
                }
            }, 1500);
            
        }, i * 300);
    }
}

/**
 * 注意事项:
 * 1. 本代码仅为前端实现，实际使用时需要与后端和区块链进行交互
 * 2. 合约调用部分需要根据实际部署的合约进行调整
 * 3. 抽奖结果应该由合约返回，而不是前端随机生成
 * 4. 用户需要授权合约使用其Xwawa代币
 * 5. 抽奖成本和奖项配置应该从合约中获取
 * 
 * 后端开发人员需要:
 * 1. 部署Lottery合约
 * 2. 确保合约中有正确的draw、drawCost等函数
 * 3. 设置正确的Xwawa代币地址
 * 4. 实现区块链交易监听功能
*/
// ========== 控制台快捷测试 ==========
// 将常用链上操作挂到 window.XwawaTest，便于控制台快速验证
(function setupXwawaTest() {
    if (typeof window === 'undefined') return;

    async function ensureConnected() {
        if (web3 && userAccount) return;
        if (!window.ethereum) {
            throw new Error('未检测到注入钱包，请安装或启用 MetaMask/OKX 等钱包');
        }
        // 请求账户并初始化 web3
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accounts && accounts[0];
        web3 = new Web3(window.ethereum);

        // 初始化合约（优先使用 ContractConfig 配置）
        try {
            const abi = window.ContractConfig && window.ContractConfig.loadLotteryAbi
                ? await window.ContractConfig.loadLotteryAbi()
                : lotteryABI;
            const addr = window.ContractConfig && window.ContractConfig.lotteryAddress
                ? window.ContractConfig.lotteryAddress
                : (lotteryContractAddress || null);
            if (addr) {
                lotteryContract = new web3.eth.Contract(abi, addr);
            } else {
                // 若未配置 Lottery 地址，跳过初始化，允许仅依赖代币交互
                lotteryContract = null;
            }
            isConnected = true;
        } catch (e) {
            console.error('初始化 Lottery 合约失败:', e);
            // 允许在未初始化 Lottery 合约的情况下继续（例如仅测试余额）
            isConnected = !!(web3 && userAccount);
        }
    }

    async function getDrawCost() {
        await ensureConnected();
        const costWei = await lotteryContract.methods.drawCost().call();
        // 以 ether 单位返回（假设代币 18 位小数）
        return web3.utils.fromWei(costWei, 'ether');
    }

    async function getBalance() {
        await ensureConnected();
        const token = await getXwawaContract();
        const balWei = await token.methods.balanceOf(userAccount).call();
        return web3.utils.fromWei(balWei, 'ether');
    }

    async function getPrizePool() {
        await ensureConnected();
        const token = await getXwawaContract();
        const poolWei = await token.methods.balanceOf(lotteryContract.options.address).call();
        return web3.utils.fromWei(poolWei, 'ether');
    }

    async function draw(times = 1) {
        await ensureConnected();
        // 读取成本并检查/自动授权
        const costPerDrawWei = await lotteryContract.methods.drawCost().call();
        const required = web3.utils.toBN(costPerDrawWei).mul(web3.utils.toBN(times));

        const token = await getXwawaContract();
        const spender = lotteryContract.options.address;
        // 查询当前授权额度
        let allowanceWei = '0';
        try {
            allowanceWei = await token.methods.allowance(userAccount, spender).call();
        } catch (e) {
            // 某些代币未实现 allowance 时跳过授权流程
            console.warn('查询 allowance 失败，尝试直接抽奖:', e);
        }

        try {
            if (web3.utils.toBN(allowanceWei).lt(required)) {
                const approveTx = await token.methods.approve(spender, required.toString()).send({ from: userAccount });
                console.log('授权成功:', approveTx.transactionHash || approveTx);
            }
        } catch (e) {
            console.error('授权失败:', e);
            throw e;
        }

        // 执行抽奖交易
        const drawTx = await lotteryContract.methods.draw(times).send({ from: userAccount });
        console.log('抽奖成功:', drawTx.transactionHash || drawTx);
        return drawTx;
    }

    async function getUserDrawHistory(options = { fromBlock: 0, toBlock: 'latest' }) {
        await ensureConnected();
        // 如合约提供视图方法，可在此调用；否则尝试读取事件日志
        if (lotteryContract.methods.getUserDrawHistory) {
            try {
                return await lotteryContract.methods.getUserDrawHistory(userAccount).call();
            } catch (e) {
                console.warn('调用合约历史接口失败，改为读取事件日志:', e);
            }
        }
        try {
            // 如果合约未定义事件，这里可能返回空数组
            const logs = await web3.eth.getPastLogs({
                address: lotteryContract.options.address,
                fromBlock: options.fromBlock ?? 0,
                toBlock: options.toBlock ?? 'latest'
            });
            return logs;
        } catch (e) {
            console.warn('读取历史日志失败:', e);
            return [];
        }
    }

    window.XwawaTest = {
        ensureConnected,
        getDrawCost,
        getBalance,
        getPrizePool,
        draw,
        getUserDrawHistory
    };
})();
