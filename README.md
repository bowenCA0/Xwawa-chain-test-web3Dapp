# Xwawa - Web3 抽奖与市场平台

## 项目简介

Xwawa 是一个基于区块链技术的 Web3 抽奖与数字资产交易平台。项目集成了智能合约、代币经济和现代化的用户界面，为用户提供公平透明的抽奖体验和便捷的数字资产交易服务。

## 核心功能

### 🎲 抽奖系统
- **可证明公平的抽奖机制** - 基于智能合约的随机数生成
- **多种奖项设置** - 支持代币、NFT等多种奖励类型
- **实时奖池显示** - 透明的奖池资金管理
- **抽奖历史记录** - 完整的用户抽奖记录追踪

### 🛒 数字资产市场
- **NFT交易平台** - 支持数字艺术品买卖
- **代币支付系统** - 使用XWAWA代币进行交易
- **订单管理** - 完整的订单创建、支付、确认流程
- **二维码支付** - 便捷的移动端支付体验

### 🌐 Web3集成
- **多钱包支持** - MetaMask、OKX Wallet等主流钱包
- **智能合约交互** - 直接与区块链合约交互
- **实时交易状态** - 区块链交易状态实时更新
- **网络自适应** - 支持多个区块链网络

## 技术架构

### 前端技术栈
- **HTML5/CSS3** - 现代化响应式设计
- **JavaScript (ES6+)** - 原生JavaScript开发
- **Web3.js** - 以太坊区块链交互
- **QRCode.js** - 二维码生成
- **Font Awesome** - 图标库

### 区块链技术
- **智能合约** - Solidity开发的抽奖和代币合约
- **ERC-20代币** - XWAWA代币标准
- **随机数生成** - 链上可验证随机数
- **事件监听** - 实时监听区块链事件

### 后端需求
- **RESTful API** - 用户数据和订单管理
- **数据库** - 用户信息、交易记录存储
- **邮件服务** - 订单确认和通知
- **文件存储** - NFT元数据和图片存储

## 项目结构

```
Xwawa/
├── index.html              # 主页
├── lottery.html            # 抽奖页面
├── marketplace.html        # 市场页面
├── css/                    # 样式文件
│   ├── style.css          # 通用样式
│   ├── lottery.css        # 抽奖页面样式
│   └── marketplace.css    # 市场页面样式
├── js/                     # JavaScript文件
│   ├── script.js          # 通用功能
│   ├── lottery.js         # 抽奖功能
│   ├── marketplace.js     # 市场功能
│   └── web3-connector.js  # Web3连接器
├── images/                 # 图片资源
├── docs/                   # 项目文档
└── README.md              # 项目说明
```

## 快速开始

### 环境要求
- 现代浏览器 (Chrome 88+, Firefox 85+, Safari 14+)
- MetaMask或其他Web3钱包扩展
- 本地Web服务器 (用于开发)

### 安装步骤

1. **克隆项目**

2. **启动本地服务器**
   ```bash
   # 使用Python
   python -m http.server 8000
   
   # 或使用Node.js
   npx serve .
   
   # 或使用PHP
   php -S localhost:8000
   ```

3. **访问应用**
   打开浏览器访问 `http://localhost:8000`

### 钱包配置

1. **安装MetaMask**
   - 访问 [MetaMask官网](https://metamask.io/) 下载安装
   - 创建或导入钱包账户

2. **网络配置**
   - 添加测试网络 (Goerli/Sepolia)
   - 获取测试代币用于开发测试

3. **代币添加**
   - 添加XWAWA代币到钱包
   - 代币合约地址: `0x...` (待部署)

## 智能合约

### 抽奖合约 (LotteryContract)
- **合约地址**: `0x...` (待部署)
- **主要功能**:
  - `draw()` - 执行抽奖
  - `drawCost()` - 获取抽奖费用
  - `getPrizePool()` - 获取奖池余额
  - `getUserDrawHistory()` - 获取用户抽奖历史

### XWAWA代币合约
- **合约地址**: `0x...` (待部署)
- **代币标准**: ERC-20
- **代币符号**: XWAWA
- **小数位数**: 18

## API接口

### 抽奖相关
```
POST /api/lottery/draw          # 记录抽奖结果
GET  /api/lottery/history       # 获取抽奖历史
GET  /api/lottery/stats         # 获取抽奖统计
GET  /api/lottery/pool          # 获取奖池信息
```

### 市场相关
```
POST /api/orders                # 创建订单
GET  /api/orders/{id}/status    # 查询订单状态
POST /api/payments/verify       # 验证支付
GET  /api/products              # 获取商品列表
```

### 用户相关
```
GET  /api/user/profile          # 获取用户信息
POST /api/user/preferences      # 保存用户偏好
GET  /api/user/balance          # 获取用户余额
GET  /api/user/transactions     # 获取交易记录
```

## 数据库连接解决方案

### 问题背景
在生产环境中，我们遇到了数据库连接不稳定的问题，主要表现为：
- `ECONNRESET` 错误 - 连接被远程服务器重置
- `PROTOCOL_CONNECTION_LOST` 错误 - 协议连接丢失
- 长时间空闲后连接自动断开

### 解决方案架构
我们实现了三层防护机制来确保数据库连接的稳定性：

#### 1. 连接池优化
```javascript
// server/db.js - 优化的连接池配置
const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  acquireTimeout: 60000,      // 获取连接超时
  idleTimeout: 1800000,       // 空闲超时 (30分钟)
  maxIdle: 5,                 // 最大空闲连接数
  enableKeepAlive: true,      // 启用TCP Keep-Alive
  keepAliveInitialDelay: 0,   // Keep-Alive初始延迟
  charset: 'utf8mb4',         // 字符集
  timezone: '+00:00'          // 时区
};
```

#### 2. 健康检查机制
```javascript
// 每5分钟检查连接池健康状态
function startHealthCheck() {
  setInterval(async () => {
    try {
      await pool.execute('SELECT 1');
      console.log('Database health check: OK');
    } catch (error) {
      console.error('Database health check failed:', error.message);
    }
  }, 5 * 60 * 1000);
}
```

#### 3. 应用层重试机制
```javascript
// 智能重试机制，处理临时连接问题
async function executeWithRetry(query, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      if (shouldRetry(error) && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }
}
```

### 最佳实践
1. **连接池管理**: 合理设置连接池大小和超时参数
2. **健康检查**: 定期检查连接状态，及时发现问题
3. **智能重试**: 对临时网络问题实现自动重试
4. **监控告警**: 记录连接错误，设置监控告警
5. **优雅关闭**: 应用关闭时正确释放连接资源

### 相关文档
- [数据库连接解决方案](docs/DATABASE_CONNECTION.md) - 详细的技术实现文档
- [故障排查指南](docs/TROUBLESHOOTING.md) - 常见问题诊断和解决方案
- [部署配置指南](docs/DEPLOYMENT.md) - 生产环境部署最佳实践
- [数据库连接贡献指南](docs/CONTRIBUTING_DB.md) - 参与数据库连接优化的开发指南
- [数据库连接变更日志](CHANGELOG_DB.md) - 所有相关改进和修复的历史记录

## 开发指南

### 代码规范
- 使用ES6+语法
- 遵循JSDoc注释规范
- 保持代码模块化和可维护性
- 使用语义化的HTML结构

### 安全考虑
- 所有用户输入都需要验证
- 智能合约交互需要用户确认
- 敏感操作需要多重验证
- 防止XSS和CSRF攻击

### 测试建议
- 在测试网络进行充分测试
- 模拟各种异常情况
- 测试不同钱包的兼容性
- 验证智能合约的安全性

## 部署说明

### 前端部署
1. 构建生产版本
2. 配置CDN和静态资源
3. 设置域名和SSL证书
4. 配置Web服务器

### 智能合约部署
1. 编译合约代码
2. 部署到目标网络
3. 验证合约代码
4. 配置合约参数

### 后端部署
1. 设置数据库
2. 配置API服务器
3. 设置邮件服务
4. 配置监控和日志

## 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系我们

- **项目主页**: https://xwawa.meme
- **文档**: https://docs.xwawa.meme
- **Twitter**: https://twitter.com/xwawa_official
- **邮箱**: contact@xwawa.meme

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 抽奖系统基础功能
- 市场交易功能
- Web3钱包集成

---

**注意**: 本项目仍在开发中，部分功能可能不完整。请在生产环境使用前进行充分测试。