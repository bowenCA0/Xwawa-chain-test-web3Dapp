# Xwawa API 接口文档

## 概述

本文档描述了 Xwawa 平台的后端 API 接口设计。所有 API 接口遵循 RESTful 设计原则，使用 JSON 格式进行数据交换。

## 基础信息

- **Base URL**: `https://api.xwawa.io/v1`
- **认证方式**: JWT Token / 钱包签名验证
- **数据格式**: JSON
- **字符编码**: UTF-8

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 具体数据内容
  },
  "message": "操作成功",
  "timestamp": 1640995200000
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  },
  "timestamp": 1640995200000
}
```

## 认证机制

### JWT Token 认证
```http
Authorization: Bearer <jwt_token>
```

### 钱包签名认证
```http
X-Wallet-Address: 0x1234567890123456789012345678901234567890
X-Signature: 0xabcdef...
X-Message: 登录消息内容
```

## 抽奖系统 API

### 1. 记录抽奖结果

**接口**: `POST /lottery/draw`

**描述**: 记录用户抽奖结果到数据库

**请求参数**:
```json
{
  "userAddress": "0x1234567890123456789012345678901234567890",
  "transactionHash": "0xabcdef...",
  "prizeId": 1,
  "prizeName": "一等奖",
  "prizeValue": "1000",
  "drawCost": "100",
  "blockNumber": 12345678,
  "timestamp": 1640995200000
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "drawId": "draw_123456789",
    "userAddress": "0x1234567890123456789012345678901234567890",
    "prizeId": 1,
    "prizeName": "一等奖",
    "prizeValue": "1000",
    "status": "confirmed",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "抽奖记录创建成功"
}
```

### 2. 获取抽奖历史

**接口**: `GET /lottery/history`

**描述**: 获取用户的抽奖历史记录

**查询参数**:
- `userAddress` (string, required): 用户钱包地址
- `page` (integer, optional): 页码，默认为1
- `limit` (integer, optional): 每页数量，默认为20
- `startDate` (string, optional): 开始日期 (ISO 8601)
- `endDate` (string, optional): 结束日期 (ISO 8601)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "draws": [
      {
        "drawId": "draw_123456789",
        "prizeId": 1,
        "prizeName": "一等奖",
        "prizeValue": "1000",
        "drawCost": "100",
        "transactionHash": "0xabcdef...",
        "status": "confirmed",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "message": "获取抽奖历史成功"
}
```

### 3. 获取抽奖统计

**接口**: `GET /lottery/stats`

**描述**: 获取抽奖系统的统计数据

**查询参数**:
- `period` (string, optional): 统计周期 (daily/weekly/monthly/all)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalDraws": 10000,
    "totalPrizeValue": "1000000",
    "totalUsers": 5000,
    "prizeDistribution": [
      {
        "prizeId": 1,
        "prizeName": "一等奖",
        "count": 10,
        "percentage": 0.1
      }
    ],
    "recentDraws": [
      {
        "drawId": "draw_123456789",
        "userAddress": "0x1234...7890",
        "prizeName": "一等奖",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "message": "获取统计数据成功"
}
```

### 4. 获取奖池信息

**接口**: `GET /lottery/pool`

**描述**: 获取当前奖池的详细信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalPool": "500000",
    "availablePool": "450000",
    "distributedPrizes": "50000",
    "poolHistory": [
      {
        "date": "2024-01-01",
        "totalPool": "500000",
        "distributed": "10000"
      }
    ],
    "nextRefill": "2024-01-02T00:00:00Z"
  },
  "message": "获取奖池信息成功"
}
```

## 市场系统 API

### 1. 创建订单

**接口**: `POST /orders`

**描述**: 创建新的购买订单

**请求参数**:
```json
{
  "productId": "product_123",
  "customerEmail": "user@example.com",
  "productName": "数字艺术品 #001",
  "usdPrice": "99.99",
  "tokenAmount": "1000",
  "paymentMethod": "XWAWA"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "orderId": "XW123456",
    "productId": "product_123",
    "customerEmail": "user@example.com",
    "paymentAddress": "0x9876543210987654321098765432109876543210",
    "tokenAmount": "1000",
    "expiryTime": "2024-01-01T00:15:00Z",
    "status": "pending",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "订单创建成功"
}
```

### 2. 查询订单状态

**接口**: `GET /orders/{orderId}/status`

**描述**: 查询指定订单的支付状态

**路径参数**:
- `orderId` (string, required): 订单ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "orderId": "XW123456",
    "status": "paid",
    "transactionHash": "0xabcdef...",
    "paidAmount": "1000",
    "paidAt": "2024-01-01T00:10:00Z",
    "confirmations": 12,
    "isConfirmed": true
  },
  "message": "订单状态查询成功"
}
```

### 3. 验证支付

**接口**: `POST /payments/verify`

**描述**: 验证区块链支付交易

**请求参数**:
```json
{
  "orderId": "XW123456",
  "transactionHash": "0xabcdef...",
  "fromAddress": "0x1234567890123456789012345678901234567890",
  "toAddress": "0x9876543210987654321098765432109876543210",
  "amount": "1000"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "transactionHash": "0xabcdef...",
    "blockNumber": 12345678,
    "confirmations": 12,
    "gasUsed": "21000",
    "status": "confirmed"
  },
  "message": "支付验证成功"
}
```

### 4. 获取商品列表

**接口**: `GET /products`

**描述**: 获取市场中的商品列表

**查询参数**:
- `category` (string, optional): 商品分类
- `page` (integer, optional): 页码，默认为1
- `limit` (integer, optional): 每页数量，默认为20
- `sortBy` (string, optional): 排序字段 (price/created_at/popularity)
- `order` (string, optional): 排序方向 (asc/desc)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "productId": "product_123",
        "name": "数字艺术品 #001",
        "description": "独特的数字艺术作品",
        "usdPrice": "99.99",
        "tokenPrice": "1000",
        "category": "digital_art",
        "imageUrl": "https://cdn.xwawa.io/images/product_123.jpg",
        "isAvailable": true,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "message": "获取商品列表成功"
}
```

## 用户系统 API

### 1. 获取用户信息

**接口**: `GET /user/profile`

**描述**: 获取用户的个人资料信息

**查询参数**:
- `address` (string, required): 用户钱包地址

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userAddress": "0x1234567890123456789012345678901234567890",
    "username": "user123",
    "email": "user@example.com",
    "avatar": "https://cdn.xwawa.io/avatars/user123.jpg",
    "level": 5,
    "experience": 2500,
    "totalDraws": 100,
    "totalWinnings": "50000",
    "joinedAt": "2023-01-01T00:00:00Z",
    "lastActiveAt": "2024-01-01T00:00:00Z"
  },
  "message": "获取用户信息成功"
}
```

### 2. 保存用户偏好

**接口**: `POST /user/preferences`

**描述**: 保存用户的个人偏好设置

**请求参数**:
```json
{
  "userAddress": "0x1234567890123456789012345678901234567890",
  "language": "zh",
  "theme": "dark",
  "notifications": {
    "email": true,
    "push": false,
    "sms": false
  },
  "privacy": {
    "showProfile": true,
    "showHistory": false
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userAddress": "0x1234567890123456789012345678901234567890",
    "preferences": {
      "language": "zh",
      "theme": "dark",
      "notifications": {
        "email": true,
        "push": false,
        "sms": false
      },
      "privacy": {
        "showProfile": true,
        "showHistory": false
      }
    },
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "message": "用户偏好保存成功"
}
```

### 3. 获取用户余额

**接口**: `GET /user/balance`

**描述**: 获取用户的代币余额信息

**查询参数**:
- `address` (string, required): 用户钱包地址

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userAddress": "0x1234567890123456789012345678901234567890",
    "balances": {
      "XWAWA": {
        "balance": "10000",
        "usdValue": "1000.00",
        "lastUpdated": "2024-01-01T00:00:00Z"
      },
      "ETH": {
        "balance": "1.5",
        "usdValue": "3000.00",
        "lastUpdated": "2024-01-01T00:00:00Z"
      }
    },
    "totalUsdValue": "4000.00"
  },
  "message": "获取余额信息成功"
}
```

### 4. 获取交易记录

**接口**: `GET /user/transactions`

**描述**: 获取用户的交易历史记录

**查询参数**:
- `address` (string, required): 用户钱包地址
- `type` (string, optional): 交易类型 (draw/purchase/transfer)
- `page` (integer, optional): 页码，默认为1
- `limit` (integer, optional): 每页数量，默认为20

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "tx_123456789",
        "type": "draw",
        "amount": "100",
        "tokenSymbol": "XWAWA",
        "transactionHash": "0xabcdef...",
        "status": "confirmed",
        "description": "抽奖消费",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "message": "获取交易记录成功"
}
```

## 错误代码

| 错误代码 | HTTP状态码 | 描述 |
|---------|-----------|------|
| `INVALID_REQUEST` | 400 | 请求参数无效 |
| `UNAUTHORIZED` | 401 | 未授权访问 |
| `FORBIDDEN` | 403 | 禁止访问 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `METHOD_NOT_ALLOWED` | 405 | 请求方法不允许 |
| `RATE_LIMITED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 |
| `INVALID_SIGNATURE` | 400 | 签名验证失败 |
| `INSUFFICIENT_BALANCE` | 400 | 余额不足 |
| `ORDER_EXPIRED` | 400 | 订单已过期 |
| `PAYMENT_FAILED` | 400 | 支付失败 |
| `TRANSACTION_NOT_FOUND` | 404 | 交易未找到 |

## 限流规则

- **普通用户**: 每分钟最多100次请求
- **认证用户**: 每分钟最多500次请求
- **VIP用户**: 每分钟最多1000次请求

## 数据缓存

- **用户余额**: 缓存5分钟
- **商品列表**: 缓存10分钟
- **抽奖统计**: 缓存30分钟
- **奖池信息**: 缓存1分钟

## 安全考虑

1. **HTTPS强制**: 所有API请求必须使用HTTPS
2. **签名验证**: 关键操作需要钱包签名验证
3. **请求限流**: 防止API滥用
4. **数据验证**: 严格验证所有输入参数
5. **日志记录**: 记录所有API访问日志
6. **错误处理**: 不暴露敏感的错误信息

## 版本控制

API版本通过URL路径进行控制：
- `v1`: 当前稳定版本
- `v2`: 下一个主要版本（开发中）

## 联系支持

如有API相关问题，请联系：
- **技术支持**: api-support@xwawa.io
- **文档反馈**: docs@xwawa.io
- **开发者社区**: https://discord.gg/xwawa-dev