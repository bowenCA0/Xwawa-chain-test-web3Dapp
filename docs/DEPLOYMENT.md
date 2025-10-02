# Xwawa 项目部署指南

## 概述

本文档提供了 Xwawa 项目的完整部署指南，包括前端部署、后端API部署、智能合约部署以及第三方服务配置。

## 系统要求

### 开发环境
- **Node.js**: v16.0.0 或更高版本
- **npm**: v8.0.0 或更高版本
- **Git**: 最新版本
- **Web3 钱包**: MetaMask 或其他兼容钱包

### 生产环境
- **Web服务器**: Nginx 1.18+ 或 Apache 2.4+
- **SSL证书**: 用于HTTPS支持
- **CDN**: 推荐使用 Cloudflare 或 AWS CloudFront
- **域名**: 已备案的域名（如需要）

## 前端部署

### 1. 本地开发环境

**克隆项目**:
```bash
git clone https://github.com/your-org/xwawa.git
cd xwawa
```

**安装依赖**:
```bash
# 如果项目使用 npm 包管理
npm install

# 或者直接使用静态文件（当前项目结构）
# 无需安装依赖，直接启动本地服务器
```

**启动开发服务器**:
```bash
# 使用 Python 启动简单HTTP服务器
python -m http.server 8000

# 或使用 Node.js 的 http-server
npx http-server -p 8000

# 或使用 Live Server (VS Code 扩展)
# 右键 index.html -> Open with Live Server
```

**访问应用**:
```
http://localhost:8000
```

### 2. 生产环境部署

#### 2.1 静态文件部署

**文件结构优化**:
```bash
# 创建生产构建目录
mkdir dist
cp -r css/ dist/
cp -r js/ dist/
cp -r images/ dist/
cp -r docs/ dist/
cp index.html dist/
cp lottery.html dist/
cp marketplace.html dist/
```

**文件压缩优化**:
```bash
# 安装压缩工具
npm install -g uglify-js clean-css-cli html-minifier

# 压缩 JavaScript 文件
uglifyjs js/script.js -o dist/js/script.min.js
uglifyjs js/lottery.js -o dist/js/lottery.min.js
uglifyjs js/marketplace.js -o dist/js/marketplace.min.js
uglifyjs js/web3-connector.js -o dist/js/web3-connector.min.js

# 压缩 CSS 文件
cleancss css/style.css -o dist/css/style.min.css

# 压缩 HTML 文件
html-minifier --collapse-whitespace --remove-comments index.html -o dist/index.html
html-minifier --collapse-whitespace --remove-comments lottery.html -o dist/lottery.html
html-minifier --collapse-whitespace --remove-comments marketplace.html -o dist/marketplace.html
```

#### 2.2 Nginx 配置

**安装 Nginx**:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

**Nginx 配置文件** (`/etc/nginx/sites-available/xwawa`):
```nginx
server {
    listen 80;
    server_name xwawa.io www.xwawa.io;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xwawa.io www.xwawa.io;
    
    # SSL 证书配置
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # 网站根目录
    root /var/www/xwawa/dist;
    index index.html;
    
    # 启用 Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
    }
    
    # HTML 文件缓存
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public";
    }
    
    # 主页面路由
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理（如果有后端API）
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 安全头设置
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # 错误页面
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}
```

**启用站点**:
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/xwawa /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### 2.3 CDN 配置

**Cloudflare 配置**:
1. 添加域名到 Cloudflare
2. 配置 DNS 记录
3. 启用 SSL/TLS 加密
4. 配置缓存规则
5. 启用 Brotli 压缩

**缓存规则示例**:
```
# 静态资源缓存 1 年
*.js, *.css, *.png, *.jpg, *.gif, *.ico, *.svg, *.woff, *.woff2
Cache Level: Cache Everything
Edge Cache TTL: 1 year

# HTML 文件缓存 1 小时
*.html
Cache Level: Cache Everything
Edge Cache TTL: 1 hour
```

## 智能合约部署（Foundry）

本项目前端依赖 `Lottery` 智能合约。以下步骤使用 Foundry 部署该合约。

### 前置条件
- 已安装 Foundry（参考：https://book.getfoundry.sh/getting-started/installation）
- 仓库根目录新增：`foundry.toml`、`script/Lottery.s.sol`（已添加）
- 将同事提供的 `Lottery.sol` 放入 `src/Lottery.sol`
- 准备 RPC 与私钥（仅测试网络或安全账户）

### 安装依赖
```bash
forge install foundry-rs/forge-std --no-commit
```

### Windows PowerShell 环境变量示例
```powershell
$env:RPC_URL = "https://your-rpc"
$env:PRIVATE_KEY = "0x你的私钥"
```

### 部署命令
```powershell
forge script script/Lottery.s.sol --rpc-url $env:RPC_URL --broadcast --private-key $env:PRIVATE_KEY --legacy
```

### 部署参数（已在脚本中固定）
- 分母：1,000,000（百万分制）
- 概率：
  - firstPrizeOfMerch = 400（0.04%）
  - secondPrizeOfMerch = 600（0.06%）
  - thirdPrizeOfMerch = 1000（0.1%）
  - partOfPool = 3000（0.3%）
  - doubleBonus = 295_000（29.5%）
  - nothing = 700_000（70.0%）
- drawCost = 10000 ether
- feeToCommunity = 2000（0.2%）
- communityTreasury = 0xCD6C5393F06dFF566f52ec2cAB51c3cA2B047dba
- partRate = 50_000（5%）
- owner = 0xBE0C630241768A53A98DF324a53e0C60F9cf0d52

部署完成后，终端会输出：
```
Lottery: 0x...
```
记录该地址，并在前端配置中使用。

---

## 后端 API 部署

### 1. Node.js 后端部署

**项目结构**:
```
backend/
├── package.json
├── server.js
├── routes/
│   ├── lottery.js
│   ├── marketplace.js
│   └── user.js
├── middleware/
│   ├── auth.js
│   └── validation.js
├── models/
│   ├── User.js
│   ├── Order.js
│   └── LotteryRecord.js
├── config/
│   ├── database.js
│   └── blockchain.js
└── utils/
    ├── email.js
    └── crypto.js
```

**package.json 示例**:
```json
{
  "name": "xwawa-backend",
  "version": "1.0.0",
  "description": "Xwawa Backend API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "build": "npm install --production"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^6.1.5",
    "dotenv": "^16.0.3",
    "mongoose": "^7.0.3",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "web3": "^1.9.0",
    "nodemailer": "^6.9.1",
    "express-rate-limit": "^6.7.0",
    "express-validator": "^6.15.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22",
    "jest": "^29.5.0"
  }
}
```

**环境变量配置** (`.env`):
```bash
# 服务器配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/xwawa
REDIS_URL=redis://localhost:6379

# JWT 配置
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# 区块链配置
WEB3_PROVIDER_URL=https://mainnet.infura.io/v3/your_project_id
LOTTERY_CONTRACT_ADDRESS=0x...
XWAWA_TOKEN_ADDRESS=0x...
PRIVATE_KEY=your_private_key

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# 第三方服务
ETHERSCAN_API_KEY=your_etherscan_api_key
COINGECKO_API_KEY=your_coingecko_api_key

# 安全配置
CORS_ORIGIN=https://xwawa.io
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

**PM2 配置** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'xwawa-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }]
};
```

**部署脚本** (`deploy.sh`):
```bash
#!/bin/bash

echo "开始部署 Xwawa 后端..."

# 拉取最新代码
git pull origin main

# 安装依赖
npm ci --production

# 运行数据库迁移
npm run migrate

# 重启应用
pm2 reload ecosystem.config.js

# 检查应用状态
pm2 status

echo "部署完成!"
```

### 2. 数据库部署

#### 2.1 MongoDB 配置

**安装 MongoDB**:
```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

**MongoDB 配置** (`/etc/mongod.conf`):
```yaml
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1

security:
  authorization: enabled

replication:
  replSetName: "xwawa-rs"
```

**创建数据库用户**:
```javascript
// 连接到 MongoDB
mongo

// 创建管理员用户
use admin
db.createUser({
  user: "admin",
  pwd: "secure_password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

// 创建应用用户
use xwawa
db.createUser({
  user: "xwawa_user",
  pwd: "app_password",
  roles: ["readWrite"]
})
```

#### 2.2 Redis 配置

**安装 Redis**:
```bash
sudo apt update
sudo apt install redis-server
```

**Redis 配置** (`/etc/redis/redis.conf`):
```
bind 127.0.0.1
port 6379
requirepass your_redis_password
maxmemory 256mb
maxmemory-policy allkeys-lru
```

## 智能合约部署

### 1. 环境准备

**安装 Hardhat**:
```bash
mkdir xwawa-contracts
cd xwawa-contracts
npm init -y
npm install --save-dev hardhat
npx hardhat
```

**项目配置** (`hardhat.config.js`):
```javascript
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

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
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 30000000000
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 20000000000
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
```

### 2. 合约部署

**部署脚本执行**:
```bash
# 测试网部署
npx hardhat run scripts/deploy-token.js --network goerli
npx hardhat run scripts/deploy-lottery.js --network goerli
npx hardhat run scripts/configure-contracts.js --network goerli

# 主网部署
npx hardhat run scripts/deploy-token.js --network mainnet
npx hardhat run scripts/deploy-lottery.js --network mainnet
npx hardhat run scripts/configure-contracts.js --network mainnet

# 合约验证
npx hardhat run scripts/verify-contracts.js --network mainnet
```

## 监控和日志

### 1. 应用监控

**安装监控工具**:
```bash
# 安装 PM2 监控
npm install -g pm2
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

**Nginx 日志配置**:
```nginx
# 在 server 块中添加
access_log /var/log/nginx/xwawa_access.log combined;
error_log /var/log/nginx/xwawa_error.log warn;
```

### 2. 系统监控

**安装系统监控**:
```bash
# 安装 htop 和 iotop
sudo apt install htop iotop

# 安装 Netdata（可选）
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

## 安全配置

### 1. 防火墙设置

```bash
# 启用 UFW 防火墙
sudo ufw enable

# 允许 SSH
sudo ufw allow ssh

# 允许 HTTP 和 HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 允许后端 API（仅本地）
sudo ufw allow from 127.0.0.1 to any port 3000

# 查看状态
sudo ufw status
```

### 2. SSL 证书

**使用 Let's Encrypt**:
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d xwawa.io -d www.xwawa.io

# 设置自动续期
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

## 备份策略

### 1. 数据库备份

**MongoDB 备份脚本** (`backup-mongodb.sh`):
```bash
#!/bin/bash

BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="xwawa_backup_$DATE"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
mongodump --host localhost --port 27017 --db xwawa --out $BACKUP_DIR/$BACKUP_NAME

# 压缩备份
tar -czf $BACKUP_DIR/$BACKUP_NAME.tar.gz -C $BACKUP_DIR $BACKUP_NAME

# 删除未压缩的备份
rm -rf $BACKUP_DIR/$BACKUP_NAME

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
```

**设置定时备份**:
```bash
# 编辑 crontab
sudo crontab -e

# 添加每日备份任务
0 2 * * * /path/to/backup-mongodb.sh
```

### 2. 代码备份

```bash
# Git 自动推送脚本
#!/bin/bash
cd /var/www/xwawa
git add .
git commit -m "Auto backup $(date)"
git push origin main
```

## 性能优化

### 1. 前端优化

- **代码分割**: 按页面拆分 JavaScript 文件
- **图片优化**: 使用 WebP 格式，启用懒加载
- **缓存策略**: 设置合适的缓存头
- **CDN 加速**: 使用全球 CDN 分发静态资源

### 2. 后端优化

- **数据库索引**: 为常用查询字段创建索引
- **连接池**: 配置数据库连接池
- **缓存层**: 使用 Redis 缓存热点数据
- **负载均衡**: 使用 Nginx 或 HAProxy

## 故障排除

### 常见问题

1. **前端无法加载**
   - 检查 Nginx 配置
   - 验证文件权限
   - 查看错误日志

2. **API 请求失败**
   - 检查后端服务状态
   - 验证数据库连接
   - 查看应用日志

3. **智能合约交互失败**
   - 检查网络连接
   - 验证合约地址
   - 确认钱包连接

### 日志查看

```bash
# Nginx 日志
sudo tail -f /var/log/nginx/xwawa_error.log

# PM2 应用日志
pm2 logs xwawa-backend

# 系统日志
sudo journalctl -u nginx -f
```

## 更新和维护

### 1. 应用更新

```bash
# 前端更新
cd /var/www/xwawa
git pull origin main
sudo systemctl reload nginx

# 后端更新
cd /path/to/backend
git pull origin main
npm ci --production
pm2 reload ecosystem.config.js
```

### 2. 系统维护

```bash
# 系统更新
sudo apt update && sudo apt upgrade

# 清理日志
sudo journalctl --vacuum-time=30d

# 清理包缓存
sudo apt autoremove && sudo apt autoclean
```

## 联系支持

如有部署相关问题，请联系：
- **技术支持**: support@xwawa.io
- **运维支持**: ops@xwawa.io
- **紧急联系**: emergency@xwawa.io