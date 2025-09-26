最小可行的本地测试流程（建议用以太坊测试网 Sepolia）：

- 准备
  - 安装 MetaMask（桌面 Chrome 扩展或手机 App 内置浏览器均可），网络切到 Sepolia。
  - 领取少量 SepoliaETH（用于 Gas）。
  - 确保你有测试版 XWAWA ERC‑20 和对应的 Lottery 合约（Lottery 内的 `XWAWA_COIN()` 必须返回该代币地址）。如果没有，可按 `docs/SMART_CONTRACTS.md` 用 Hardhat 在 Sepolia 部署两份合约。

- 配置前端
  - 在文件 `js/lottery.js` 中，设置真实的 Lottery 合约地址：
    - 找到 `const lotteryContractAddress = "0x..."`，替换为你部署在 Sepolia 的 Lottery 地址。
    - 代币地址不用填，前端会通过 `XWAWA_COIN()` 自动读取。
  - 确保 `Lottery.abi` 是与你部署合约匹配的 ABI（我们已改为前端动态加载该文件）。

- 启动本地服务并打开页面
  - 在项目根目录起一个静态服务，例如：
    ```bash
    python -m http.server 8000
    ```
  - 打开 `http://localhost:8000/lottery.html`。

- 测试步骤
  - 点击 “Connect Wallet” 连接 MetaMask（不输入私钥，钱包弹窗确认即可）。
  - 页面会读取 `drawCost()` 并显示“每次抽奖花费”。
  - 点击“转动转盘”：
    - 首次通常两笔交易：先 `approve(授权)`，再 `draw(抽奖)`；你需要在 MetaMask 分别确认。
    - 授权额度足够时，后续通常只需确认 `draw`。
  - 看到转盘动画与结果弹窗，表示链上流程成功。

- 控制台快速验证（可选）
  - 打开浏览器控制台（F12），有内置测试方法：
    ```javascript
    await XwawaTest.getDrawCost()            // 读取抽奖费用
    await XwawaTest.getBalance()             // 读取你地址的 XWAWA 余额
    await XwawaTest.getPrizePool()           // 读取奖池（合约持有的代币余额）
    await XwawaTest.draw(1)                  // 抽 1 次（会弹钱包确认）
    await XwawaTest.getUserDrawHistory({fromBlock: 0})
    ```

- 使用什么网络和代币
  - 网络：推荐 Sepolia 测试网（或你实际部署到的测试网）。
  - 代币：你的测试版 XWAWA（ERC‑20）代币；钱包里要有一定数量的 XWAWA 才能抽奖。
  - Gas：需要少量 SepoliaETH 用于支付授权与抽奖交易的 Gas。
