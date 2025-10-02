const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const { getPool, isDbConfigured } = require('./db');
const { sendPrizeEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

// 更宽松的本地开发CORS，允许 localhost 与 127.0.0.1 各端口
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // 允许非浏览器或同源
    const ok = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    callback(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
}));
// 预检请求由全局 cors 中间件处理，这里不再单独注册 options 路由
app.use(express.json());

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// SMTP 登录验证（仅用于开发排查）
app.get('/api/mail/verify', async (req, res) => {
  try {
    const { sendPrizeEmail } = require('./mailer');
    const nodemailer = require('nodemailer');
    // 使用 mailer 的同构造逻辑创建 transporter 并执行 verify
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.verify();
    res.json({ ok: true, message: 'SMTP authentication success' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// 发送测试邮件（不依赖数据库，用于端到端验证）
app.post('/api/mail/send-test', async (req, res) => {
  try {
    const { to, wallet_address, prize_name, tx_hash } = req.body || {};
    const recipient = (to || process.env.SMTP_USER);
    const wallet = (wallet_address || '0x1111111111111111111111111111111111111111').toLowerCase();
    const prizeName = prize_name || 'Test Prize';
    const txHash = tx_hash || null;

    await sendPrizeEmail({
      to: recipient,
      walletAddress: wallet,
      txHash,
      prizeName,
    });
    console.log('Test prize email sent to', recipient);
    res.json({ ok: true, message: 'Test email sent', to: recipient });
  } catch (e) {
    console.warn('测试邮件发送失败:', e && e.message ? e.message : e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// 数据库连通性检测（Ping）
app.get('/api/db/ping', async (req, res) => {
  try {
    const pool = getPool();
    const [okRows] = await pool.query('SELECT 1 AS ok');
    const [verRows] = await pool.query('SELECT VERSION() AS version');
    res.json({
      ok: true,
      db_host: process.env.DB_HOST,
      result: okRows && okRows[0],
      version: verRows && verRows[0] && verRows[0].version,
    });
  } catch (err) {
    console.error('数据库Ping失败:', err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// 启动时确保基础表存在
async function ensureSchema() {
  try {
    if (!isDbConfigured()) {
      console.log('跳过数据库初始化：当前为无数据库模式');
      return;
    }
    const pool = getPool();
    const sql = `
      CREATE TABLE IF NOT EXISTS lottery_records (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(64) NOT NULL,
        prize INT NULL,
        amount DECIMAL(32,8) NULL,
        tx_hash VARCHAR(128) NULL,
        status VARCHAR(32) DEFAULT 'pending',
        email VARCHAR(255) NULL COMMENT '中奖者邮箱地址',
        claim_status VARCHAR(32) DEFAULT 'unclaimed' COMMENT '领取状态: unclaimed, claimed',
        claimed_at DATETIME NULL COMMENT '领取时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wallet_address (wallet_address),
        INDEX idx_claim_status (claim_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(sql);
    
    // 检查并添加新字段（兼容已存在的表）
    const fieldsToAdd = [
      { name: 'email', sql: `ALTER TABLE lottery_records ADD COLUMN email VARCHAR(255) NULL COMMENT '中奖者邮箱地址'` },
      { name: 'claim_status', sql: `ALTER TABLE lottery_records ADD COLUMN claim_status VARCHAR(32) DEFAULT 'unclaimed' COMMENT '领取状态: unclaimed, claimed'` },
      { name: 'claimed_at', sql: `ALTER TABLE lottery_records ADD COLUMN claimed_at DATETIME NULL COMMENT '领取时间'` },
      { name: 'updated_at', sql: `ALTER TABLE lottery_records ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` }
    ];
    
    for (const field of fieldsToAdd) {
      try {
        // 先检查字段是否存在
        const [columns] = await pool.query(`SHOW COLUMNS FROM lottery_records LIKE '${field.name}'`);
        if (columns.length === 0) {
          // 字段不存在，添加它
          await pool.query(field.sql);
          console.log(`已添加字段: ${field.name}`);
        }
      } catch (e) {
        console.warn(`添加字段 ${field.name} 失败:`, e.message);
      }
    }
    
    console.log('数据库表 lottery_records 已准备');
  } catch (e) {
    console.warn('初始化数据库表失败（继续运行）:', e);
  }
}

// 获取指定钱包地址的最新抽奖记录（默认30条）
app.get('/api/lottery/history', async (req, res) => {
  const address = (req.query.address || '').trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit || 30), 100);

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: '缺少有效的地址参数address' });
  }

  // 数据库查询重试函数
  async function executeWithRetry(pool, sql, params, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [rows] = await pool.execute(sql, params);
        return rows;
      } catch (err) {
        console.error(`数据库查询尝试 ${attempt}/${maxRetries} 失败:`, err.message);
        
        if (attempt === maxRetries) {
          throw err;
        }
        
        // 如果是连接错误，等待一段时间后重试
        if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else {
          throw err; // 非连接错误直接抛出
        }
      }
    }
  }

  // 数据库缺失时的回退
  if (!isDbConfigured()) {
    return res.json({ address, count: 0, records: [] });
  }
  try {
    const pool = getPool();
    // 这里假设表名为 lottery_records，字段如下：
    // id, wallet_address, prize, amount, tx_hash, status, created_at
    const sql = `
      SELECT id, wallet_address, prize, amount, tx_hash, status, email, 
             claim_status, claimed_at, created_at, updated_at
      FROM lottery_records
      WHERE wallet_address = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const rows = await executeWithRetry(pool, sql, [address, limit]);
    res.json({ address, count: rows.length, records: rows });
  } catch (err) {
    console.error('查询抽奖历史失败:', err);
    res.status(500).json({ error: '服务器查询失败', detail: String(err.message || err) });
  }
});

// 可选：记录抽奖结果（如需从前端或合约事件写入）
app.post('/api/lottery/draw', async (req, res) => {
  const { wallet_address, prize, amount, tx_hash, status } = req.body || {};
  if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
    return res.status(400).json({ error: '缺少有效的钱包地址wallet_address' });
  }

  try {
    const pool = getPool();
    const sql = `
      INSERT INTO lottery_records (wallet_address, prize, amount, tx_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    const [result] = await pool.execute(sql, [wallet_address.toLowerCase(), prize ?? null, amount ?? null, tx_hash ?? null, status ?? 'pending']);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('写入抽奖记录失败:', err);
    res.status(500).json({ error: '服务器写入失败', detail: String(err.message || err) });
  }
});

// 更新中奖记录的邮箱地址
app.post('/api/lottery/update-email', async (req, res) => {
  const { record_id, email, wallet_address } = req.body || {};
  
  if (!record_id || !email || !wallet_address) {
    return res.status(400).json({ error: '缺少必需参数: record_id, email, wallet_address' });
  }
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  
  // 验证钱包地址格式
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
    return res.status(400).json({ error: '钱包地址格式不正确' });
  }

  try {
    const pool = getPool();
    
    // 验证记录是否属于该钱包地址
    const checkSql = `
      SELECT id, prize, wallet_address FROM lottery_records 
      WHERE id = ? AND wallet_address = ?
    `;
    const [checkRows] = await pool.execute(checkSql, [record_id, wallet_address.toLowerCase()]);
    
    if (checkRows.length === 0) {
      return res.status(404).json({ error: '未找到对应的中奖记录' });
    }
    
    const record = checkRows[0];
    console.log('调试信息 - 记录详情:', { 
      id: record.id, 
      prize: record.prize, 
      prizeType: typeof record.prize,
      wallet_address: record.wallet_address 
    });
    
    // 只有一二三等奖才能填写邮箱 (奖项ID: 0=一等奖, 1=二等奖, 2=三等奖)
    if (record.prize === null || record.prize === undefined || record.prize < 0 || record.prize > 2) {
      console.log('奖项验证失败:', { prize: record.prize, condition: 'prize < 0 || prize > 2' });
      return res.status(400).json({ error: '只有一二三等奖可以填写邮箱地址' });
    }
    
    // 更新邮箱地址
    const updateSql = `
      UPDATE lottery_records 
      SET email = ?, updated_at = NOW()
      WHERE id = ? AND wallet_address = ?
    `;
    const [result] = await pool.execute(updateSql, [email, record_id, wallet_address.toLowerCase()]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '更新失败，记录不存在' });
    }
    // 构造奖品名称文案（英文），可按需调整映射
    const prizeMap = {
      0: 'First Prize',
      1: 'Second Prize',
      2: 'Third Prize'
    };

    const prizeName = prizeMap[record.prize] || `Prize #${record.prize}`;

    // 获取链上交易哈希（如果存在）
    const txQuery = 'SELECT tx_hash FROM lottery_records WHERE id = ?';
    const [txRows] = await pool.execute(txQuery, [record_id]);
    const txHash = (txRows[0] && txRows[0].tx_hash) ? txRows[0].tx_hash : null;

    // 发送邮件（失败不应阻断业务流程，记录日志）
    try {
      await sendPrizeEmail({
        to: email,
        walletAddress: wallet_address.toLowerCase(),
        txHash,
        prizeName,
      });
      console.log('Prize email sent to', email);
    } catch (mailErr) {
      console.warn('发送邮件失败（不阻断接口返回）:', mailErr.message || mailErr);
    }

    res.json({ ok: true, message: '邮箱地址更新成功，并已发送确认邮件' });
  } catch (err) {
    console.error('更新邮箱地址失败:', err);
    res.status(500).json({ error: '服务器更新失败', detail: String(err.message || err) });
  }
});

// 标记中奖记录为已领取
app.post('/api/lottery/claim', async (req, res) => {
  const { record_id, wallet_address, email } = req.body || {};
  
  if (!record_id || !wallet_address || !email) {
    return res.status(400).json({ error: '缺少必需参数: record_id, wallet_address, email' });
  }
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  
  // 验证钱包地址格式
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
    return res.status(400).json({ error: '钱包地址格式不正确' });
  }

  try {
    const pool = getPool();
    
    // 验证记录是否属于该钱包地址且为一二三等奖
    const checkSql = `
      SELECT id, prize, claim_status FROM lottery_records 
      WHERE id = ? AND wallet_address = ?
    `;
    const [checkRows] = await pool.execute(checkSql, [record_id, wallet_address.toLowerCase()]);
    
    if (checkRows.length === 0) {
      return res.status(404).json({ error: '未找到对应的中奖记录' });
    }
    
    const record = checkRows[0];
    
    // 只有一二三等奖才能领取 (奖项ID: 0=一等奖, 1=二等奖, 2=三等奖)
    if (record.prize === null || record.prize === undefined || record.prize < 0 || record.prize > 2) {
      return res.status(400).json({ error: '只有一二三等奖可以领取' });
    }
    
    // 检查是否已经领取
    if (record.claim_status === 'claimed') {
      return res.status(400).json({ error: '该奖品已经领取过了' });
    }
    
    // 更新为已领取状态并保存邮箱
    const updateSql = `
      UPDATE lottery_records 
      SET email = ?, claim_status = 'claimed', claimed_at = NOW(), updated_at = NOW()
      WHERE id = ? AND wallet_address = ?
    `;
    const [result] = await pool.execute(updateSql, [email, record_id, wallet_address.toLowerCase()]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '领取失败，记录不存在' });
    }
    
    // TODO: 这里可以添加发送邮件的逻辑
    console.log(`中奖记录 ${record_id} 已标记为领取，邮箱: ${email}`);
    
    res.json({ 
      ok: true, 
      message: '领取成功！我们将通过邮件联系您安排奖品发放。',
      email: email
    });
  } catch (err) {
    console.error('领取奖品失败:', err);
    res.status(500).json({ error: '服务器处理失败', detail: String(err.message || err) });
  }
});

ensureSchema().finally(() => {
  app.listen(PORT, () => {
    console.log(`Xwawa Lottery API running on http://localhost:${PORT}`);
  });
});