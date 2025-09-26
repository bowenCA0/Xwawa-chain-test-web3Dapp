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
 * 奖项配置
 * 定义抽奖奖项的基本信息和概率分布
 * 注意: 实际概率由智能合约控制，此处仅用于前端展示
 */
const prizes = [
    { id: 1, name: "一等奖", probability: 0.01, color: "#FF6B6B", className: "first-prize" },
    { id: 2, name: "二等奖", probability: 0.05, color: "#4ECDC4", className: "second-prize" },
    { id: 3, name: "三等奖", probability: 0.10, color: "#FFD166", className: "third-prize" },
    { id: 4, name: "奖池分红", probability: 0.15, color: "#06D6A0", className: "pool-prize" },
    { id: 5, name: "双倍抽奖", probability: 0.20, color: "#118AB2", className: "double" },
    { id: 6, name: "谢谢参与", probability: 0.49, color: "#073B4C", className: "nothing" }
];

/**
 * 智能合约 ABI 加载（从项目根目录的 Lottery.abi 动态获取）
 */
let lotteryABI = null;
async function loadLotteryAbi() {
    if (lotteryABI) return lotteryABI;
    const res = await fetch('Lottery.abi', { cache: 'no-cache' });
    lotteryABI = await res.json();
    return lotteryABI;
}

// 最小 ERC-20 ABI（余额与授权）
const erc20ABI = [
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
    { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "type": "function" },
    { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "type": "function" }
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
const lotteryContractAddress = "0x1234567890123456789012345678901234567890"; // TODO: 替换为实际部署地址

/**
 * XWAWA代币合约地址
 * 用于代币余额查询和授权操作
 */
const xwawaTokenAddress = "0x0987654321098765432109876543210987654321"; // TODO: 替换为实际代币地址

/**
 * 页面初始化
 * 在DOM加载完成后执行所有初始化操作
 */
document.addEventListener('DOMContentLoaded', function() {
    // 初始化用户界面状态
    updateUI();
    
    // 绑定用户交互事件
    document.getElementById('connect-wallet-btn').addEventListener('click', connectWallet);
    document.getElementById('draw-button').addEventListener('click', startDraw);
    document.getElementById('draw-times-minus').addEventListener('click', () => updateDrawTimes(-1));
    document.getElementById('draw-times-plus').addEventListener('click', () => updateDrawTimes(1));
    document.getElementById('draw-times-input').addEventListener('change', validateDrawTimes);
    
    // 绑定弹窗关闭事件
    document.querySelectorAll('.close-modal, .close-result-btn').forEach(element => {
        element.addEventListener('click', closeResultModal);
    });
    
    // 检查是否已连接钱包 (页面刷新后恢复状态)
    checkWalletConnection();
});

/**
 * 初始化语言切换功能
 * 绑定语言切换开关的事件监听器
 */
function initLanguageSwitch() {
    const languageSwitch = document.getElementById('language-switch');
    if (languageSwitch) {
        languageSwitch.addEventListener('change', function() {
            const lang = this.checked ? 'en' : 'zh';
            switchLanguage(lang);
            // 保存用户语言偏好到本地存储
            localStorage.setItem('preferred-language', lang);
        });
        
        // 恢复用户语言偏好
        const savedLang = localStorage.getItem('preferred-language') || 'zh';
        languageSwitch.checked = savedLang === 'en';
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
                element.textContent = element.getAttribute('data-lang-zh');
            }
        } else {
            if (element.hasAttribute('data-lang-en')) {
                element.textContent = element.getAttribute('data-lang-en');
            }
        }
    });
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
                await loadLotteryAbi();
                lotteryContract = new web3.eth.Contract(lotteryABI, lotteryContractAddress);
                isConnected = true;
                updateUI();
                
                // 获取最新的抽奖成本
                await updateDrawCostFromContract();
            }
        } catch (error) {
            console.error("检查钱包连接失败:", error);
        }
    }
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
            await loadLotteryAbi();
            lotteryContract = new web3.eth.Contract(lotteryABI, lotteryContractAddress);
            
            // 从智能合约获取最新的抽奖成本
            await updateDrawCostFromContract();
            
            // 监听账户变化事件
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            
            // 监听网络变化事件
            window.ethereum.on('chainChanged', handleChainChanged);
            
            // 更新连接状态
            isConnected = true;
            
            // 更新用户界面
            updateUI();
            
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
        updateUI();
    }
}

/**
 * 从智能合约更新抽奖成本
 * 获取合约中设置的最新抽奖费用
 */
async function updateDrawCostFromContract() {
    try {
        const contractDrawCost = await lotteryContract.methods.drawCost().call();
        // 合约以 18 位精度计价
        drawCost = parseFloat(web3.utils.fromWei(contractDrawCost, 'ether'));
        console.log("合约抽奖成本:", drawCost);
        
        // 更新UI显示
        const costElement = document.getElementById('cost-amount');
        if (costElement) {
            costElement.textContent = `${drawCost} XWAWA`;
        }
        
        // 更新总费用显示
        updateTotalCost();
        
    } catch (error) {
        console.error("获取抽奖成本失败:", error);
        // 使用默认值，不影响用户体验
        const costElement = document.getElementById('cost-amount');
        if (costElement) {
            costElement.textContent = `${drawCost} XWAWA`;
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
    updateUI();
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
        totalCostElement.textContent = `${totalCost} XWAWA`;
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
    // 检查钱包连接状态
    if (!isConnected) {
        alert('请先连接钱包');
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
        drawButton.textContent = '抽奖中...';
    }
    
    try {
        // 检查用户代币余额
        const totalCost = drawTimes * drawCost;
        const userBalance = await getUserTokenBalance();
        
        if (userBalance < totalCost) {
            alert(`余额不足！需要 ${totalCost} XWAWA，当前余额 ${userBalance} XWAWA`);
            return;
        }
        
        // 调用智能合约执行抽奖
        const prizeIds = await drawFromContract();
        if (!prizeIds || prizeIds.length === 0) throw new Error('未获取到抽奖结果');

        // 播放抽奖音效
        playSpinSound();

        // 将链上结果映射为前端奖项结构
        const results = prizeIds.map(mapWinningTypeToPrize);

        // 执行转盘动画（以第一个结果定位）
        spinWheel(results[0].id);

        // 动画结束后展示
        setTimeout(() => {
            if (results[0].id <= 4) addWinEffect(results[0].id);
            showResultModal(results[0]);
            addResultsToList(results);
            resetDrawState();
        }, 3000);
        
    } catch (error) {
        console.error("抽奖失败:", error);
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
        drawButton.textContent = '转动转盘';
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
 * 模拟抽奖结果生成 (仅用于开发测试)
 * 实际生产环境中，结果应完全由智能合约生成
 * @returns {Array} 抽奖结果数组
 */
function generateMockResults() {
    const results = [];
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

    // 获取随机奖项
    function getRandomPrize() {
        const random = Math.random();
        let cumulativeProbability = 0;
    
        for (const prize of prizes) {
            cumulativeProbability += prize.probability;
            if (random <= cumulativeProbability) {
                return prize;
            }
        }
    
        // 默认返回最后一个奖项
        return prizes[prizes.length - 1];
    }

    // 旋转转盘 - Web3风格优化版本
    function spinWheel(prizeId) {
        const wheel = document.querySelector('.wheel-inner');
        const wheelContainer = document.querySelector('.lottery-wheel-container');
        const pointer = document.querySelector('.wheel-pointer');
    
        // 添加旋转开始的视觉效果
        wheelContainer.classList.add('spinning');
        pointer.classList.add('pointer-active');
    
        // 计算旋转角度
        // 每个奖项占60度，计算目标奖项的中心角度
        const targetAngle = (prizeId - 1) * 60 + 30;
    
        // 添加随机的额外旋转圈数 (6-8圈)
        const extraRotations = (6 + Math.random() * 2) * 360;
    
        // 最终旋转角度 = 额外圈数 + (360 - 目标角度)
        const finalRotation = extraRotations + (360 - targetAngle);
    
        // 应用高级旋转动画
        wheel.style.transition = 'transform 4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        wheel.style.transform = `rotate(${finalRotation}deg)`;
    
        // 添加音效和震动效果 (如果支持)
        playSpinSound();
        addVibration();
    
        // 动画过程中的中间效果
        setTimeout(() => {
            // 中途添加一些视觉反馈
            wheelContainer.classList.add('mid-spin');
        }, 2000);
    
        // 动画结束后的处理
        setTimeout(() => {
            isSpinning = false;
            wheelContainer.classList.remove('spinning', 'mid-spin');
            pointer.classList.remove('pointer-active');
            wheelContainer.classList.add('spin-complete');
        
            // 添加获奖效果
            addWinEffect(prizeId);
        
            document.getElementById('draw-button').disabled = false;
        
            // 清除完成状态
            setTimeout(() => {
                wheelContainer.classList.remove('spin-complete');
            }, 1000);
        }, 4000);
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
    
        // 根据奖项等级添加不同的效果
        if (prizeId <= 3) {
            // 高级奖项：添加闪光效果
            wheelContainer.classList.add('major-win');
            createFireworks();
            setTimeout(() => {
                wheelContainer.classList.remove('major-win');
            }, 3000);
        } else if (prizeId <= 5) {
            // 中级奖项：添加发光效果
            wheelContainer.classList.add('minor-win');
            setTimeout(() => {
                wheelContainer.classList.remove('minor-win');
            }, 2000);
        }
    }

    // 创建烟花效果
    function createFireworks() {
        const container = document.querySelector('.lottery-wheel-container');
    
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'firework-particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                container.appendChild(particle);
            
                setTimeout(() => {
                    particle.remove();
                }, 1000);
            }, i * 100);
        }
    }

    // 添加结果到列表
    function addResultsToList(results) {
        const resultsList = document.querySelector('.results-list');
        const noResults = document.querySelector('.no-results');
    
        if (noResults) {
            noResults.style.display = 'none';
        }
    
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${result.className}`;
        
            resultItem.innerHTML = `
            <span class="result-name">${result.name}</span>
            <span class="result-value">${new Date().toLocaleTimeString()}</span>
        `;
        
            resultsList.prepend(resultItem);
        });
    }

    // 显示结果弹窗
    function showResultModal(result) {
        const modal = document.getElementById('result-modal');
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');
        const resultIcon = document.getElementById('result-icon');
    
        // 设置结果信息
        resultTitle.textContent = `恭喜获得: ${result.name}`;
        resultMessage.textContent = getResultMessage(result.id);
        resultIcon.textContent = getResultIcon(result.id);
        resultIcon.style.color = result.color;
    
        // 显示弹窗
        modal.style.display = 'block';
    }

    // 关闭结果弹窗
    function closeResultModal() {
        const modal = document.getElementById('result-modal');
        modal.style.display = 'none';
    }

    // 获取结果消息
    function getResultMessage(prizeId) {
        switch (prizeId) {
            case 1:
                return "恭喜您获得一等奖！奖励已发放到您的账户。";
            case 2:
                return "恭喜您获得二等奖！奖励已发放到您的账户。";
            case 3:
                return "恭喜您获得三等奖！奖励已发放到您的账户。";
            case 4:
                return "您获得了奖池分红！奖励已发放到您的账户。";
            case 5:
                return "您获得了双倍抽奖机会！下次抽奖将获得双倍奖励。";
            case 6:
                return "谢谢参与，下次再接再厉！";
            default:
                return "抽奖结果未知，请联系客服。";
        }
    }

    // 获取结果图标
    function getResultIcon(prizeId) {
        switch (prizeId) {
            case 1:
                return "🏆";
            case 2:
                return "🥈";
            case 3:
                return "🥉";
            case 4:
                return "💰";
            case 5:
                return "🎯";
            case 6:
                return "😊";
            default:
                return "❓";
        }
    }

    // 更新UI
    function updateUI() {
        const walletStatus = document.getElementById('wallet-status');
        const connectButton = document.getElementById('connect-wallet-btn');
        const drawButton = document.getElementById('draw-button');
    
        if (isConnected) {
            walletStatus.textContent = `已连接: ${shortenAddress(userAccount)}`;
            walletStatus.className = 'connected';
            connectButton.textContent = '已连接';
            connectButton.disabled = true;
            drawButton.disabled = false;
        } else {
            walletStatus.textContent = '未连接钱包';
            walletStatus.className = 'not-connected';
            connectButton.textContent = '连接钱包';
            connectButton.disabled = false;
            drawButton.disabled = true;
        }
    
        // 更新抽奖成本和总成本
        document.getElementById('cost-amount').textContent = `${drawCost} XWAWA`;
        updateTotalCost();
    }

    // 缩短地址显示
    function shortenAddress(address) {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
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

    // 实际调用合约的 draw(times) 函数，返回链上 winningType 数组（uint8[]）
    async function drawFromContract() {
        try {
            const xwawaContract = await getXwawaContract();
            const requiredAmount = web3.utils.toWei((drawCost * drawTimes).toString(), 'ether');

            // 余额校验
            const balance = await xwawaContract.methods.balanceOf(userAccount).call();
            if (web3.utils.toBN(balance).lt(web3.utils.toBN(requiredAmount))) {
                alert('Xwawa代币余额不足，请充值后再试');
                return null;
            }

            // 代币授权
            await xwawaContract.methods.approve(lotteryContractAddress, requiredAmount).send({ from: userAccount });

            // 发起抽奖交易（合约签名：draw(uint256 _times)）
            const receipt = await lotteryContract.methods.draw(web3.utils.toBN(drawTimes)).send({ from: userAccount });

            // 解析事件 Draw -> winningType: uint8[]
            const drawEvent = receipt?.events?.Draw;
            const winningType = drawEvent?.returnValues?.winningType;
            if (Array.isArray(winningType)) return winningType.map(x => parseInt(x));

            // 兼容性处理：若事件未解析，尝试读取最近区块事件
            const latest = await lotteryContract.getPastEvents('Draw', { fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber });
            const last = latest && latest.length ? latest[latest.length - 1] : null;
            const types = last?.returnValues?.winningType;
            if (Array.isArray(types)) return types.map(x => parseInt(x));

            return [];
        } catch (error) {
            console.error("合约抽奖失败:", error);
            throw error;
        }
    }

    // 获取Xwawa代币合约
    async function getXwawaContract() {
        try {
            const xwawaAddress = await lotteryContract.methods.XWAWA_COIN().call();
            return new web3.eth.Contract(erc20ABI, xwawaAddress);
        } catch (error) {
            console.error("获取Xwawa合约失败:", error);
            throw error;
        }
    }

    // 将链上枚举值映射为前端 prize 结构
    function mapWinningTypeToPrize(typeIndex) {
        // 约定顺序：0-一等奖,1-二等奖,2-三等奖,3-奖池分红,4-双倍,5-谢谢参与
        const mapping = [1, 2, 3, 4, 5, 6];
        const id = mapping[typeIndex] || 6;
        return prizes.find(p => p.id === id) || prizes[prizes.length - 1];
    }

    // 读取奖池余额（以代币余额表示）：读取 XWAWA_COIN 在抽奖合约地址上的余额
    async function getPrizePoolAmount() {
        try {
            const token = await getXwawaContract();
            const bal = await token.methods.balanceOf(lotteryContractAddress).call();
            return parseFloat(web3.utils.fromWei(bal, 'ether'));
        } catch (e) {
            console.error('获取奖池余额失败:', e);
            return 0;
        }
    }

    // 获取用户抽奖历史：基于合约 Draw 事件（player 为 indexed）查询
    async function getUserDrawHistory(options = {}) {
        const { fromBlock = 0, toBlock = 'latest' } = options;
        try {
            const events = await lotteryContract.getPastEvents('Draw', {
                filter: { player: userAccount },
                fromBlock,
                toBlock
            });
            return events.map(ev => {
                const types = (ev.returnValues?.winningType || []).map(x => parseInt(x));
                return {
                    blockNumber: ev.blockNumber,
                    txHash: ev.transactionHash,
                    prizeIds: types.map(mapWinningTypeToPrize).map(p => p.id),
                    prizes: types.map(mapWinningTypeToPrize).map(p => ({ id: p.id, name: p.name }))
                };
            });
        } catch (e) {
            console.error('获取抽奖历史失败:', e);
            return [];
        }
    }

    // 暴露测试方法到全局，便于控制台快速验证
    window.XwawaTest = {
        getDrawCost: async () => parseFloat(web3.utils.fromWei(await lotteryContract.methods.drawCost().call(), 'ether')),
        draw: async (times = 1) => {
            drawTimes = times;
            return await drawFromContract();
        },
        getBalance: getUserTokenBalance,
        getPrizePool: getPrizePoolAmount,
        getUserDrawHistory
    };

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
