"use strict";

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
document.addEventListener('DOMContentLoaded', function () {
  /**
   * 多语言切换系统
   * 功能: 实现中英文界面切换，保存用户语言偏好
   * 数据存储: localStorage
   * 后端集成: 需要API保存用户偏好到服务器
   */
  var enBtn = document.getElementById('en-btn');
  var zhBtn = document.getElementById('zh-btn');
  var elementsWithLang = document.querySelectorAll('[data-en][data-zh]'); // 英文按钮点击事件

  enBtn.addEventListener('click', function () {
    setLanguage('en');
    enBtn.classList.add('active');
    zhBtn.classList.remove('active');
  }); // 中文按钮点击事件

  zhBtn.addEventListener('click', function () {
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
    elementsWithLang.forEach(function (element) {
      element.textContent = element.getAttribute("data-".concat(lang));
    });
    localStorage.setItem('xwawa-language', lang); // TODO: 如果用户已登录，保存到服务器
    // if (window.userLoggedIn) {
    //     saveLanguagePreference(lang);
    // }
  } // 检查并应用保存的语言偏好，默认为英语


  var savedLanguage = localStorage.getItem('xwawa-language') || 'en';

  if (savedLanguage === 'zh') {
    zhBtn.click();
  } else {
    enBtn.click();
  }
  /**
   * 移动端菜单系统
   * 功能: 为小屏幕设备提供可折叠的导航菜单
   * 特性: 动画效果、点击外部关闭、链接点击自动关闭
   */


  var mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  var body = document.body;

  if (mobileMenuBtn) {
    // Create mobile menu
    var mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu'; // Clone navigation

    var nav = document.querySelector('nav');

    if (nav) {
      var navClone = nav.cloneNode(true);
      mobileMenu.appendChild(navClone);
    } // Add close button


    var closeBtn = document.createElement('div');
    closeBtn.className = 'close-menu';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    mobileMenu.appendChild(closeBtn); // Append to body

    body.appendChild(mobileMenu); // Toggle mobile menu

    mobileMenuBtn.addEventListener('click', function () {
      mobileMenu.classList.add('active');
    });
    closeBtn.addEventListener('click', function () {
      mobileMenu.classList.remove('active');
    }); // Close menu when clicking on a link

    var mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('active');
      });
    });
  } // Smooth scrolling for anchor links


  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var targetElement = document.querySelector(targetId);

      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    });
  }); // Animation on scroll

  var animateOnScroll = function animateOnScroll() {
    var elements = document.querySelectorAll('.feature-card, .section-title, .about-content, .stat-item');
    elements.forEach(function (element) {
      var elementPosition = element.getBoundingClientRect().top;
      var windowHeight = window.innerHeight;

      if (elementPosition < windowHeight - 100) {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }
    });
  }; // Set initial styles for animation


  document.querySelectorAll('.feature-card, .section-title, .about-content, .stat-item').forEach(function (element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  }); // Run animation on load and scroll

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

  var carousel = document.querySelector('.art-carousel-slides');
  var slides = document.querySelectorAll('.art-slide');
  var indicators = document.querySelectorAll('.art-indicator');
  var prevBtn = document.querySelector('.art-carousel-btn.art-prev-btn');
  var nextBtn = document.querySelector('.art-carousel-btn.art-next-btn');

  if (carousel && slides.length > 0) {
    /**
     * 更新轮播图显示状态
     * 功能: 同步更新轮播图位置、指示器状态和幻灯片激活状态
     */
    var updateCarousel = function updateCarousel() {
      var translateX = -currentSlide * (100 / totalSlides);
      carousel.style.transform = "translateX(".concat(translateX, "%)"); // 更新指示器激活状态

      indicators.forEach(function (indicator, index) {
        indicator.classList.toggle('active', index === currentSlide);
      }); // 更新幻灯片激活状态 (用于CSS动画)

      slides.forEach(function (slide, index) {
        slide.classList.toggle('active', index === currentSlide);
      });
    }; // 下一张


    var nextSlide = function nextSlide() {
      currentSlide = (currentSlide + 1) % totalSlides;
      updateCarousel();
    }; // 上一张


    var prevSlide = function prevSlide() {
      currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
      updateCarousel();
    }; // 跳转到指定幻灯片


    var goToSlide = function goToSlide(index) {
      currentSlide = index;
      updateCarousel();
    }; // 绑定事件


    var startAutoPlay = function startAutoPlay() {
      autoPlayInterval = setInterval(nextSlide, 5000); // 每5秒切换
    };

    var stopAutoPlay = function stopAutoPlay() {
      clearInterval(autoPlayInterval);
    }; // 鼠标悬停时停止自动播放


    var currentSlide = 0;
    var totalSlides = slides.length;

    if (nextBtn) {
      nextBtn.addEventListener('click', nextSlide);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', prevSlide);
    } // 绑定指示器点击事件


    indicators.forEach(function (indicator, index) {
      indicator.addEventListener('click', function () {
        return goToSlide(index);
      });
    }); // 自动播放（可选）

    var autoPlayInterval;
    var carouselContainer = document.querySelector('.art-carousel-container');

    if (carouselContainer) {
      carouselContainer.addEventListener('mouseenter', stopAutoPlay);
      carouselContainer.addEventListener('mouseleave', startAutoPlay);
    } // 初始化


    updateCarousel();
    startAutoPlay(); // 键盘导航

    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    });
  }
  /**
   * 实时价格更新系统
   * 功能: 每30秒更新XWAWA、BTC、OKB价格
   * 数据来源:
   * - XWAWA: DexScreener API（按代币地址聚合）
   * - BTC、OKB: OKX API
   */
  // 价格数据缓存


  var priceData = {
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
   * 获取XWAWA代币价格（DexScreener 实时数据）
   * 依据合约地址选择流动性最高的交易对，读取 `priceUsd` 与 24h 涨跌幅
   */

  function fetchXwawaPrice() {
    var getBestPairByDexScreener, tokenAddress, bestPair, currentPrice, change24h, open;
    return regeneratorRuntime.async(function fetchXwawaPrice$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.prev = 0;

            // 优先使用 DexScreener 搜索端点，找不到再回退到 tokens 端点
            getBestPairByDexScreener = function getBestPairByDexScreener(addr) {
              var endpoints, pairs, _i, _endpoints, url, res, data, candidate;

              return regeneratorRuntime.async(function getBestPairByDexScreener$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      endpoints = ["https://api.dexscreener.com/latest/dex/search?q=".concat(0x095c1a875b985be6e2c86b2cae0b66a3df702e6a), "https://api.dexscreener.com/latest/dex/tokens/".concat(0x095c1a875b985be6e2c86b2cae0b66a3df702e6a)];
                      pairs = [];
                      _i = 0, _endpoints = endpoints;

                    case 3:
                      if (!(_i < _endpoints.length)) {
                        _context.next = 24;
                        break;
                      }

                      url = _endpoints[_i];
                      _context.prev = 5;
                      _context.next = 8;
                      return regeneratorRuntime.awrap(fetch(url));

                    case 8:
                      res = _context.sent;
                      _context.next = 11;
                      return regeneratorRuntime.awrap(res.json());

                    case 11:
                      data = _context.sent;
                      candidate = Array.isArray(data.pairs) ? data.pairs : [];

                      if (!(candidate.length > 0)) {
                        _context.next = 16;
                        break;
                      }

                      pairs = candidate;
                      return _context.abrupt("break", 24);

                    case 16:
                      _context.next = 21;
                      break;

                    case 18:
                      _context.prev = 18;
                      _context.t0 = _context["catch"](5);
                      console.warn('DexScreener 请求失败，尝试下一个端点:', url, _context.t0);

                    case 21:
                      _i++;
                      _context.next = 3;
                      break;

                    case 24:
                      if (pairs.length) {
                        _context.next = 26;
                        break;
                      }

                      return _context.abrupt("return", null);

                    case 26:
                      return _context.abrupt("return", pairs.reduce(function (best, cur) {
                        var bestLiq = best && best.liquidity && best.liquidity.usd ? best.liquidity.usd : 0;
                        var curLiq = cur && cur.liquidity && cur.liquidity.usd ? cur.liquidity.usd : 0;
                        return curLiq > bestLiq ? cur : best;
                      }));

                    case 27:
                    case "end":
                      return _context.stop();
                  }
                }
              }, null, null, [[5, 18]]);
            };

            // 使用用户提供的 XWAWA 合约地址，仅用于首页价格显示
            tokenAddress = '0x095c1a875b985be6e2c86b2cae0b66a3df702e6a';
            _context2.next = 5;
            return regeneratorRuntime.awrap(getBestPairByDexScreener(tokenAddress));

          case 5:
            bestPair = _context2.sent;

            if (bestPair) {
              _context2.next = 9;
              break;
            }

            console.warn('DexScreener 暂无交易对数据，保留上次有效价格', tokenAddress);
            return _context2.abrupt("return", priceData.xwawa && priceData.xwawa.lastUpdate ? priceData.xwawa : null);

          case 9:
            currentPrice = parseFloat(bestPair.priceUsd); // DexScreener 的 24h 涨跌幅字段可能是 priceChange.h24 或 priceChange24h

            change24h = 0;

            if (bestPair.priceChange && typeof bestPair.priceChange.h24 !== 'undefined') {
              change24h = parseFloat(bestPair.priceChange.h24);
            } else if (typeof bestPair.priceChange24h !== 'undefined') {
              change24h = parseFloat(bestPair.priceChange24h);
            } else {
              // 无明确字段时尝试根据 openPrice 近似计算（若存在）
              open = parseFloat(bestPair.openPrice || '0');
              change24h = open > 0 ? (currentPrice - open) / open * 100 : 0;
            }

            priceData.xwawa = {
              price: isNaN(currentPrice) ? 0 : currentPrice,
              change24h: isNaN(change24h) ? 0 : change24h,
              lastUpdate: new Date()
            };
            console.log('XWAWA价格更新:', priceData.xwawa);
            return _context2.abrupt("return", priceData.xwawa);

          case 17:
            _context2.prev = 17;
            _context2.t0 = _context2["catch"](0);
            console.error('获取XWAWA价格失败:', _context2.t0); // 回退：保留上次有效数据，避免界面显示为 NaN

            return _context2.abrupt("return", priceData.xwawa && priceData.xwawa.lastUpdate ? priceData.xwawa : null);

          case 21:
          case "end":
            return _context2.stop();
        }
      }
    }, null, null, [[0, 17]]);
  }
  /**
   * 获取比特币价格 (OKX API)
   * 使用OKX公开API获取BTC价格
   */


  function fetchBitcoinPrice() {
    var response, data, ticker, currentPrice, open24h, change24h;
    return regeneratorRuntime.async(function fetchBitcoinPrice$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.prev = 0;
            _context3.next = 3;
            return regeneratorRuntime.awrap(fetch('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT'));

          case 3:
            response = _context3.sent;
            _context3.next = 6;
            return regeneratorRuntime.awrap(response.json());

          case 6:
            data = _context3.sent;

            if (!(data.code === '0' && data.data && data.data.length > 0)) {
              _context3.next = 17;
              break;
            }

            ticker = data.data[0];
            currentPrice = parseFloat(ticker.last);
            open24h = parseFloat(ticker.open24h || '0');
            change24h = open24h > 0 ? (currentPrice - open24h) / open24h * 100 : 0;
            priceData.bitcoin = {
              price: isNaN(currentPrice) ? 0 : currentPrice,
              change24h: isNaN(change24h) ? 0 : change24h,
              lastUpdate: new Date()
            };
            console.log('比特币价格更新:', priceData.bitcoin);
            return _context3.abrupt("return", priceData.bitcoin);

          case 17:
            throw new Error('API响应格式错误');

          case 18:
            _context3.next = 24;
            break;

          case 20:
            _context3.prev = 20;
            _context3.t0 = _context3["catch"](0);
            console.error('获取比特币价格失败:', _context3.t0);
            return _context3.abrupt("return", priceData.bitcoin && priceData.bitcoin.lastUpdate ? priceData.bitcoin : null);

          case 24:
          case "end":
            return _context3.stop();
        }
      }
    }, null, null, [[0, 20]]);
  }
  /**
   * 获取OKB代币价格 (OKX API)
   * 使用OKX公开API获取OKB价格
   */


  function fetchOkbPrice() {
    var response, data, ticker, currentPrice, open24h, change24h;
    return regeneratorRuntime.async(function fetchOkbPrice$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.prev = 0;
            _context4.next = 3;
            return regeneratorRuntime.awrap(fetch('https://www.okx.com/api/v5/market/ticker?instId=OKB-USDT'));

          case 3:
            response = _context4.sent;
            _context4.next = 6;
            return regeneratorRuntime.awrap(response.json());

          case 6:
            data = _context4.sent;

            if (!(data.code === '0' && data.data && data.data.length > 0)) {
              _context4.next = 17;
              break;
            }

            ticker = data.data[0];
            currentPrice = parseFloat(ticker.last);
            open24h = parseFloat(ticker.open24h || '0');
            change24h = open24h > 0 ? (currentPrice - open24h) / open24h * 100 : 0;
            priceData.okb = {
              price: isNaN(currentPrice) ? 0 : currentPrice,
              change24h: isNaN(change24h) ? 0 : change24h,
              lastUpdate: new Date()
            };
            console.log('OKB价格更新:', priceData.okb);
            return _context4.abrupt("return", priceData.okb);

          case 17:
            throw new Error('API响应格式错误');

          case 18:
            _context4.next = 24;
            break;

          case 20:
            _context4.prev = 20;
            _context4.t0 = _context4["catch"](0);
            console.error('获取OKB价格失败:', _context4.t0);
            return _context4.abrupt("return", priceData.okb && priceData.okb.lastUpdate ? priceData.okb : null);

          case 24:
          case "end":
            return _context4.stop();
        }
      }
    }, null, null, [[0, 20]]);
  }
  /**
   * 更新页面上的价格显示
   */


  function updatePriceDisplay() {
    // 更新XWAWA价格
    var xwawaPrice = document.getElementById('xwawa-price');
    var xwawaChange = document.getElementById('xwawa-change');
    var xwawaUpdate = document.getElementById('xwawa-update');

    if (xwawaPrice && priceData.xwawa.price > 0) {
      xwawaPrice.textContent = "$".concat(priceData.xwawa.price.toFixed(4));

      if (xwawaChange) {
        var changeText = "".concat(priceData.xwawa.change24h >= 0 ? '+' : '').concat(priceData.xwawa.change24h.toFixed(2), "%");
        xwawaChange.textContent = changeText;
        xwawaChange.className = "price-change ".concat(priceData.xwawa.change24h >= 0 ? 'positive' : 'negative');
      }

      if (xwawaUpdate) {
        xwawaUpdate.textContent = "\u66F4\u65B0\u65F6\u95F4: ".concat(priceData.xwawa.lastUpdate.toLocaleTimeString());
      }
    } // 更新比特币价格


    var btcPrice = document.getElementById('btc-price');
    var btcChange = document.getElementById('btc-change');
    var btcUpdate = document.getElementById('btc-update');

    if (btcPrice && priceData.bitcoin.price > 0) {
      btcPrice.textContent = "$".concat(priceData.bitcoin.price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));

      if (btcChange) {
        var _changeText = "".concat(priceData.bitcoin.change24h >= 0 ? '+' : '').concat(priceData.bitcoin.change24h.toFixed(2), "%");

        btcChange.textContent = _changeText;
        btcChange.className = "price-change ".concat(priceData.bitcoin.change24h >= 0 ? 'positive' : 'negative');
      }

      if (btcUpdate) {
        btcUpdate.textContent = "\u66F4\u65B0\u65F6\u95F4: ".concat(priceData.bitcoin.lastUpdate.toLocaleTimeString());
      }
    } // 更新OKB价格


    var okbPrice = document.getElementById('okb-price');
    var okbChange = document.getElementById('okb-change');
    var okbUpdate = document.getElementById('okb-update');

    if (okbPrice && priceData.okb.price > 0) {
      okbPrice.textContent = "$".concat(priceData.okb.price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));

      if (okbChange) {
        var _changeText2 = "".concat(priceData.okb.change24h >= 0 ? '+' : '').concat(priceData.okb.change24h.toFixed(2), "%");

        okbChange.textContent = _changeText2;
        okbChange.className = "price-change ".concat(priceData.okb.change24h >= 0 ? 'positive' : 'negative');
      }

      if (okbUpdate) {
        okbUpdate.textContent = "\u66F4\u65B0\u65F6\u95F4: ".concat(priceData.okb.lastUpdate.toLocaleTimeString());
      }
    }
  }
  /**
   * 获取所有价格数据
   */


  function updateAllPrices() {
    var promises;
    return regeneratorRuntime.async(function updateAllPrices$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            console.log('开始更新价格数据...'); // 并行获取三个价格

            promises = [fetchXwawaPrice(), fetchBitcoinPrice(), fetchOkbPrice()];
            _context5.prev = 2;
            _context5.next = 5;
            return regeneratorRuntime.awrap(Promise.all(promises));

          case 5:
            updatePriceDisplay();
            console.log('价格数据更新完成');
            _context5.next = 12;
            break;

          case 9:
            _context5.prev = 9;
            _context5.t0 = _context5["catch"](2);
            console.error('价格更新失败:', _context5.t0);

          case 12:
          case "end":
            return _context5.stop();
        }
      }
    }, null, null, [[2, 9]]);
  }
  /**
   * 初始化价格更新系统
   */


  function initializePriceUpdates() {
    // 检查价格显示区域是否存在
    var priceDisplay = document.querySelector('.price-display');

    if (!priceDisplay) {
      console.log('价格显示区域不存在，跳过价格更新初始化');
      return;
    }

    console.log('初始化价格更新系统...'); // 立即更新一次

    updateAllPrices(); // 设置定时更新 (每30秒)

    setInterval(updateAllPrices, 30000);
    console.log('价格更新系统已启动，每30秒更新一次');
  } // 初始化价格更新系统


  initializePriceUpdates();
});
//# sourceMappingURL=script.dev.js.map
