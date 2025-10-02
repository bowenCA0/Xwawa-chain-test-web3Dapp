const mysql = require('mysql2/promise');

// 验证必需的环境变量（开发环境下缺失时不阻断服务启动）
let DB_CONFIG_MISSING = false;
function validateConfigSoft() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    DB_CONFIG_MISSING = true;
    console.warn(`数据库环境变量缺失: ${missing.join(', ')}，服务将以“无数据库模式”启动。`);
  }
}

// 软验证配置
validateConfigSoft();

// 从环境变量读取数据库连接信息
const DB_CONFIG = DB_CONFIG_MISSING ? null : {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // 连接池配置 - 针对远程数据库优化
  waitForConnections: true,
  connectionLimit: 5,          // 减少连接数，避免过多连接
  queueLimit: 0,
  acquireTimeout: 30000,       // 减少获取连接超时时间
  timeout: 30000,              // 查询超时时间
  
  // 防止连接断开的关键配置
  idleTimeout: 300000,         // 5分钟空闲超时（更短的超时时间）
  maxIdle: 2,                  // 减少最大空闲连接数
  
  // TCP层面的保活机制 - 针对远程连接优化
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000, // 30秒后开始保活
  
  // MySQL连接选项
  charset: 'utf8mb4',
  timezone: '+08:00',
  
  // 重连配置
  reconnect: true,
  
  // 针对网络不稳定的额外配置
  connectTimeout: 20000,       // 连接超时20秒
  
  // SQL模式
  sql_mode: 'TRADITIONAL',
};

let pool;

function getPool() {
  if (DB_CONFIG_MISSING) {
    return null; // 无数据库模式
  }
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
    // 启动连接健康检查
    startHealthCheck(pool);
  }
  return pool;
}

// 连接健康检查函数
function startHealthCheck(pool) {
  // 每15分钟检查一次连接健康状态（减少频率）
  setInterval(async () => {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      console.log('数据库连接健康检查: ✓ 正常');
    } catch (error) {
      console.error('数据库连接健康检查失败:', error.message);
    }
  }, 15 * 60 * 1000); // 15分钟
}

// 优雅关闭连接池
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('数据库连接池已关闭');
  }
}

// 监听进程退出事件
process.on('SIGINT', async () => {
  console.log('收到退出信号，正在关闭数据库连接...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('收到终止信号，正在关闭数据库连接...');
  await closePool();
  process.exit(0);
});

function isDbConfigured() {
  return !DB_CONFIG_MISSING;
}

module.exports = { getPool, closePool, isDbConfigured };