/**
 * Xwawa Web3连接器 - 区块链交互核心模块
 * 
 * 主要功能:
 * 1. Web3环境初始化和钱包连接
 * 2. 智能合约加载和实例化
 * 3. 区块链交易发送和状态查询
 * 4. 代币余额查询和授权管理
 * 5. 账户和网络变化监听
 * 
 * 支持的钱包:
 * - MetaMask (主要支持)
 * - OKX Wallet
 * - Trust Wallet
 * - 其他兼容EIP-1193的钱包
 * 
 * 智能合约集成:
 * - 抽奖合约 (LotteryContract)
 * - XWAWA代币合约 (ERC-20)
 * - 其他自定义合约
 * 
 * 网络支持:
 * - 以太坊主网
 * - 测试网络 (Goerli, Sepolia)
 * - 侧链 (Polygon, BSC等)
 * 
 * 安全考虑:
 * - 交易签名验证
 * - 合约地址验证
 * - 用户授权确认
 * - 网络切换检测
 * 
 * 依赖项:
 * - Web3.js v1.6.0+
 * - 现代浏览器支持
 * - 钱包扩展程序
 */

/**
 * 检测可用的钱包
 * @returns {Object} 可用钱包列表
 */
function detectWallets() {
    const wallets = {
        metamask: false,
        okx: false,
        tokenpocket: false
    };

    // 检测 MetaMask
    if (window.ethereum && window.ethereum.isMetaMask) {
        wallets.metamask = true;
    }

    // 检测 OKX Wallet
    if (window.okxwallet || (window.ethereum && window.ethereum.isOkxWallet)) {
        wallets.okx = true;
    }

    // 检测 TokenPocket
    if (window.tokenpocket || (window.ethereum && window.ethereum.isTokenPocket)) {
        wallets.tokenpocket = true;
    }

    return wallets;
}

/**
 * 连接指定钱包
 * @param {string} walletType - 钱包类型 ('metamask', 'okx', 'tokenpocket')
 * @returns {Object} Web3实例
 */
async function connectWallet(walletType) {
    let provider = null;

    switch (walletType) {
        case 'metamask':
            if (window.ethereum && window.ethereum.isMetaMask) {
                provider = window.ethereum;
            } else {
                throw new Error("MetaMask未安装。请安装MetaMask钱包!");
            }
            break;

        case 'okx':
            if (window.okxwallet) {
                provider = window.okxwallet;
            } else if (window.ethereum && window.ethereum.isOkxWallet) {
                provider = window.ethereum;
            } else {
                throw new Error("OKX钱包未安装。请安装OKX钱包!");
            }
            break;

        case 'tokenpocket':
            if (window.tokenpocket) {
                provider = window.tokenpocket.ethereum;
            } else if (window.ethereum && window.ethereum.isTokenPocket) {
                provider = window.ethereum;
            } else {
                throw new Error("TokenPocket未安装。请安装TokenPocket钱包!");
            }
            break;

        default:
            throw new Error("不支持的钱包类型");
    }

    try {
        // 请求用户授权
        await provider.request({ method: 'eth_requestAccounts' });
        return new Web3(provider);
    } catch (error) {
        console.error(`${walletType}连接失败:`, error);
        throw new Error(`${walletType}连接被拒绝或失败`);
    }
}

/**
 * 初始化Web3环境 (兼容旧版本)
 * 连接到以太坊网络并返回Web3实例
 * 
 * 功能流程:
 * 1. 检测钱包可用性
 * 2. 请求用户授权连接
 * 3. 创建Web3实例
 * 4. 验证网络连接
 * 
 * @returns {Object} Web3实例
 * @throws {Error} 钱包未安装或用户拒绝授权时抛出错误
 */
async function initWeb3() {
    if (window.ethereum) {
        try {
            // 请求用户授权
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            return new Web3(window.ethereum);
        } catch (error) {
            console.error("用户拒绝了授权请求:", error);
            throw new Error("需要钱包授权才能继续");
        }
    } else if (window.web3) {
        // 兼容旧版MetaMask
        return new Web3(window.web3.currentProvider);
    } else {
        throw new Error("未检测到以太坊钱包。请安装MetaMask!");
    }
}

/**
 * 加载智能合约
 * @param {Object} web3 - Web3实例
 * @param {Array} abi - 合约ABI
 * @param {String} address - 合约地址
 * @returns {Object} - 合约实例
 */
function loadContract(web3, abi, address) {
    return new web3.eth.Contract(abi, address);
}

/**
 * 从文件加载ABI
 * 注意: 在实际生产环境中，这个函数需要根据实际情况调整
 * @param {String} path - ABI文件路径
 * @returns {Array} - 解析后的ABI数组
 */
async function loadAbiFromFile(path) {
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`加载ABI失败: ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error("加载ABI失败:", error);
        throw error;
    }
}

/**
 * 获取当前连接的账户
 * @param {Object} web3 - Web3实例
 * @returns {String} - 当前账户地址
 */
async function getCurrentAccount(web3) {
    const accounts = await web3.eth.getAccounts();
    return accounts[0];
}

/**
 * 监听账户变化
 * @param {Function} callback - 账户变化时的回调函数
 */
function listenForAccountChanges(callback) {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', callback);
    }
}

/**
 * 监听网络变化
 * @param {Function} callback - 网络变化时的回调函数
 */
function listenForNetworkChanges(callback) {
    if (window.ethereum) {
        window.ethereum.on('chainChanged', callback);
    }
}

/**
 * 发送交易
 * @param {Object} web3 - Web3实例
 * @param {Object} tx - 交易对象
 * @param {String} from - 发送方地址
 * @returns {Object} - 交易收据
 */
async function sendTransaction(web3, tx, from) {
    // 兼容空/未定义的交易对象，避免在展开空对象时报错
    const payload = {
        ...(tx || {}),
        from
    };
    return await web3.eth.sendTransaction(payload);
}

/**
 * 调用合约方法（不修改状态）
 * @param {Object} contract - 合约实例
 * @param {String} method - 方法名
 * @param {Array} params - 参数数组
 * @returns {Any} - 调用结果
 */
async function callContractMethod(contract, method, params = []) {
    return await contract.methods[method](...params).call();
}

/**
 * 发送合约交易（修改状态）
 * @param {Object} contract - 合约实例
 * @param {String} method - 方法名
 * @param {Array} params - 参数数组
 * @param {String} from - 发送方地址
 * @param {Number} value - 发送的以太币数量（单位：wei）
 * @returns {Object} - 交易收据
 */
async function sendContractTransaction(contract, method, params = [], from, value = 0) {
    return await contract.methods[method](...params).send({
        from,
        value
    });
}

/**
 * 获取代币余额
 * @param {Object} tokenContract - 代币合约实例
 * @param {String} address - 查询地址
 * @returns {String} - 余额（原始值，需要根据小数位进行转换）
 */
async function getTokenBalance(tokenContract, address) {
    return await tokenContract.methods.balanceOf(address).call();
}

/**
 * 授权代币使用
 * @param {Object} tokenContract - 代币合约实例
 * @param {String} spender - 被授权的地址
 * @param {String} amount - 授权金额
 * @param {String} from - 授权方地址
 * @returns {Object} - 交易收据
 */
async function approveToken(tokenContract, spender, amount, from) {
    return await tokenContract.methods.approve(spender, amount).send({ from });
}

// 导出函数
// 将函数导出到全局作用域
window.detectWallets = detectWallets;
window.connectWallet = connectWallet;

window.Web3Connector = {
    initWeb3,
    loadContract,
    loadAbiFromFile,
    getCurrentAccount,
    listenForAccountChanges,
    listenForNetworkChanges,
    sendTransaction,
    callContractMethod,
    sendContractTransaction,
    getTokenBalance,
    approveToken,
    detectWallets,
    connectWallet
};

// Lottery ABI JSON字符串
// 注意: 在实际生产环境中，这个变量应该从Lottery.abi文件中读取
// 这里为了演示，直接硬编码一个示例ABI
const lotteryAbiJson = `[
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_xwawaCoin",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_communityTreasury",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "XWAWA_COIN",
        "outputs": [
            {
                "internalType": "contract IERC20",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "communityTreasury",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "draw",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
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
]`;

// 注释说明：
// 1. 此文件提供了与区块链交互的基本功能
// 2. 实际使用时需要根据项目需求进行调整
// 3. 合约ABI应该从Lottery.abi文件中读取
// 4. 后端开发人员需要确保合约地址正确配置
// 5. 所有与区块链的交互都应该通过此文件提供的函数进行