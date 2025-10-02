"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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
  var wallets = {
    metamask: false,
    okx: false,
    tokenpocket: false
  }; // 检测 MetaMask

  if (window.ethereum && window.ethereum.isMetaMask) {
    wallets.metamask = true;
  } // 检测 OKX Wallet


  if (window.okxwallet || window.ethereum && window.ethereum.isOkxWallet) {
    wallets.okx = true;
  } // 检测 TokenPocket


  if (window.tokenpocket || window.ethereum && window.ethereum.isTokenPocket) {
    wallets.tokenpocket = true;
  }

  return wallets;
}
/**
 * 连接指定钱包
 * @param {string} walletType - 钱包类型 ('metamask', 'okx', 'tokenpocket')
 * @returns {Object} Web3实例
 */


function connectWallet(walletType) {
  var provider;
  return regeneratorRuntime.async(function connectWallet$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          provider = null;
          _context.t0 = walletType;
          _context.next = _context.t0 === 'metamask' ? 4 : _context.t0 === 'okx' ? 10 : _context.t0 === 'tokenpocket' ? 20 : 30;
          break;

        case 4:
          if (!(window.ethereum && window.ethereum.isMetaMask)) {
            _context.next = 8;
            break;
          }

          provider = window.ethereum;
          _context.next = 9;
          break;

        case 8:
          throw new Error("MetaMask未安装。请安装MetaMask钱包!");

        case 9:
          return _context.abrupt("break", 31);

        case 10:
          if (!window.okxwallet) {
            _context.next = 14;
            break;
          }

          provider = window.okxwallet;
          _context.next = 19;
          break;

        case 14:
          if (!(window.ethereum && window.ethereum.isOkxWallet)) {
            _context.next = 18;
            break;
          }

          provider = window.ethereum;
          _context.next = 19;
          break;

        case 18:
          throw new Error("OKX钱包未安装。请安装OKX钱包!");

        case 19:
          return _context.abrupt("break", 31);

        case 20:
          if (!window.tokenpocket) {
            _context.next = 24;
            break;
          }

          provider = window.tokenpocket.ethereum;
          _context.next = 29;
          break;

        case 24:
          if (!(window.ethereum && window.ethereum.isTokenPocket)) {
            _context.next = 28;
            break;
          }

          provider = window.ethereum;
          _context.next = 29;
          break;

        case 28:
          throw new Error("TokenPocket未安装。请安装TokenPocket钱包!");

        case 29:
          return _context.abrupt("break", 31);

        case 30:
          throw new Error("不支持的钱包类型");

        case 31:
          _context.prev = 31;
          _context.next = 34;
          return regeneratorRuntime.awrap(provider.request({
            method: 'eth_requestAccounts'
          }));

        case 34:
          return _context.abrupt("return", new Web3(provider));

        case 37:
          _context.prev = 37;
          _context.t1 = _context["catch"](31);
          console.error("".concat(walletType, "\u8FDE\u63A5\u5931\u8D25:"), _context.t1);
          throw new Error("".concat(walletType, "\u8FDE\u63A5\u88AB\u62D2\u7EDD\u6216\u5931\u8D25"));

        case 41:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[31, 37]]);
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


function initWeb3() {
  return regeneratorRuntime.async(function initWeb3$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          if (!window.ethereum) {
            _context2.next = 13;
            break;
          }

          _context2.prev = 1;
          _context2.next = 4;
          return regeneratorRuntime.awrap(window.ethereum.request({
            method: 'eth_requestAccounts'
          }));

        case 4:
          return _context2.abrupt("return", new Web3(window.ethereum));

        case 7:
          _context2.prev = 7;
          _context2.t0 = _context2["catch"](1);
          console.error("用户拒绝了授权请求:", _context2.t0);
          throw new Error("需要钱包授权才能继续");

        case 11:
          _context2.next = 18;
          break;

        case 13:
          if (!window.web3) {
            _context2.next = 17;
            break;
          }

          return _context2.abrupt("return", new Web3(window.web3.currentProvider));

        case 17:
          throw new Error("未检测到以太坊钱包。请安装MetaMask!");

        case 18:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[1, 7]]);
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


function loadAbiFromFile(path) {
  var res;
  return regeneratorRuntime.async(function loadAbiFromFile$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(fetch(path));

        case 3:
          res = _context3.sent;

          if (res.ok) {
            _context3.next = 6;
            break;
          }

          throw new Error("\u52A0\u8F7DABI\u5931\u8D25: ".concat(res.status));

        case 6:
          _context3.next = 8;
          return regeneratorRuntime.awrap(res.json());

        case 8:
          return _context3.abrupt("return", _context3.sent);

        case 11:
          _context3.prev = 11;
          _context3.t0 = _context3["catch"](0);
          console.error("加载ABI失败:", _context3.t0);
          throw _context3.t0;

        case 15:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 11]]);
}
/**
 * 获取当前连接的账户
 * @param {Object} web3 - Web3实例
 * @returns {String} - 当前账户地址
 */


function getCurrentAccount(web3) {
  var accounts;
  return regeneratorRuntime.async(function getCurrentAccount$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.next = 2;
          return regeneratorRuntime.awrap(web3.eth.getAccounts());

        case 2:
          accounts = _context4.sent;
          return _context4.abrupt("return", accounts[0]);

        case 4:
        case "end":
          return _context4.stop();
      }
    }
  });
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


function sendTransaction(web3, tx, from) {
  var payload;
  return regeneratorRuntime.async(function sendTransaction$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          // 兼容空/未定义的交易对象，避免在展开空对象时报错
          payload = _objectSpread({}, tx || {}, {
            from: from
          });
          _context5.next = 3;
          return regeneratorRuntime.awrap(web3.eth.sendTransaction(payload));

        case 3:
          return _context5.abrupt("return", _context5.sent);

        case 4:
        case "end":
          return _context5.stop();
      }
    }
  });
}
/**
 * 调用合约方法（不修改状态）
 * @param {Object} contract - 合约实例
 * @param {String} method - 方法名
 * @param {Array} params - 参数数组
 * @returns {Any} - 调用结果
 */


function callContractMethod(contract, method) {
  var _contract$methods;

  var params,
      _args6 = arguments;
  return regeneratorRuntime.async(function callContractMethod$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          params = _args6.length > 2 && _args6[2] !== undefined ? _args6[2] : [];
          _context6.next = 3;
          return regeneratorRuntime.awrap((_contract$methods = contract.methods)[method].apply(_contract$methods, _toConsumableArray(params)).call());

        case 3:
          return _context6.abrupt("return", _context6.sent);

        case 4:
        case "end":
          return _context6.stop();
      }
    }
  });
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


function sendContractTransaction(contract, method) {
  var _contract$methods2;

  var params,
      from,
      value,
      _args7 = arguments;
  return regeneratorRuntime.async(function sendContractTransaction$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          params = _args7.length > 2 && _args7[2] !== undefined ? _args7[2] : [];
          from = _args7.length > 3 ? _args7[3] : undefined;
          value = _args7.length > 4 && _args7[4] !== undefined ? _args7[4] : 0;
          _context7.next = 5;
          return regeneratorRuntime.awrap((_contract$methods2 = contract.methods)[method].apply(_contract$methods2, _toConsumableArray(params)).send({
            from: from,
            value: value
          }));

        case 5:
          return _context7.abrupt("return", _context7.sent);

        case 6:
        case "end":
          return _context7.stop();
      }
    }
  });
}
/**
 * 获取代币余额
 * @param {Object} tokenContract - 代币合约实例
 * @param {String} address - 查询地址
 * @returns {String} - 余额（原始值，需要根据小数位进行转换）
 */


function getTokenBalance(tokenContract, address) {
  return regeneratorRuntime.async(function getTokenBalance$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          _context8.next = 2;
          return regeneratorRuntime.awrap(tokenContract.methods.balanceOf(address).call());

        case 2:
          return _context8.abrupt("return", _context8.sent);

        case 3:
        case "end":
          return _context8.stop();
      }
    }
  });
}
/**
 * 授权代币使用
 * @param {Object} tokenContract - 代币合约实例
 * @param {String} spender - 被授权的地址
 * @param {String} amount - 授权金额
 * @param {String} from - 授权方地址
 * @returns {Object} - 交易收据
 */


function approveToken(tokenContract, spender, amount, from) {
  return regeneratorRuntime.async(function approveToken$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          _context9.next = 2;
          return regeneratorRuntime.awrap(tokenContract.methods.approve(spender, amount).send({
            from: from
          }));

        case 2:
          return _context9.abrupt("return", _context9.sent);

        case 3:
        case "end":
          return _context9.stop();
      }
    }
  });
} // 导出函数
// 将函数导出到全局作用域


window.detectWallets = detectWallets;
window.connectWallet = connectWallet;
window.Web3Connector = {
  initWeb3: initWeb3,
  loadContract: loadContract,
  loadAbiFromFile: loadAbiFromFile,
  getCurrentAccount: getCurrentAccount,
  listenForAccountChanges: listenForAccountChanges,
  listenForNetworkChanges: listenForNetworkChanges,
  sendTransaction: sendTransaction,
  callContractMethod: callContractMethod,
  sendContractTransaction: sendContractTransaction,
  getTokenBalance: getTokenBalance,
  approveToken: approveToken,
  detectWallets: detectWallets,
  connectWallet: connectWallet
}; // Lottery ABI JSON字符串
// 注意: 在实际生产环境中，这个变量应该从Lottery.abi文件中读取
// 这里为了演示，直接硬编码一个示例ABI

var lotteryAbiJson = "[\n    {\n        \"inputs\": [\n            {\n                \"internalType\": \"address\",\n                \"name\": \"_xwawaCoin\",\n                \"type\": \"address\"\n            },\n            {\n                \"internalType\": \"address\",\n                \"name\": \"_communityTreasury\",\n                \"type\": \"address\"\n            }\n        ],\n        \"stateMutability\": \"nonpayable\",\n        \"type\": \"constructor\"\n    },\n    {\n        \"inputs\": [],\n        \"name\": \"XWAWA_COIN\",\n        \"outputs\": [\n            {\n                \"internalType\": \"contract IERC20\",\n                \"name\": \"\",\n                \"type\": \"address\"\n            }\n        ],\n        \"stateMutability\": \"view\",\n        \"type\": \"function\"\n    },\n    {\n        \"inputs\": [],\n        \"name\": \"communityTreasury\",\n        \"outputs\": [\n            {\n                \"internalType\": \"address\",\n                \"name\": \"\",\n                \"type\": \"address\"\n            }\n        ],\n        \"stateMutability\": \"view\",\n        \"type\": \"function\"\n    },\n    {\n        \"inputs\": [],\n        \"name\": \"draw\",\n        \"outputs\": [\n            {\n                \"internalType\": \"uint256\",\n                \"name\": \"\",\n                \"type\": \"uint256\"\n            }\n        ],\n        \"stateMutability\": \"nonpayable\",\n        \"type\": \"function\"\n    },\n    {\n        \"inputs\": [],\n        \"name\": \"drawCost\",\n        \"outputs\": [\n            {\n                \"internalType\": \"uint256\",\n                \"name\": \"\",\n                \"type\": \"uint256\"\n            }\n        ],\n        \"stateMutability\": \"view\",\n        \"type\": \"function\"\n    }\n]"; // 注释说明：
// 1. 此文件提供了与区块链交互的基本功能
// 2. 实际使用时需要根据项目需求进行调整
// 3. 合约ABI应该从Lottery.abi文件中读取
// 4. 后端开发人员需要确保合约地址正确配置
// 5. 所有与区块链的交互都应该通过此文件提供的函数进行
//# sourceMappingURL=web3-connector.dev.js.map
