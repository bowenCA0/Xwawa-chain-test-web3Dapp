/**
 * Xwawa 项目 - 通用JavaScript功能模块
 * 
 * 主要功能:
 * 1. 多语言切换系统 - 支持中英文动态切换
 * 2. 移动端菜单 - 响应式导航菜单
 * 3. 平滑滚动 - 锚点链接平滑滚动效果
 * 4. 滚动动画 - 元素进入视窗时的动画效果
 * 5. 艺术展示轮播图 - 主页艺术作品展示功能
 * 
 * 后端API集成需求:
 * - POST /api/user/preferences - 保存用户语言偏好
 * - GET /api/artworks - 获取艺术作品数据
 * 
 * 依赖项:
 * - Font Awesome (图标库)
 * - CSS动画支持
 * 
 * 浏览器兼容性:
 * - 现代浏览器 (ES6+)
 * - 移动端浏览器
 */

document.addEventListener('DOMContentLoaded', function() {
    
    /**
     * 多语言切换系统
     * 功能: 实现中英文界面切换，保存用户语言偏好
     * 数据存储: localStorage
     * 后端集成: 需要API保存用户偏好到服务器
     */
    const enBtn = document.getElementById('en-btn');
    const zhBtn = document.getElementById('zh-btn');
    const elementsWithLang = document.querySelectorAll('[data-en][data-zh]');

    // 英文按钮点击事件
    enBtn.addEventListener('click', function() {
        setLanguage('en');
        enBtn.classList.add('active');
        zhBtn.classList.remove('active');
    });

    // 中文按钮点击事件
    zhBtn.addEventListener('click', function() {
        setLanguage('zh');
        zhBtn.classList.add('active');
        enBtn.classList.remove('active');
    });

    /**
     * 设置页面语言
     * @param {string} lang - 语言代码 ('en' 或 'zh')
     * 
     * 功能说明:
     * 1. 遍历所有带有多语言属性的元素
     * 2. 根据语言代码更新元素文本内容
     * 3. 保存语言偏好到本地存储
     * 
     * 后端集成建议:
     * - 如果用户已登录，同时调用API保存偏好到服务器
     * - API: POST /api/user/preferences {language: lang}
     */
    function setLanguage(lang) {
        elementsWithLang.forEach(element => {
            element.textContent = element.getAttribute(`data-${lang}`);
        });
        localStorage.setItem('xwawa-language', lang);
        
        // TODO: 如果用户已登录，保存到服务器
        // if (window.userLoggedIn) {
        //     saveLanguagePreference(lang);
        // }
    }

    // 检查并应用保存的语言偏好
    const savedLanguage = localStorage.getItem('xwawa-language');
    if (savedLanguage) {
        if (savedLanguage === 'zh') {
            zhBtn.click();
        } else {
            enBtn.click();
        }
    }

    /**
     * 移动端菜单系统
     * 功能: 为小屏幕设备提供可折叠的导航菜单
     * 特性: 动画效果、点击外部关闭、链接点击自动关闭
     */
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const body = document.body;

    if (mobileMenuBtn) {
        // Create mobile menu
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'mobile-menu';
        
        // Clone navigation
        const nav = document.querySelector('nav');
        if (nav) {
            const navClone = nav.cloneNode(true);
            mobileMenu.appendChild(navClone);
        }
        
        // Add close button
        const closeBtn = document.createElement('div');
        closeBtn.className = 'close-menu';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        mobileMenu.appendChild(closeBtn);
        
        // Append to body
        body.appendChild(mobileMenu);
        
        // Toggle mobile menu
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.add('active');
        });
        
        closeBtn.addEventListener('click', function() {
            mobileMenu.classList.remove('active');
        });
        
        // Close menu when clicking on a link
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active');
            });
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animation on scroll
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.feature-card, .section-title, .about-content, .stat-item');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight - 100) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };

    // Set initial styles for animation
    document.querySelectorAll('.feature-card, .section-title, .about-content, .stat-item').forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });

    // Run animation on load and scroll
    window.addEventListener('load', animateOnScroll);
    window.addEventListener('scroll', animateOnScroll);

    /**
     * 艺术展示轮播图功能
     * 功能: 主页艺术作品展示的交互式轮播图
     * 
     * 特性:
     * - 自动播放 (5秒间隔)
     * - 手动导航 (前进/后退按钮)
     * - 指示器点击跳转
     * - 键盘导航 (左右箭头键)
     * - 鼠标悬停暂停自动播放
     * - 响应式设计
     * 
     * 后端集成:
     * - 艺术作品数据应从API获取: GET /api/artworks
     * - 支持动态加载更多作品
     * - 图片懒加载优化
     */
    const carousel = document.querySelector('.art-carousel-slides');
    const slides = document.querySelectorAll('.art-slide');
    const indicators = document.querySelectorAll('.art-indicator');
    const prevBtn = document.querySelector('.art-prev-btn');
    const nextBtn = document.querySelector('.art-next-btn');
    
    if (carousel && slides.length > 0) {
        let currentSlide = 0;
        const totalSlides = slides.length;

        /**
         * 更新轮播图显示状态
         * 功能: 同步更新轮播图位置、指示器状态和幻灯片激活状态
         */
        function updateCarousel() {
            const translateX = -currentSlide * (100 / totalSlides);
            carousel.style.transform = `translateX(${translateX}%)`;
            
            // 更新指示器激活状态
            indicators.forEach((indicator, index) => {
                indicator.classList.toggle('active', index === currentSlide);
            });
            
            // 更新幻灯片激活状态 (用于CSS动画)
            slides.forEach((slide, index) => {
                slide.classList.toggle('active', index === currentSlide);
            });
        }

        // 下一张
        function nextSlide() {
            currentSlide = (currentSlide + 1) % totalSlides;
            updateCarousel();
        }

        // 上一张
        function prevSlide() {
            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            updateCarousel();
        }

        // 跳转到指定幻灯片
        function goToSlide(index) {
            currentSlide = index;
            updateCarousel();
        }

        // 绑定事件
        if (nextBtn) {
            nextBtn.addEventListener('click', nextSlide);
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', prevSlide);
        }

        // 绑定指示器点击事件
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => goToSlide(index));
        });

        // 自动播放（可选）
        let autoPlayInterval;
        
        function startAutoPlay() {
            autoPlayInterval = setInterval(nextSlide, 5000); // 每5秒切换
        }
        
        function stopAutoPlay() {
            clearInterval(autoPlayInterval);
        }

        // 鼠标悬停时停止自动播放
        const carouselContainer = document.querySelector('.art-carousel-container');
        if (carouselContainer) {
            carouselContainer.addEventListener('mouseenter', stopAutoPlay);
            carouselContainer.addEventListener('mouseleave', startAutoPlay);
        }

        // 初始化
        updateCarousel();
        startAutoPlay();

        // 键盘导航
        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft') {
                prevSlide();
            } else if (e.key === 'ArrowRight') {
                nextSlide();
            }
        });
    }

    /**
     * 实时价格更新系统
     * 功能: 每30秒更新XWAWA代币和比特币价格
     * 数据来源: 
     * - XWAWA代币: 模拟API (实际项目中需要连接真实的DEX API)
     * - 比特币: OKX API
     */
    
    // 价格数据缓存
    let priceData = {
        xwawa: {
            price: 0.0,
            change24h: 0.0,
            lastUpdate: null
        },
        bitcoin: {
            price: 0.0,
            change24h: 0.0,
            lastUpdate: null
        },
        okb: {
            price: 0.0,
            change24h: 0.0,
            lastUpdate: null
        }
    };

    /**
     * 获取XWAWA代币价格 (模拟数据)
     * 实际项目中需要连接到DEX API或代币交易所API
     */
    async function fetchXwawaPrice() {
        try {
            // 模拟API调用 - 实际项目中替换为真实API
            // 例如: const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/YOUR_TOKEN_ADDRESS');
            
            // 模拟价格波动
            const basePrice = 0.0234; // 基础价格
            const volatility = 0.1; // 10% 波动率
            const randomChange = (Math.random() - 0.5) * volatility;
            const currentPrice = basePrice * (1 + randomChange);
            
            // 模拟24小时变化
            const change24h = (Math.random() - 0.5) * 20; // -10% 到 +10%
            
            priceData.xwawa = {
                price: currentPrice,
                change24h: change24h,
                lastUpdate: new Date()
            };
            
            console.log('XWAWA价格更新:', priceData.xwawa);
            return priceData.xwawa;
            
        } catch (error) {
            console.error('获取XWAWA价格失败:', error);
            return null;
        }
    }

    /**
     * 获取比特币价格 (OKX API)
     * 使用OKX公开API获取BTC价格
     */
    async function fetchBitcoinPrice() {
        try {
            // 使用OKX公开API
            const response = await fetch('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT');
            const data = await response.json();
            
            if (data.code === '0' && data.data && data.data.length > 0) {
                const ticker = data.data[0];
                const currentPrice = parseFloat(ticker.last);
                const change24h = parseFloat(ticker.changePercent) * 100;
                
                priceData.bitcoin = {
                    price: currentPrice,
                    change24h: change24h,
                    lastUpdate: new Date()
                };
                
                console.log('比特币价格更新:', priceData.bitcoin);
                return priceData.bitcoin;
            } else {
                throw new Error('API响应格式错误');
            }
            
        } catch (error) {
            console.error('获取比特币价格失败:', error);
            
            // 备用方案：使用模拟数据
            const basePrice = 43000; // 基础价格
            const volatility = 0.05; // 5% 波动率
            const randomChange = (Math.random() - 0.5) * volatility;
            const currentPrice = basePrice * (1 + randomChange);
            const change24h = (Math.random() - 0.5) * 10; // -5% 到 +5%
            
            priceData.bitcoin = {
                price: currentPrice,
                change24h: change24h,
                lastUpdate: new Date()
            };
            
            return priceData.bitcoin;
        }
    }

    /**
     * 获取OKB代币价格 (OKX API)
     * 使用OKX公开API获取OKB价格
     */
    async function fetchOkbPrice() {
        try {
            // 使用OKX公开API获取OKB价格
            const response = await fetch('https://www.okx.com/api/v5/market/ticker?instId=OKB-USDT');
            const data = await response.json();
            
            if (data.code === '0' && data.data && data.data.length > 0) {
                const ticker = data.data[0];
                const currentPrice = parseFloat(ticker.last);
                const change24h = parseFloat(ticker.changePercent) * 100;
                
                priceData.okb = {
                    price: currentPrice,
                    change24h: change24h,
                    lastUpdate: new Date()
                };
                
                console.log('OKB价格更新:', priceData.okb);
                return priceData.okb;
            } else {
                throw new Error('API响应格式错误');
            }
            
        } catch (error) {
            console.error('获取OKB价格失败:', error);
            
            // 备用方案：使用模拟数据
            const basePrice = 45.50; // OKB基础价格
            const volatility = 0.08; // 8% 波动率
            const randomChange = (Math.random() - 0.5) * volatility;
            const currentPrice = basePrice * (1 + randomChange);
            const change24h = (Math.random() - 0.5) * 15; // -7.5% 到 +7.5%
            
            priceData.okb = {
                price: currentPrice,
                change24h: change24h,
                lastUpdate: new Date()
            };
            
            return priceData.okb;
        }
    }

    /**
     * 更新页面上的价格显示
     */
    function updatePriceDisplay() {
        // 更新XWAWA价格
        const xwawaPrice = document.getElementById('xwawa-price');
        const xwawaChange = document.getElementById('xwawa-change');
        const xwawaUpdate = document.getElementById('xwawa-time');
        
        if (xwawaPrice && priceData.xwawa.price > 0) {
            xwawaPrice.textContent = `$${priceData.xwawa.price.toFixed(4)}`;
            
            if (xwawaChange) {
                const changeText = `${priceData.xwawa.change24h >= 0 ? '+' : ''}${priceData.xwawa.change24h.toFixed(2)}%`;
                xwawaChange.textContent = changeText;
                xwawaChange.className = `price-change ${priceData.xwawa.change24h >= 0 ? 'positive' : 'negative'}`;
            }
            
            if (xwawaUpdate) {
                xwawaUpdate.textContent = priceData.xwawa.lastUpdate.toLocaleTimeString();
            }
        }
        
        // 更新比特币价格
        const btcPrice = document.getElementById('btc-price');
        const btcChange = document.getElementById('btc-change');
        const btcUpdate = document.getElementById('btc-update');
        
        if (btcPrice && priceData.bitcoin.price > 0) {
            btcPrice.textContent = `$${priceData.bitcoin.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            
            if (btcChange) {
                const changeText = `${priceData.bitcoin.change24h >= 0 ? '+' : ''}${priceData.bitcoin.change24h.toFixed(2)}%`;
                btcChange.textContent = changeText;
                btcChange.className = `price-change ${priceData.bitcoin.change24h >= 0 ? 'positive' : 'negative'}`;
            }
            
            if (btcUpdate) {
                btcUpdate.textContent = `更新时间: ${priceData.bitcoin.lastUpdate.toLocaleTimeString()}`;
            }
        }
        
        // 更新OKB价格
        const okbPrice = document.getElementById('okb-price');
        const okbChange = document.getElementById('okb-change');
        const okbUpdate = document.getElementById('okb-update');
        
        if (okbPrice && priceData.okb.price > 0) {
            okbPrice.textContent = `$${priceData.okb.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            
            if (okbChange) {
                const changeText = `${priceData.okb.change24h >= 0 ? '+' : ''}${priceData.okb.change24h.toFixed(2)}%`;
                okbChange.textContent = changeText;
                okbChange.className = `price-change ${priceData.okb.change24h >= 0 ? 'positive' : 'negative'}`;
            }
            
            if (okbUpdate) {
                okbUpdate.textContent = `更新时间: ${priceData.okb.lastUpdate.toLocaleTimeString()}`;
            }
        }
    }

    /**
     * 获取所有价格数据
     */
    async function updateAllPrices() {
        console.log('开始更新价格数据...');
        
        // 并行获取三个价格
        const promises = [
            fetchXwawaPrice(),
            fetchBitcoinPrice(),
            fetchOkbPrice()
        ];
        
        try {
            await Promise.all(promises);
            updatePriceDisplay();
            console.log('价格数据更新完成');
        } catch (error) {
            console.error('价格更新失败:', error);
        }
    }

    /**
     * 初始化价格更新系统
     */
    function initializePriceUpdates() {
        // 检查价格显示区域是否存在
        const priceDisplay = document.querySelector('.price-display');
        if (!priceDisplay) {
            console.log('价格显示区域不存在，跳过价格更新初始化');
            return;
        }
        
        console.log('初始化价格更新系统...');
        
        // 立即更新一次
        updateAllPrices();
        
        // 设置定时更新 (每30秒)
        setInterval(updateAllPrices, 30000);
        
        console.log('价格更新系统已启动，每30秒更新一次');
    }

    // 初始化价格更新系统
    initializePriceUpdates();
});