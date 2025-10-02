"use strict";

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
var web3; // Web3实例

var lotteryContract; // 抽奖智能合约实例

var userAccount; // 用户钱包地址

var isConnected = false; // 钱包连接状态

var drawTimes = 1; // 抽奖次数

var drawCost = 10000; // 每次抽奖花费的XWAWA代币数量 (从合约获取)

var isSpinning = false; // 转盘旋转状态锁

/**
 * 奖项配置
 * 定义抽奖奖项的基本信息和概率分布
 * 注意: 实际概率由智能合约控制，此处仅用于前端展示
 */

var prizes = [{
  id: 1,
  name: "一等奖",
  probability: 0.01,
  color: "#FF6B6B",
  className: "first-prize"
}, {
  id: 2,
  name: "二等奖",
  probability: 0.05,
  color: "#4ECDC4",
  className: "second-prize"
}, {
  id: 3,
  name: "三等奖",
  probability: 0.10,
  color: "#FFD166",
  className: "third-prize"
}, {
  id: 4,
  name: "奖池分红",
  probability: 0.15,
  color: "#06D6A0",
  className: "pool-prize"
}, {
  id: 5,
  name: "双倍抽奖",
  probability: 0.20,
  color: "#118AB2",
  className: "double"
}, {
  id: 6,
  name: "谢谢参与",
  probability: 0.49,
  color: "#073B4C",
  className: "nothing"
}];
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

var lotteryABI = [// TODO: 从实际部署的合约中获取完整ABI
// 以下是示例结构，实际使用时需要替换
{
  "inputs": [{
    "internalType": "uint256",
    "name": "_times",
    "type": "uint256"
  }],
  "name": "draw",
  "outputs": [{
    "internalType": "uint8[]",
    "name": "winningType",
    "type": "uint8[]"
  }],
  "stateMutability": "nonpayable",
  "type": "function"
}, {
  "inputs": [],
  "name": "drawCost",
  "outputs": [{
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
  }],
  "stateMutability": "view",
  "type": "function"
} // 更多方法和事件定义...
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

var lotteryContractAddress = "0x1234567890123456789012345678901234567890"; // TODO: 替换为实际部署地址

/**
 * XWAWA代币合约地址
 * 用于代币余额查询和授权操作
 */

var xwawaTokenAddress = "0x0987654321098765432109876543210987654321"; // TODO: 替换为实际代币地址

/**
 * 关闭结果弹窗
 */

function closeResultModal() {
  var modal = document.getElementById('result-modal');

  if (modal) {
    modal.style.display = 'none';
  }
}
/**
 * 页面初始化
 * 在DOM加载完成后执行所有初始化操作
 */


document.addEventListener('DOMContentLoaded', function () {
  // 初始化用户界面状态（现在由WalletManager处理）
  // updateUI();
  // 绑定用户交互事件
  // 注意：钱包连接现在由WalletManager处理
  var drawButton = document.getElementById('draw-button');
  var drawTimesMinusBtn = document.getElementById('draw-times-minus');
  var drawTimesPlusBtn = document.getElementById('draw-times-plus');
  var drawTimesInput = document.getElementById('draw-times-input');
  if (drawButton) drawButton.addEventListener('click', startDraw);
  if (drawTimesMinusBtn) drawTimesMinusBtn.addEventListener('click', function () {
    return updateDrawTimes(-1);
  });
  if (drawTimesPlusBtn) drawTimesPlusBtn.addEventListener('click', function () {
    return updateDrawTimes(1);
  });
  if (drawTimesInput) drawTimesInput.addEventListener('change', validateDrawTimes); // 绑定弹窗关闭事件

  document.querySelectorAll('.close-modal, .close-result-btn').forEach(function (element) {
    element.addEventListener('click', closeResultModal);
  }); // 初始化多语言功能

  initLanguageSwitch(); // 检查是否已连接钱包 (页面刷新后恢复状态)

  checkWalletConnection(); // 初始化钱包管理器

  if (typeof WalletManager !== 'undefined') {
    var walletManager = new WalletManager();
    walletManager.init();
  }
});
/**
 * 初始化语言切换功能
 * 绑定语言切换开关的事件监听器
 */

function initLanguageSwitch() {
  var languageSwitch = document.getElementById('language-switch');

  if (languageSwitch) {
    languageSwitch.addEventListener('change', function () {
      var lang = this.checked ? 'en' : 'zh';
      switchLanguage(lang); // 保存用户语言偏好到本地存储

      localStorage.setItem('preferred-language', lang);
    }); // 恢复用户语言偏好

    var savedLang = localStorage.getItem('preferred-language') || 'zh';
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
  var elements = document.querySelectorAll('[data-lang-zh], [data-lang-en]');
  elements.forEach(function (element) {
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


function checkWalletConnection() {
  var accounts, abi, addr;
  return regeneratorRuntime.async(function checkWalletConnection$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          if (!window.ethereum) {
            _context.next = 27;
            break;
          }

          _context.prev = 1;
          _context.next = 4;
          return regeneratorRuntime.awrap(window.ethereum.request({
            method: 'eth_accounts'
          }));

        case 4:
          accounts = _context.sent;

          if (!(accounts.length > 0)) {
            _context.next = 22;
            break;
          }

          userAccount = accounts[0];
          web3 = new Web3(window.ethereum); // 动态加载ABI与部署地址

          _context.prev = 8;
          _context.next = 11;
          return regeneratorRuntime.awrap(window.ContractConfig.loadLotteryAbi());

        case 11:
          abi = _context.sent;
          addr = window.ContractConfig.lotteryAddress;

          if (!addr) {
            console.error('Lottery合约地址未配置，请在 js/contract-config.js 中填写 lotteryAddress');
          } else {
            lotteryContract = new web3.eth.Contract(abi, addr);
          }

          _context.next = 19;
          break;

        case 16:
          _context.prev = 16;
          _context.t0 = _context["catch"](8);
          console.error('加载Lottery ABI失败:', _context.t0);

        case 19:
          isConnected = true; // updateUI(); // 现在由WalletManager处理
          // 获取最新的抽奖成本

          _context.next = 22;
          return regeneratorRuntime.awrap(updateDrawCostFromContract());

        case 22:
          _context.next = 27;
          break;

        case 24:
          _context.prev = 24;
          _context.t1 = _context["catch"](1);
          console.error("检查钱包连接失败:", _context.t1);

        case 27:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 24], [8, 16]]);
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


function connectWallet() {
  var accounts, abi, addr;
  return regeneratorRuntime.async(function connectWallet$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;

          if (!window.ethereum) {
            _context2.next = 27;
            break;
          }

          console.log("Web3钱包已检测到"); // 请求用户授权连接钱包

          _context2.next = 5;
          return regeneratorRuntime.awrap(window.ethereum.request({
            method: 'eth_requestAccounts'
          }));

        case 5:
          accounts = _context2.sent;
          userAccount = accounts[0]; // 创建Web3实例

          web3 = new Web3(window.ethereum); // 初始化抽奖智能合约实例
          // 动态加载ABI与部署地址

          _context2.prev = 8;
          _context2.next = 11;
          return regeneratorRuntime.awrap(window.ContractConfig.loadLotteryAbi());

        case 11:
          abi = _context2.sent;
          addr = window.ContractConfig.lotteryAddress;

          if (!addr) {
            console.error('Lottery合约地址未配置，请在 js/contract-config.js 中填写 lotteryAddress');
          } else {
            lotteryContract = new web3.eth.Contract(abi, addr);
          }

          _context2.next = 19;
          break;

        case 16:
          _context2.prev = 16;
          _context2.t0 = _context2["catch"](8);
          console.error('加载Lottery ABI失败:', _context2.t0);

        case 19:
          _context2.next = 21;
          return regeneratorRuntime.awrap(updateDrawCostFromContract());

        case 21:
          // 监听账户变化事件
          window.ethereum.on('accountsChanged', handleAccountsChanged); // 监听网络变化事件

          window.ethereum.on('chainChanged', handleChainChanged); // 更新连接状态

          isConnected = true; // 更新用户界面
          // updateUI(); // 现在由WalletManager处理

          console.log("钱包连接成功:", userAccount);
          _context2.next = 29;
          break;

        case 27:
          // 钱包未安装的处理
          alert("请安装MetaMask钱包以使用抽奖功能！");
          window.open("https://metamask.io/download/", "_blank");

        case 29:
          _context2.next = 36;
          break;

        case 31:
          _context2.prev = 31;
          _context2.t1 = _context2["catch"](0);
          console.error("连接钱包失败:", _context2.t1); // 根据错误类型显示不同的提示信息

          if (_context2.t1.code === 4001) {
            alert("用户拒绝了钱包连接请求");
          } else if (_context2.t1.code === -32002) {
            alert("钱包连接请求已在处理中，请检查MetaMask");
          } else {
            alert("连接钱包时发生错误，请重试");
          } // 重置连接状态


          isConnected = false; // updateUI(); // 现在由WalletManager处理

        case 36:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 31], [8, 16]]);
}
/**
 * 从智能合约更新抽奖成本
 * 获取合约中设置的最新抽奖费用
 */


function updateDrawCostFromContract() {
  var contractDrawCost, costElement, _costElement;

  return regeneratorRuntime.async(function updateDrawCostFromContract$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(lotteryContract.methods.drawCost().call());

        case 3:
          contractDrawCost = _context3.sent;
          drawCost = web3.utils.fromWei(contractDrawCost, 'ether');
          console.log("合约抽奖成本:", drawCost); // 更新UI显示

          costElement = document.getElementById('cost-amount');

          if (costElement) {
            costElement.textContent = drawCost;
          } // 更新总费用显示


          updateTotalCost();
          _context3.next = 16;
          break;

        case 11:
          _context3.prev = 11;
          _context3.t0 = _context3["catch"](0);
          console.error("获取抽奖成本失败:", _context3.t0); // 使用默认值，不影响用户体验

          _costElement = document.getElementById('cost-amount');

          if (_costElement) {
            _costElement.textContent = drawCost;
          }

        case 16:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 11]]);
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
  } // updateUI(); // 现在由WalletManager处理

}
/**
 * 处理网络变化事件
 * 当用户在MetaMask中切换网络时触发
 */


function handleChainChanged(chainId) {
  console.log("网络已切换:", chainId); // 重新加载页面以确保应用状态正确

  window.location.reload();
}
/**
 * 更新抽奖次数
 * 通过加减按钮调整抽奖次数
 * @param {number} change - 变化量 (+1 或 -1)
 */


function updateDrawTimes(change) {
  var input = document.getElementById('draw-times-input');
  var newValue = parseInt(input.value) + change; // 确保次数在有效范围内 (1-100次)

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
  var input = document.getElementById('draw-times-input');
  var value = parseInt(input.value); // 确保输入是有效数字且在允许范围内

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
  var totalCost = drawTimes * drawCost;
  var totalCostElement = document.getElementById('total-cost-amount');

  if (totalCostElement) {
    totalCostElement.textContent = totalCost;
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


function startDraw() {
  var drawButton, txReceipt, placeholder;
  return regeneratorRuntime.async(function startDraw$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          if (isConnected) {
            _context4.next = 3;
            break;
          }

          alert('请先连接钱包');
          return _context4.abrupt("return");

        case 3:
          if (!isSpinning) {
            _context4.next = 5;
            break;
          }

          return _context4.abrupt("return");

        case 5:
          // 设置抽奖状态，禁用抽奖按钮
          isSpinning = true;
          drawButton = document.getElementById('draw-button');

          if (drawButton) {
            drawButton.disabled = true;
            drawButton.textContent = '抽奖中...';
          }

          _context4.prev = 8;
          _context4.next = 11;
          return regeneratorRuntime.awrap(drawFromContract(drawTimes));

        case 11:
          txReceipt = _context4.sent;
          startMagicAnimation();
          playSpinSound();
          placeholder = prizes[Math.floor(Math.random() * prizes.length)];
          spinWheel(placeholder.id);
          setTimeout(function () {
            if (placeholder.id <= 4) {
              addWinEffect(placeholder.id);
            }

            showResultModal(placeholder);
            addResultsToList([placeholder]);
            resetDrawState();
          }, 5200);
          _context4.next = 24;
          break;

        case 19:
          _context4.prev = 19;
          _context4.t0 = _context4["catch"](8);
          console.error('抽奖失败:', _context4.t0);
          alert('抽奖失败，请重试');
          resetDrawState();

        case 24:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[8, 19]]);
}
/**
 * 重置抽奖状态
 * 恢复抽奖按钮和相关UI状态
 */


function resetDrawState() {
  isSpinning = false;
  var drawButton = document.getElementById('draw-button');

  if (drawButton) {
    drawButton.disabled = false;
    drawButton.textContent = '开始抽奖';
  }
}
/**
 * 获取用户代币余额
 * 从XWAWA代币合约查询用户余额
 * @returns {Promise<number>} 用户代币余额
 */


function getUserTokenBalance() {
  var xwawaContract, balance;
  return regeneratorRuntime.async(function getUserTokenBalance$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          _context5.next = 3;
          return regeneratorRuntime.awrap(getXwawaContract());

        case 3:
          xwawaContract = _context5.sent;
          _context5.next = 6;
          return regeneratorRuntime.awrap(xwawaContract.methods.balanceOf(userAccount).call());

        case 6:
          balance = _context5.sent;
          return _context5.abrupt("return", parseFloat(web3.utils.fromWei(balance, 'ether')));

        case 10:
          _context5.prev = 10;
          _context5.t0 = _context5["catch"](0);
          console.error("获取用户余额失败:", _context5.t0);
          return _context5.abrupt("return", 0);

        case 14:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 10]]);
}
/**
 * 更新UI状态
 */


function updateUI() {
  var walletStatus = document.getElementById('wallet-status');
  var connectButton = document.getElementById('connect-wallet-btn');
  var drawButton = document.getElementById('draw-button');

  if (isConnected) {
    walletStatus.textContent = "\u5DF2\u8FDE\u63A5: ".concat(shortenAddress(userAccount));
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
  } // 更新抽奖成本和总成本


  document.getElementById('cost-amount').textContent = drawCost;
  updateTotalCost();
}
/**
 * 缩短地址显示
 * @param {string} address - 钱包地址
 * @returns {string} 缩短后的地址
 */


function shortenAddress(address) {
  return "".concat(address.substring(0, 6), "...").concat(address.substring(address.length - 4));
}
/**
 * 模拟抽奖结果生成 (仅用于开发测试)
 * 实际生产环境中，结果应完全由智能合约生成
 * @returns {Array} 抽奖结果数组
 */


function generateMockResults() {
  var results = [];

  for (var i = 0; i < drawTimes; i++) {
    // 随机选择一个奖项 (仅用于前端展示)
    var result = getRandomPrize();
    results.push(result); // 如果是第一次抽奖，旋转转盘

    if (i === 0) {
      spinWheel(result.id);
    }
  } // 添加抽奖结果到结果列表


  addResultsToList(results); // 如果只抽奖一次，显示结果弹窗

  if (drawTimes === 1) {
    setTimeout(function () {
      showResultModal(results[0]);
    }, 5500); // 等待转盘停止后显示
  }

  console.log("抽奖完成，结果:", results);

  try {
    console.error("抽奖失败:", error);
    alert('抽奖失败，请重试');
    isSpinning = false;
    document.getElementById('draw-button').disabled = false;
  } catch (error) {
    console.error("抽奖失败:", error);
    alert('抽奖失败，请重试');
    isSpinning = false;
    document.getElementById('draw-button').disabled = false;
  } // 获取随机奖项


  function getRandomPrize() {
    var random = Math.random();
    var cumulativeProbability = 0;

    for (var _i = 0, _prizes = prizes; _i < _prizes.length; _i++) {
      var prize = _prizes[_i];
      cumulativeProbability += prize.probability;

      if (random <= cumulativeProbability) {
        return prize;
      }
    } // 默认返回最后一个奖项


    return prizes[prizes.length - 1];
  } // 魔法转盘旋转 - 魔法主题优化版本


  function spinWheel(prizeId) {
    var wheel = document.querySelector('.wheel-inner');
    var wheelContainer = document.querySelector('.lottery-wheel-container');
    var pointer = document.querySelector('.wheel-pointer');
    var wheelAura = document.querySelector('.wheel-magic-aura'); // 添加魔法旋转开始的视觉效果

    wheelContainer.classList.add('spinning', 'magic-spinning');
    pointer.classList.add('pointer-active'); // 激活魔法光环

    if (wheelAura) {
      wheelAura.classList.add('spinning-aura');
    } // 计算旋转角度
    // 每个奖项占60度，计算目标奖项的中心角度


    var targetAngle = (prizeId - 1) * 60 + 30; // 添加随机的额外旋转圈数 (8-12圈，更多圈数增加魔法感)

    var extraRotations = (8 + Math.random() * 4) * 360; // 最终旋转角度 = 额外圈数 + (360 - 目标角度)

    var finalRotation = extraRotations + (360 - targetAngle); // 应用魔法旋转动画 - 更长的动画时间和魔法曲线

    wheel.style.transition = 'transform 5s cubic-bezier(0.23, 1, 0.32, 1)';
    wheel.style.transform = "rotate(".concat(finalRotation, "deg)"); // 添加音效和震动效果 (如果支持)

    playSpinSound();
    addVibration(); // 创建魔法旋转粒子效果

    createSpinningMagicParticles(); // 动画过程中的魔法效果

    setTimeout(function () {
      // 中途添加魔法能量爆发
      wheelContainer.classList.add('mid-spin', 'magic-burst');
      createMagicEnergyWave();
    }, 2500); // 动画结束后的处理

    setTimeout(function () {
      isSpinning = false;
      wheelContainer.classList.remove('spinning', 'mid-spin', 'magic-spinning', 'magic-burst');
      pointer.classList.remove('pointer-active');
      wheelContainer.classList.add('spin-complete');

      if (wheelAura) {
        wheelAura.classList.remove('spinning-aura');
      } // 添加获奖效果


      addWinEffect(prizeId);
      document.getElementById('draw-button').disabled = false; // 清除完成状态

      setTimeout(function () {
        wheelContainer.classList.remove('spin-complete');
      }, 1000);
    }, 5000); // 延长到5秒匹配新的动画时间
  } // 播放旋转音效


  function playSpinSound() {
    try {
      // 创建音频上下文来播放简单的音效
      var audioContext = new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = audioContext.createOscillator();
      var gainNode = audioContext.createGain();
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
  } // 添加震动效果


  function addVibration() {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  } // 添加获奖效果


  function addWinEffect(prizeId) {
    var wheelContainer = document.querySelector('.lottery-wheel-container'); // 根据奖项等级添加不同的效果

    if (prizeId <= 3) {
      // 高级奖项：添加闪光效果
      wheelContainer.classList.add('major-win');
      createFireworks();
      setTimeout(function () {
        wheelContainer.classList.remove('major-win');
      }, 3000);
    } else if (prizeId <= 5) {
      // 中级奖项：添加发光效果
      wheelContainer.classList.add('minor-win');
      setTimeout(function () {
        wheelContainer.classList.remove('minor-win');
      }, 2000);
    }
  } // 创建烟花效果


  function createFireworks() {
    var container = document.querySelector('.lottery-wheel-container');

    for (var _i2 = 0; _i2 < 20; _i2++) {
      setTimeout(function () {
        var particle = document.createElement('div');
        particle.className = 'firework-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        container.appendChild(particle);
        setTimeout(function () {
          particle.remove();
        }, 1000);
      }, _i2 * 100);
    }
  } // 添加结果到列表


  function addResultsToList(results) {
    var resultsList = document.querySelector('.results-list');
    var noResults = document.querySelector('.no-results');

    if (noResults) {
      noResults.style.display = 'none';
    }

    results.forEach(function (result) {
      var resultItem = document.createElement('div');
      resultItem.className = "result-item ".concat(result.className);
      resultItem.innerHTML = "\n            <span class=\"result-name\">".concat(result.name, "</span>\n            <span class=\"result-value\">").concat(new Date().toLocaleTimeString(), "</span>\n        ");
      resultsList.prepend(resultItem);
    });
  } // 显示结果弹窗


  function showResultModal(result) {
    var modal = document.getElementById('result-modal');
    var resultTitle = document.getElementById('result-title');
    var resultMessage = document.getElementById('result-message');
    var resultIcon = document.getElementById('result-icon'); // 设置结果信息

    resultTitle.textContent = "\u606D\u559C\u83B7\u5F97: ".concat(result.name);
    resultMessage.textContent = getResultMessage(result.id);
    resultIcon.textContent = getResultIcon(result.id);
    resultIcon.style.color = result.color; // 显示弹窗

    modal.style.display = 'block';
  } // 关闭结果弹窗 - 移除，将在文件顶部重新定义
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
  } // 获取结果图标


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


function drawFromContract(times) {
  var tx;
  return regeneratorRuntime.async(function drawFromContract$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          _context6.next = 3;
          return regeneratorRuntime.awrap(lotteryContract.methods.draw(times).send({
            from: userAccount
          }));

        case 3:
          tx = _context6.sent;
          return _context6.abrupt("return", tx);

        case 7:
          _context6.prev = 7;
          _context6.t0 = _context6["catch"](0);
          console.error("合约抽奖失败:", _context6.t0);
          throw _context6.t0;

        case 11:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[0, 7]]);
} // 获取Xwawa代币合约


function getXwawaContract() {
  var xwawaAddress, xwawaABI;
  return regeneratorRuntime.async(function getXwawaContract$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;
          _context7.next = 3;
          return regeneratorRuntime.awrap(lotteryContract.methods.XWAWA_COIN().call());

        case 3:
          xwawaAddress = _context7.sent;
          // 这里需要Xwawa代币的ABI，这只是一个示例
          xwawaABI = [{
            "constant": true,
            "inputs": [{
              "name": "_owner",
              "type": "address"
            }],
            "name": "balanceOf",
            "outputs": [{
              "name": "balance",
              "type": "uint256"
            }],
            "type": "function"
          }, {
            "constant": false,
            "inputs": [{
              "name": "_spender",
              "type": "address"
            }, {
              "name": "_value",
              "type": "uint256"
            }],
            "name": "approve",
            "outputs": [{
              "name": "",
              "type": "bool"
            }],
            "type": "function"
          }];
          return _context7.abrupt("return", new web3.eth.Contract(xwawaABI, xwawaAddress));

        case 8:
          _context7.prev = 8;
          _context7.t0 = _context7["catch"](0);
          console.error("获取Xwawa合约失败:", _context7.t0);
          throw _context7.t0;

        case 12:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[0, 8]]);
}
/**
 * 魔法师Xwawa动画系统
 * 实现魔法棒挥动、魔法粒子效果和转盘魔法化
 */
// 启动魔法动画序列


function startMagicAnimation() {
  var magicWizard = document.querySelector('.magic-wizard');
  var magicWand = document.querySelector('.magic-wand');
  var magicArm = document.querySelector('#magic-arm');
  var magicParticles = document.querySelector('.magic-particles');
  var magicSpell = document.querySelector('.magic-spell');
  var wheelAura = document.querySelector('.wheel-magic-aura');
  if (!magicWizard) return; // 1. 魔法师准备施法

  magicWizard.classList.add('casting'); // 2. 显示魔法咒语

  if (magicSpell) {
    magicSpell.style.opacity = '1';
    magicSpell.style.transform = 'translateY(-10px)';
  } // 3. 手臂和魔法棒开始挥动


  setTimeout(function () {
    // 手臂挥动动画
    if (magicArm) {
      magicArm.classList.add('casting');
    } // 魔法棒挥动动画


    if (magicWand) {
      magicWand.classList.add('waving');
    } // 激活魔法粒子效果


    if (magicParticles) {
      magicParticles.classList.add('active');
    } // 播放魔法音效


    playMagicSound();
  }, 500); // 4. 转盘获得魔法光环

  setTimeout(function () {
    if (wheelAura) {
      wheelAura.classList.add('active');
    } // 创建魔法粒子爆发效果


    createMagicBurst();
  }, 1000); // 5. 动画结束后重置状态

  setTimeout(function () {
    resetMagicAnimation();
  }, 6000);
} // 重置魔法动画状态


function resetMagicAnimation() {
  var magicWizard = document.querySelector('.magic-wizard');
  var magicWand = document.querySelector('.magic-wand');
  var magicArm = document.querySelector('#magic-arm');
  var magicParticles = document.querySelector('.magic-particles');
  var magicSpell = document.querySelector('.magic-spell');
  var wheelAura = document.querySelector('.wheel-magic-aura');
  if (magicWizard) magicWizard.classList.remove('casting');
  if (magicWand) magicWand.classList.remove('waving');
  if (magicArm) magicArm.classList.remove('casting');
  if (magicParticles) magicParticles.classList.remove('active');
  if (wheelAura) wheelAura.classList.remove('active');

  if (magicSpell) {
    magicSpell.style.opacity = '0';
    magicSpell.style.transform = 'translateY(0)';
  }
} // 播放魔法音效


function playMagicSound() {
  try {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)(); // 创建魔法音效序列

    var frequencies = [440, 554, 659, 880]; // A4, C#5, E5, A5 - 魔法和弦

    frequencies.forEach(function (freq, index) {
      setTimeout(function () {
        var oscillator = audioContext.createOscillator();
        var gainNode = audioContext.createGain();
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
} // 创建魔法粒子爆发效果


function createMagicBurst() {
  var wheelContainer = document.querySelector('.lottery-wheel-container');
  if (!wheelContainer) return; // 创建多个魔法粒子

  for (var i = 0; i < 30; i++) {
    setTimeout(function () {
      var particle = document.createElement('div');
      particle.className = 'magic-burst-particle'; // 随机位置和颜色

      var colors = ['#FFD700', '#FF69B4', '#00FFFF', '#FF6347', '#98FB98'];
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.left = 50 + (Math.random() - 0.5) * 60 + '%';
      particle.style.top = 50 + (Math.random() - 0.5) * 60 + '%'; // 随机运动方向

      var angle = Math.random() * Math.PI * 2;
      var distance = 100 + Math.random() * 100;
      var endX = Math.cos(angle) * distance;
      var endY = Math.sin(angle) * distance;
      particle.style.setProperty('--end-x', endX + 'px');
      particle.style.setProperty('--end-y', endY + 'px');
      wheelContainer.appendChild(particle); // 粒子动画

      setTimeout(function () {
        particle.style.transform = "translate(var(--end-x), var(--end-y)) scale(0)";
        particle.style.opacity = '0';
      }, 50); // 清理粒子

      setTimeout(function () {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 2000);
    }, i * 50);
  }
} // 创建魔法旋转粒子效果


function createSpinningMagicParticles() {
  var wheelContainer = document.querySelector('.lottery-wheel-container');
  if (!wheelContainer) return; // 创建围绕转盘旋转的魔法粒子

  var _loop = function _loop(i) {
    setTimeout(function () {
      var particle = document.createElement('div');
      particle.className = 'spinning-magic-particle'; // 魔法颜色

      var colors = ['#FFD700', '#FF69B4', '#00FFFF', '#9370DB', '#FF6347'];
      particle.style.background = colors[Math.floor(Math.random() * colors.length)]; // 设置初始位置（圆形轨道）

      var angle = i / 20 * Math.PI * 2;
      var radius = 150;
      var x = 50 + Math.cos(angle) * radius / 4; // 转换为百分比

      var y = 50 + Math.sin(angle) * radius / 4;
      particle.style.left = x + '%';
      particle.style.top = y + '%';
      particle.style.setProperty('--orbit-angle', angle + 'rad');
      wheelContainer.appendChild(particle); // 清理粒子

      setTimeout(function () {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 5000);
    }, i * 100);
  };

  for (var i = 0; i < 20; i++) {
    _loop(i);
  }
} // 创建魔法能量波效果


function createMagicEnergyWave() {
  var wheelContainer = document.querySelector('.lottery-wheel-container');
  if (!wheelContainer) return; // 创建能量波

  var _loop2 = function _loop2(i) {
    setTimeout(function () {
      var wave = document.createElement('div');
      wave.className = 'magic-energy-wave'; // 设置波的颜色

      var colors = ['#FFD700', '#FF69B4', '#00FFFF'];
      wave.style.borderColor = colors[i];
      wave.style.left = '50%';
      wave.style.top = '50%';
      wave.style.transform = 'translate(-50%, -50%)';
      wheelContainer.appendChild(wave); // 波动画

      setTimeout(function () {
        wave.style.width = '400px';
        wave.style.height = '400px';
        wave.style.opacity = '0';
      }, 50); // 清理波

      setTimeout(function () {
        if (wave.parentNode) {
          wave.parentNode.removeChild(wave);
        }
      }, 1500);
    }, i * 300);
  };

  for (var i = 0; i < 3; i++) {
    _loop2(i);
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
//# sourceMappingURL=lottery.dev.js.map
