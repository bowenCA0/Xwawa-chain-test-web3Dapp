# Xwawa 智能合约部署与配置文档

## 概述

本文档详细说明了 Xwawa 平台智能合约的部署流程、配置方法和管理指南。项目包含两个主要合约：抽奖合约（LotteryContract）和 XWAWA 代币合约（XwawaToken）。

## 合约架构

### 1. XWAWA 代币合约 (XwawaToken.sol)

**合约类型**: ERC-20 标准代币合约

**主要功能**:
- 标准 ERC-20 代币功能
- 铸造和销毁机制
- 权限管理
- 转账手续费设置

**合约接口**:
```solidity
interface IXwawaToken {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    // 扩展功能
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function setTransferFee(uint256 fee) external;
}
```

### 2. 抽奖合约 (LotteryContract.sol)

**合约类型**: 抽奖逻辑合约

**主要功能**:
- 可证明公平的抽奖机制
- 奖池管理
- 随机数生成
- 奖励分发
- 历史记录

**合约接口**:
```solidity
interface ILotteryContract {
    function draw() external returns (uint256);
    function drawCost() external view returns (uint256);
    function getPrizePool() external view returns (uint256);
    function getUserDrawHistory(address user) external view returns (DrawRecord[] memory);
    function setPrizeConfiguration(uint256[] memory prizeIds, uint256[] memory probabilities) external;
    function withdrawPrizePool(uint256 amount) external;
    
    // 事件
    event DrawResult(address indexed user, uint256 indexed prizeId, uint256 amount, uint256 timestamp);
    event PrizeAwarded(address indexed user, uint256 prizeId, uint256 amount);
    event PoolUpdated(uint256 newBalance, uint256 timestamp);
}
```

## 部署环境准备

### 1. 开发环境设置

**必需工具**:
```bash
# 安装 Node.js 和 npm
node --version  # v16.0.0+
npm --version   # v8.0.0+

# 安装 Hardhat 开发框架
npm install --save-dev hardhat
npm install --save-dev @nomiclabs/hardhat-ethers ethers

# 安装 OpenZeppelin 合约库
npm install @openzeppelin/contracts

# 安装其他依赖
npm install --save-dev @nomiclabs/hardhat-waffle
npm install --save-dev chai
npm install --save-dev ethereum-waffle
```

**项目结构**:
```
contracts/
├── XwawaToken.sol          # XWAWA代币合约
├── LotteryContract.sol     # 抽奖合约
├── interfaces/             # 合约接口
│   ├── IXwawaToken.sol
│   └── ILotteryContract.sol
├── libraries/              # 工具库
│   └── SafeRandom.sol
└── mocks/                  # 测试模拟合约
    └── MockVRFCoordinator.sol

scripts/
├── deploy-token.js         # 代币合约部署脚本
├── deploy-lottery.js       # 抽奖合约部署脚本
├── configure-contracts.js  # 合约配置脚本
└── verify-contracts.js     # 合约验证脚本

test/
├── XwawaToken.test.js      # 代币合约测试
├── LotteryContract.test.js # 抽奖合约测试
└── integration.test.js     # 集成测试
```

### 2. 网络配置

**hardhat.config.js**:
```javascript
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // 本地开发网络
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    
    // 测试网络
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 20000000000, // 20 gwei
      gas: 6000000
    },
    
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 20000000000,
      gas: 6000000
    },
    
    // 主网
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 30000000000, // 30 gwei
      gas: 8000000
    }
  },
  
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
```

**环境变量配置 (.env)**:
```bash
# 私钥 (用于部署)
PRIVATE_KEY=your_private_key_here

# Infura 项目ID
INFURA_PROJECT_ID=your_infura_project_id

# Etherscan API密钥 (用于合约验证)
ETHERSCAN_API_KEY=your_etherscan_api_key

# Chainlink VRF 配置
VRF_COORDINATOR=0x...
VRF_KEY_HASH=0x...
VRF_SUBSCRIPTION_ID=123

# 合约配置参数
INITIAL_SUPPLY=1000000000000000000000000  # 1,000,000 XWAWA
DRAW_COST=100000000000000000000           # 100 XWAWA
COMMUNITY_TREASURY=0x...                  # 社区金库地址
```

## 合约部署流程

### 1. 代币合约部署

**部署脚本 (scripts/deploy-token.js)**:
```javascript
const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署 XWAWA 代币合约...");
  
  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", (await deployer.getBalance()).toString());
  
  // 部署参数
  const name = "Xwawa Token";
  const symbol = "XWAWA";
  const decimals = 18;
  const initialSupply = ethers.utils.parseEther("1000000"); // 1,000,000 XWAWA
  
  // 部署合约
  const XwawaToken = await ethers.getContractFactory("XwawaToken");
  const xwawaToken = await XwawaToken.deploy(
    name,
    symbol,
    decimals,
    initialSupply
  );
  
  await xwawaToken.deployed();
  
  console.log("XWAWA 代币合约部署成功!");
  console.log("合约地址:", xwawaToken.address);
  console.log("交易哈希:", xwawaToken.deployTransaction.hash);
  
  // 保存部署信息
  const deploymentInfo = {
    network: hre.network.name,
    contractName: "XwawaToken",
    contractAddress: xwawaToken.address,
    deployerAddress: deployer.address,
    transactionHash: xwawaToken.deployTransaction.hash,
    blockNumber: xwawaToken.deployTransaction.blockNumber,
    gasUsed: (await xwawaToken.deployTransaction.wait()).gasUsed.toString(),
    timestamp: new Date().toISOString()
  };
  
  // 写入部署记录
  const fs = require("fs");
  fs.writeFileSync(
    `deployments/${hre.network.name}-xwawa-token.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("部署信息已保存到:", `deployments/${hre.network.name}-xwawa-token.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**执行部署**:
```bash
# 本地测试网络部署
npx hardhat run scripts/deploy-token.js --network localhost

# Goerli 测试网部署
npx hardhat run scripts/deploy-token.js --network goerli

# 主网部署
npx hardhat run scripts/deploy-token.js --network mainnet
```

### 2. 抽奖合约部署

**部署脚本 (scripts/deploy-lottery.js)**:
```javascript
const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署抽奖合约...");
  
  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  
  // 读取代币合约地址
  const tokenDeployment = require(`../deployments/${hre.network.name}-xwawa-token.json`);
  const xwawaTokenAddress = tokenDeployment.contractAddress;
  
  // 部署参数
  const communityTreasury = process.env.COMMUNITY_TREASURY;
  const drawCost = ethers.utils.parseEther("100"); // 100 XWAWA
  
  // 部署合约
  const LotteryContract = await ethers.getContractFactory("LotteryContract");
  const lotteryContract = await LotteryContract.deploy(
    xwawaTokenAddress,
    communityTreasury,
    drawCost
  );
  
  await lotteryContract.deployed();
  
  console.log("抽奖合约部署成功!");
  console.log("合约地址:", lotteryContract.address);
  console.log("XWAWA代币地址:", xwawaTokenAddress);
  console.log("社区金库地址:", communityTreasury);
  
  // 保存部署信息
  const deploymentInfo = {
    network: hre.network.name,
    contractName: "LotteryContract",
    contractAddress: lotteryContract.address,
    xwawaTokenAddress: xwawaTokenAddress,
    communityTreasury: communityTreasury,
    drawCost: drawCost.toString(),
    deployerAddress: deployer.address,
    transactionHash: lotteryContract.deployTransaction.hash,
    timestamp: new Date().toISOString()
  };
  
  // 写入部署记录
  const fs = require("fs");
  fs.writeFileSync(
    `deployments/${hre.network.name}-lottery-contract.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("部署信息已保存到:", `deployments/${hre.network.name}-lottery-contract.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## 合约配置

### 1. 奖项配置

**配置脚本 (scripts/configure-contracts.js)**:
```javascript
const { ethers } = require("hardhat");

async function configurePrizes() {
  console.log("开始配置奖项...");
  
  // 获取合约实例
  const lotteryDeployment = require(`../deployments/${hre.network.name}-lottery-contract.json`);
  const LotteryContract = await ethers.getContractFactory("LotteryContract");
  const lottery = LotteryContract.attach(lotteryDeployment.contractAddress);
  
  // 奖项配置
  const prizes = [
    { id: 1, name: "一等奖", probability: 1, value: ethers.utils.parseEther("10000") },
    { id: 2, name: "二等奖", probability: 5, value: ethers.utils.parseEther("1000") },
    { id: 3, name: "三等奖", probability: 10, value: ethers.utils.parseEther("500") },
    { id: 4, name: "四等奖", probability: 20, value: ethers.utils.parseEther("100") },
    { id: 5, name: "五等奖", probability: 30, value: ethers.utils.parseEther("50") },
    { id: 6, name: "谢谢参与", probability: 34, value: 0 }
  ];
  
  const prizeIds = prizes.map(p => p.id);
  const probabilities = prizes.map(p => p.probability);
  const values = prizes.map(p => p.value);
  
  // 设置奖项配置
  const tx = await lottery.setPrizeConfiguration(prizeIds, probabilities, values);
  await tx.wait();
  
  console.log("奖项配置完成!");
  console.log("交易哈希:", tx.hash);
}

async function fundPrizePool() {
  console.log("开始为奖池充值...");
  
  // 获取合约实例
  const tokenDeployment = require(`../deployments/${hre.network.name}-xwawa-token.json`);
  const lotteryDeployment = require(`../deployments/${hre.network.name}-lottery-contract.json`);
  
  const XwawaToken = await ethers.getContractFactory("XwawaToken");
  const token = XwawaToken.attach(tokenDeployment.contractAddress);
  
  // 向奖池转入代币
  const poolAmount = ethers.utils.parseEther("100000"); // 100,000 XWAWA
  const tx = await token.transfer(lotteryDeployment.contractAddress, poolAmount);
  await tx.wait();
  
  console.log("奖池充值完成!");
  console.log("充值金额:", ethers.utils.formatEther(poolAmount), "XWAWA");
  console.log("交易哈希:", tx.hash);
}

async function main() {
  await configurePrizes();
  await fundPrizePool();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 2. 权限设置

```javascript
async function setupPermissions() {
  console.log("开始设置权限...");
  
  const [deployer] = await ethers.getSigners();
  
  // 获取合约实例
  const tokenDeployment = require(`../deployments/${hre.network.name}-xwawa-token.json`);
  const XwawaToken = await ethers.getContractFactory("XwawaToken");
  const token = XwawaToken.attach(tokenDeployment.contractAddress);
  
  // 设置铸造权限
  const minterRole = await token.MINTER_ROLE();
  await token.grantRole(minterRole, process.env.MINTER_ADDRESS);
  
  // 设置管理员权限
  const adminRole = await token.DEFAULT_ADMIN_ROLE();
  await token.grantRole(adminRole, process.env.ADMIN_ADDRESS);
  
  console.log("权限设置完成!");
}
```

## 合约验证

### 1. Etherscan 验证

**验证脚本 (scripts/verify-contracts.js)**:
```javascript
const { run } = require("hardhat");

async function verifyToken() {
  console.log("开始验证代币合约...");
  
  const deployment = require(`../deployments/${hre.network.name}-xwawa-token.json`);
  
  try {
    await run("verify:verify", {
      address: deployment.contractAddress,
      constructorArguments: [
        "Xwawa Token",
        "XWAWA",
        18,
        ethers.utils.parseEther("1000000")
      ]
    });
    console.log("代币合约验证成功!");
  } catch (error) {
    console.error("代币合约验证失败:", error);
  }
}

async function verifyLottery() {
  console.log("开始验证抽奖合约...");
  
  const tokenDeployment = require(`../deployments/${hre.network.name}-xwawa-token.json`);
  const lotteryDeployment = require(`../deployments/${hre.network.name}-lottery-contract.json`);
  
  try {
    await run("verify:verify", {
      address: lotteryDeployment.contractAddress,
      constructorArguments: [
        tokenDeployment.contractAddress,
        process.env.COMMUNITY_TREASURY,
        ethers.utils.parseEther("100")
      ]
    });
    console.log("抽奖合约验证成功!");
  } catch (error) {
    console.error("抽奖合约验证失败:", error);
  }
}

async function main() {
  await verifyToken();
  await verifyLottery();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**执行验证**:
```bash
npx hardhat run scripts/verify-contracts.js --network goerli
```

## 测试指南

### 1. 单元测试

**代币合约测试 (test/XwawaToken.test.js)**:
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XwawaToken", function () {
  let XwawaToken, xwawaToken, owner, addr1, addr2;
  
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    XwawaToken = await ethers.getContractFactory("XwawaToken");
    xwawaToken = await XwawaToken.deploy(
      "Xwawa Token",
      "XWAWA",
      18,
      ethers.utils.parseEther("1000000")
    );
    await xwawaToken.deployed();
  });
  
  describe("部署", function () {
    it("应该设置正确的名称和符号", async function () {
      expect(await xwawaToken.name()).to.equal("Xwawa Token");
      expect(await xwawaToken.symbol()).to.equal("XWAWA");
    });
    
    it("应该将总供应量分配给部署者", async function () {
      const ownerBalance = await xwawaToken.balanceOf(owner.address);
      expect(await xwawaToken.totalSupply()).to.equal(ownerBalance);
    });
  });
  
  describe("交易", function () {
    it("应该能够在账户间转移代币", async function () {
      await xwawaToken.transfer(addr1.address, 50);
      const addr1Balance = await xwawaToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);
    });
    
    it("应该在余额不足时失败", async function () {
      const initialOwnerBalance = await xwawaToken.balanceOf(owner.address);
      await expect(
        xwawaToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });
});
```

**抽奖合约测试 (test/LotteryContract.test.js)**:
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LotteryContract", function () {
  let XwawaToken, xwawaToken, LotteryContract, lotteryContract;
  let owner, addr1, treasury;
  
  beforeEach(async function () {
    [owner, addr1, treasury] = await ethers.getSigners();
    
    // 部署代币合约
    XwawaToken = await ethers.getContractFactory("XwawaToken");
    xwawaToken = await XwawaToken.deploy(
      "Xwawa Token",
      "XWAWA",
      18,
      ethers.utils.parseEther("1000000")
    );
    await xwawaToken.deployed();
    
    // 部署抽奖合约
    LotteryContract = await ethers.getContractFactory("LotteryContract");
    lotteryContract = await LotteryContract.deploy(
      xwawaToken.address,
      treasury.address,
      ethers.utils.parseEther("100")
    );
    await lotteryContract.deployed();
  });
  
  describe("抽奖功能", function () {
    beforeEach(async function () {
      // 为用户转移代币
      await xwawaToken.transfer(addr1.address, ethers.utils.parseEther("1000"));
      
      // 用户授权抽奖合约
      await xwawaToken.connect(addr1).approve(
        lotteryContract.address,
        ethers.utils.parseEther("1000")
      );
      
      // 为奖池充值
      await xwawaToken.transfer(
        lotteryContract.address,
        ethers.utils.parseEther("10000")
      );
    });
    
    it("应该能够执行抽奖", async function () {
      const tx = await lotteryContract.connect(addr1).draw();
      const receipt = await tx.wait();
      
      // 检查事件
      const drawEvent = receipt.events.find(e => e.event === "DrawResult");
      expect(drawEvent).to.not.be.undefined;
      expect(drawEvent.args.user).to.equal(addr1.address);
    });
    
    it("应该扣除正确的抽奖费用", async function () {
      const initialBalance = await xwawaToken.balanceOf(addr1.address);
      await lotteryContract.connect(addr1).draw();
      const finalBalance = await xwawaToken.balanceOf(addr1.address);
      
      expect(initialBalance.sub(finalBalance)).to.equal(
        ethers.utils.parseEther("100")
      );
    });
  });
});
```

### 2. 集成测试

**执行测试**:
```bash
# 运行所有测试
npx hardhat test

# 运行特定测试文件
npx hardhat test test/XwawaToken.test.js

# 生成测试覆盖率报告
npx hardhat coverage
```

## 监控和维护

### 1. 合约监控

**事件监听脚本**:
```javascript
const { ethers } = require("ethers");

async function monitorContracts() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  
  // 获取合约实例
  const lotteryContract = new ethers.Contract(
    process.env.LOTTERY_CONTRACT_ADDRESS,
    lotteryABI,
    provider
  );
  
  // 监听抽奖事件
  lotteryContract.on("DrawResult", (user, prizeId, amount, timestamp) => {
    console.log("新的抽奖结果:", {
      user,
      prizeId: prizeId.toString(),
      amount: ethers.utils.formatEther(amount),
      timestamp: new Date(timestamp * 1000).toISOString()
    });
    
    // 发送到监控系统
    sendToMonitoring("draw_result", {
      user,
      prizeId: prizeId.toString(),
      amount: amount.toString(),
      timestamp
    });
  });
  
  console.log("开始监控合约事件...");
}

monitorContracts();
```

### 2. 安全检查

**定期安全检查清单**:
- [ ] 检查合约余额是否正常
- [ ] 验证奖池资金充足
- [ ] 监控异常交易活动
- [ ] 检查权限设置是否正确
- [ ] 验证随机数生成器正常工作
- [ ] 检查合约升级是否需要

### 3. 紧急响应

**紧急暂停功能**:
```solidity
// 在合约中实现紧急暂停
contract LotteryContract is Pausable, Ownable {
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
    
    function draw() external whenNotPaused returns (uint256) {
        // 抽奖逻辑
    }
}
```

## 升级策略

### 1. 代理合约模式

使用 OpenZeppelin 的升级代理：
```bash
npm install @openzeppelin/hardhat-upgrades
```

```javascript
const { upgrades } = require("@openzeppelin/hardhat-upgrades");

// 部署可升级合约
const LotteryV1 = await ethers.getContractFactory("LotteryV1");
const lottery = await upgrades.deployProxy(LotteryV1, [
  xwawaTokenAddress,
  communityTreasury,
  drawCost
]);

// 升级合约
const LotteryV2 = await ethers.getContractFactory("LotteryV2");
const upgraded = await upgrades.upgradeProxy(lottery.address, LotteryV2);
```

### 2. 数据迁移

在升级时保持数据一致性：
```solidity
contract LotteryV2 is LotteryV1 {
    // 新增存储变量
    mapping(address => uint256) public userLevels;
    
    // 数据迁移函数
    function migrateUserData(address[] calldata users, uint256[] calldata levels) 
        external onlyOwner {
        require(users.length == levels.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            userLevels[users[i]] = levels[i];
        }
    }
}
```

## 故障排除

### 常见问题

1. **部署失败**
   - 检查网络配置
   - 确认账户余额充足
   - 验证构造函数参数

2. **交易失败**
   - 检查 gas 限制设置
   - 确认合约权限配置
   - 验证输入参数格式

3. **验证失败**
   - 确认构造函数参数正确
   - 检查编译器版本匹配
   - 验证网络配置

### 调试工具

```bash
# 查看交易详情
npx hardhat run scripts/debug-transaction.js --network goerli

# 检查合约状态
npx hardhat console --network goerli
```

## 联系支持

如有合约相关问题，请联系：
- **技术支持**: contracts@xwawa.io
- **安全报告**: security@xwawa.io
- **开发者社区**: https://discord.gg/xwawa-dev