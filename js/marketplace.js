/**
 * Xwawa 市场页面 - 核心JavaScript功能实现
 * 
 * 主要功能:
 * 1. 多语言切换系统 (中文/英文)
 * 2. 商品购买流程管理
 * 3. 支付模态框控制
 * 4. 订单创建和管理
 * 5. 支付状态检查
 * 6. 二维码生成和显示
 * 
 * 后端API集成需求:
 * - POST /api/orders - 创建订单
 * - GET /api/orders/{id}/status - 查询订单状态
 * - POST /api/payments/verify - 验证支付交易
 * - GET /api/products - 获取商品列表
 * - PUT /api/orders/{id}/complete - 完成订单
 * 
 * 智能合约集成:
 * - 监听XWAWA代币转账事件
 * - 验证支付金额和接收地址
 * - 自动确认支付状态
 * 
 * 第三方服务:
 * - QRCode.js - 二维码生成
 * - 邮件服务 - 订单确认邮件
 * - 区块链浏览器API - 交易验证
 */
document.addEventListener('DOMContentLoaded', function() {
    // 只读 Web3：商城支付无需连接钱包，用于监听收款地址余额
    let readOnlyWeb3 = null;
    let initialBalanceWei = null;

    function initReadOnlyWeb3() {
        const rpcUrl = (window.ContractConfig && window.ContractConfig.rpcUrl) || 'https://rpc.ankr.com/eth';
        try {
            readOnlyWeb3 = new Web3(rpcUrl);
            console.log('只读Web3已初始化:', rpcUrl);
        } catch (e) {
            console.error('初始化只读Web3失败:', e);
        }
    }
    
    /**
     * 多语言切换功能
     * 支持中文和英文界面切换
     * 
     * 功能特性:
     * - 动态切换页面文本内容
     * - 保存用户语言偏好
     * - 同步更新所有多语言元素
     * 
     * 后端集成:
     * - 保存用户语言偏好到数据库
     * - 根据用户偏好加载对应语言内容
     */
    const langButtons = document.querySelectorAll('.language-switcher button');
    const langElements = document.querySelectorAll('[data-en], [data-zh]');
    
    langButtons.forEach(button => {
        button.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            
            // 更新激活状态的按钮样式
            langButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 根据选择的语言更新页面文本内容
            langElements.forEach(el => {
                if (el.hasAttribute(`data-${lang}`)) {
                    el.textContent = el.getAttribute(`data-${lang}`);
                }
            });
            
            // 保存用户语言偏好到本地存储
            localStorage.setItem('marketplace-language', lang);
            
            // TODO: 发送语言偏好到后端API
            // updateUserLanguagePreference(lang);
        });
    });
    
    /**
     * 支付模态框功能管理
     * 处理商品购买流程的用户界面交互
     * 
     * 功能组件:
     * - 模态框显示/隐藏控制
     * - 商品信息展示
     * - 订单创建流程
     * - 支付状态检查
     * - 钱包地址复制功能
     */
    const modal = document.getElementById('payment-modal');
    const closeModal = document.querySelector('.close-modal');
    const buyButtons = document.querySelectorAll('.buy-button');
    const createOrderBtn = document.getElementById('create-order-btn');
    const checkPaymentBtn = document.getElementById('check-payment-btn');
    const paymentInfo = document.getElementById('payment-info');
    const customerEmail = document.getElementById('customer-email');
    const copyAddressBtn = document.getElementById('copy-address');
    
    /**
     * 购买按钮点击事件处理
     * 当用户点击商品的购买按钮时触发
     * 
     * 功能流程:
     * 1. 获取商品信息 (ID、名称、价格)
     * 2. 计算XWAWA代币数量
     * 3. 更新模态框内容
     * 4. 显示支付模态框
     * 
     * 数据属性:
     * - data-product-id: 商品唯一标识
     * - data-product-name: 商品名称
     * - data-product-price: 商品美元价格
     */
    buyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const productId = this.getAttribute('data-product-id');
            const productName = this.getAttribute('data-product-name');
            const productPrice = this.getAttribute('data-product-price');
            
            // 计算XWAWA代币数量 (简单汇率转换)
            // TODO: 从API获取实时汇率
            const tokenAmount = Math.round(parseFloat(productPrice) * 10);
            
            // 更新模态框中的商品详情
            document.getElementById('modal-product-name').textContent = productName;
            document.getElementById('modal-product-price').textContent = productPrice;
            document.getElementById('modal-token-amount').textContent = tokenAmount;
            
            // 存储商品ID用于后续订单创建
            modal.setAttribute('data-current-product-id', productId);
            
            // 显示支付模态框
            modal.style.display = 'block';
            
            // 重置模态框状态
            resetModal();
        });
    });
    
    /**
     * 模态框关闭事件处理
     * 点击关闭按钮时隐藏模态框并重置状态
     */
    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
        resetModal();
    });
    
    /**
     * 点击模态框外部区域关闭
     * 提供更好的用户体验
     */
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            resetModal();
        }
    });
    
    /**
     * 创建订单按钮点击事件
     * 验证用户邮箱并创建新订单
     * 
     * 验证流程:
     * 1. 检查邮箱格式有效性
     * 2. 调用后端API创建订单
     * 3. 生成支付地址和二维码
     * 4. 启动订单过期倒计时
     */
    createOrderBtn.addEventListener('click', async function() {
        const email = customerEmail.value;
        if (!email || !validateEmail(email)) {
            alert('请输入有效的邮箱地址');
            return;
        }
        
        // 获取当前商品ID
        const productId = modal.getAttribute('data-current-product-id');
        
        // 调用订单创建函数
        createOrder(email, productId);
    });
    
    /**
     * 检查支付状态按钮点击事件
     * 查询订单的支付状态并更新UI
     * 
     * 功能流程:
     * 1. 调用后端API查询支付状态
     * 2. 验证区块链交易
     * 3. 更新订单状态
     * 4. 发送确认邮件
     */
    checkPaymentBtn.addEventListener('click', function() {
        const orderId = document.getElementById('order-id').textContent;
        checkPaymentStatus(orderId);
    });
    
    /**
     * 复制钱包地址功能
     * 方便用户复制支付地址
     * 
     * 功能特性:
     * - 自动选择地址文本
     * - 复制到剪贴板
     * - 显示复制成功提示
     */
    copyAddressBtn.addEventListener('click', function() {
        const walletAddress = document.getElementById('wallet-address');
        walletAddress.select();
        document.execCommand('copy');
        
        // 显示复制成功提示
        this.textContent = '已复制!';
        setTimeout(() => {
            this.textContent = '复制';
        }, 2000);
    });
    
    /**
     * 邮箱格式验证函数
     * 使用正则表达式验证邮箱格式
     * @param {string} email - 待验证的邮箱地址
     * @returns {boolean} 验证结果
     */
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * 重置模态框状态
     * 清空表单数据并恢复初始UI状态
     */
    function resetModal() {
        customerEmail.value = '';
        paymentInfo.classList.add('hidden');
        createOrderBtn.classList.remove('hidden');
        checkPaymentBtn.classList.add('hidden');
        
        // 重置按钮文本
        createOrderBtn.textContent = '创建订单';
        checkPaymentBtn.textContent = '检查支付状态';
    }
    
    /**
     * 创建订单函数
     * 调用后端API创建新订单并生成支付信息
     * 
     * @param {string} email - 用户邮箱地址
     * @param {string} productId - 商品ID
     * 
     * API调用流程:
     * 1. POST /api/orders - 创建订单
     * 2. 生成唯一的支付钱包地址
     * 3. 设置订单过期时间 (15分钟)
     * 4. 生成支付二维码
     * 5. 启动倒计时器
     * 
     * 安全考虑:
     * - 每个订单使用唯一的支付地址
     * - 设置订单过期时间防止长期占用
     * - 验证邮箱格式和商品有效性
     */
    function createOrder(email, productId) {
        const productName = document.getElementById('modal-product-name').textContent;
        const productPrice = document.getElementById('modal-product-price').textContent;
        const tokenAmount = document.getElementById('modal-token-amount').textContent;
        
        // 显示加载状态
        createOrderBtn.textContent = '创建订单中...';
        createOrderBtn.disabled = true;
        
        // TODO: 替换为实际的API调用
        // const orderData = {
        //     productId: productId,
        //     customerEmail: email,
        //     productName: productName,
        //     usdPrice: productPrice,
        //     tokenAmount: tokenAmount
        // };
        // 
        // fetch('/api/orders', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(orderData)
        // })
        
        // 模拟API调用延迟
        setTimeout(() => {
            // 生成模拟订单数据 (实际应从API返回)
            const orderId = 'XW' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            const walletAddress = (window.ContractConfig && window.ContractConfig.paymentAddress) || '';
            if (!walletAddress) {
                alert('未配置支付地址。请在 js/contract-config.js 中设置 paymentAddress');
            }
            
            // 更新UI显示订单详情
            document.getElementById('order-id').textContent = orderId;
            document.getElementById('wallet-address').value = walletAddress;
            document.getElementById('payment-token-amount').textContent = tokenAmount;
            
            // 生成支付二维码
            generatePaymentQRCode(walletAddress);
            
            // 启动订单过期倒计时
            startExpiryCountdown();

            // 初始化只读Web3并开始监听收款
            initReadOnlyWeb3();
            startPaymentMonitor(orderId, email, walletAddress);
            
            // 更新UI状态：显示支付信息，隐藏创建按钮
            paymentInfo.classList.remove('hidden');
            createOrderBtn.classList.add('hidden');
            checkPaymentBtn.classList.remove('hidden');
            
            // 重置按钮状态
            createOrderBtn.textContent = '创建订单';
            createOrderBtn.disabled = false;
            
            console.log('订单创建成功:', { orderId, email, productId });
            
        }, 1500);
    }
    
    /**
     * 生成支付地址 (模拟函数)
     * 实际生产环境中应由后端安全生成
     * @returns {string} 以太坊钱包地址
     */
    // 商城模式无需生成随机地址，固定使用配置中的收款地址
    
    /**
     * 生成支付二维码
     * 使用QRCode.js库生成包含钱包地址的二维码
     * @param {string} walletAddress - 钱包地址
     */
    function generatePaymentQRCode(walletAddress) {
        if (window.QRCode) {
            const qrCodeElement = document.getElementById('payment-qr-code');
            qrCodeElement.innerHTML = '';
            // 生成简单地址二维码；如需金额/链ID可改为 EIP-681 格式
            new QRCode(qrCodeElement, {
                text: walletAddress,
                width: 170,
                height: 170,
                colorDark: '#000000',
                colorLight: '#ffffff'
            });
        } else {
            console.error('QRCode库未加载');
        }
    }

    // 启动支付监听：轮询收款地址余额变化（10s）
    function startPaymentMonitor(orderId, email, walletAddress) {
        if (!readOnlyWeb3 || !walletAddress) return;
        try {
            readOnlyWeb3.eth.getBalance(walletAddress).then(bal => {
                initialBalanceWei = bal;
                console.log('初始余额(wei):', bal);
            }).catch(err => console.error('获取初始余额失败:', err));
        } catch (e) {
            console.error('初始化余额失败:', e);
        }

        if (window.paymentMonitorInterval) {
            clearInterval(window.paymentMonitorInterval);
        }
        window.paymentMonitorInterval = setInterval(async () => {
            try {
                const bal = await readOnlyWeb3.eth.getBalance(walletAddress);
                if (initialBalanceWei && readOnlyWeb3.utils.toBN(bal).gt(readOnlyWeb3.utils.toBN(initialBalanceWei))) {
                    clearInterval(window.paymentMonitorInterval);
                    console.log('检测到收款到账:', bal);
                    try {
                        await notifyPaymentReceived(orderId, email, walletAddress, bal);
                    } catch (notifyErr) {
                        console.warn('通知后端失败:', notifyErr);
                    }
                    alert('已检测到收款到账，确认邮件已发送。');
                    modal.style.display = 'none';
                    resetModal();
                }
            } catch (pollErr) {
                console.error('轮询余额失败:', pollErr);
            }
        }, 10000);
    }

    async function notifyPaymentReceived(orderId, email, walletAddress, balanceWei) {
        const webhook = (window.ContractConfig && window.ContractConfig.notifyWebhookUrl) || '';
        if (!webhook) {
            console.log('未配置支付通知Webhook，跳过后端通知。');
            return;
        }
        const payload = {
            orderId,
            email,
            walletAddress,
            balanceWei,
            chainId: (window.ContractConfig && window.ContractConfig.chainId) || null,
            receivedAt: new Date().toISOString()
        };
        const res = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error('通知Webhook失败: ' + res.status);
        }
    }
    
    /**
     * 检查支付状态函数
     * 查询区块链交易状态并更新订单状态
     * 
     * API调用流程:
     * 1. GET /api/orders/{orderId}/payment-status - 查询支付状态
     * 2. 验证区块链交易哈希
     * 3. 检查代币转账金额和接收地址
     * 4. 更新订单状态为已支付
     * 5. 发送确认邮件给用户
     * 
     * 区块链验证:
     * - 验证交易确认数 (建议至少6个确认)
     * - 检查转账金额是否匹配
     * - 验证接收地址是否正确
     * - 检查交易时间是否在订单有效期内
     */
    async function checkPaymentStatus() {
        const orderId = document.getElementById('order-id').textContent;
        const walletAddress = document.getElementById('wallet-address').value;
        
        checkPaymentBtn.textContent = '检查中...';
        checkPaymentBtn.disabled = true;
        try {
            if (!readOnlyWeb3) initReadOnlyWeb3();
            const bal = await readOnlyWeb3.eth.getBalance(walletAddress);
            if (initialBalanceWei && readOnlyWeb3.utils.toBN(bal).gt(readOnlyWeb3.utils.toBN(initialBalanceWei))) {
                await notifyPaymentReceived(orderId, customerEmail.value, walletAddress, bal);
                alert('已检测到收款到账，确认邮件已发送。');
                modal.style.display = 'none';
                resetModal();
            } else {
                alert('暂未检测到支付，请稍后重试。');
            }
        } catch (e) {
            console.error('检查支付失败:', e);
            alert('检查支付失败：' + (e?.message || '未知错误'));
        }
        checkPaymentBtn.textContent = '检查支付状态';
        checkPaymentBtn.disabled = false;
    }
    
    /**
     * 启动订单过期倒计时
     * 15分钟倒计时，过期后订单自动失效
     * 
     * 功能特性:
     * - 实时显示剩余时间 (MM:SS格式)
     * - 过期后显示红色"已过期"文本
     * - 自动清理定时器防止内存泄漏
     * 
     * 安全考虑:
     * - 前端倒计时仅用于用户体验
     * - 实际过期验证应在后端进行
     * - 过期订单应自动释放支付地址
     */
    function startExpiryCountdown() {
        let minutes = 15; // 订单有效期15分钟
        let seconds = 0;
        const expiryElement = document.getElementById('expiry-time');
        
        const countdownInterval = setInterval(() => {
            // 检查是否已过期
            if (minutes === 0 && seconds === 0) {
                clearInterval(countdownInterval);
                expiryElement.textContent = '已过期';
                expiryElement.style.color = 'red';
                
                // TODO: 过期处理
                // - 禁用支付按钮
                // - 显示重新创建订单选项
                // - 通知后端释放支付地址
                
                console.log('订单已过期');
                return;
            }
            
            // 倒计时逻辑
            if (seconds === 0) {
                minutes--;
                seconds = 59;
            } else {
                seconds--;
            }
            
            // 更新显示 (MM:SS格式)
            const displayMinutes = minutes.toString().padStart(2, '0');
            const displaySeconds = seconds.toString().padStart(2, '0');
            expiryElement.textContent = `${displayMinutes}:${displaySeconds}`;
            
            // 最后5分钟显示警告颜色
            if (minutes < 5) {
                expiryElement.style.color = '#ff6b35';
            }
            
        }, 1000);
        
        // 存储定时器ID以便后续清理
        window.currentCountdownInterval = countdownInterval;
    }
});