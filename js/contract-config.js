// 合约前端配置（非打包版）
// 说明：此文件用于在开发环境下提供 ContractConfig，避免 404 导致页面功能不可用。
// 生产环境可改用 dist/contract-config.min.js。

window.ContractConfig = {
  // 抽奖合约地址（已填入实际地址）
  lotteryAddress: "0xdD8ce9b7493af5A7a40e2Ca7f1c23F8d030e6c8e",
  // XWAWA 代币地址（测试网）
  xwawaTokenAddress: "0x50c7e04b3DfFab021c9Ab258D62eFb23E41DC6f4",
  // 社区金库地址
  communityTreasuryAddress: "0xCD6C5393F06dFF566f52ec2cAB51c3cA2B047dba",
  // 商城支付收款地址（可留空）
  paymentAddress: "",
  // 网络与RPC（OKX X Layer Testnet Terigon）
  rpcUrl: "https://xlayertestrpc.okx.com/terigon",
  chainId: 1952,
  // WalletConnect v2 项目ID（用于手机直连/扫码弹授权），空则回退到 v1
  // 申请地址：https://cloud.walletconnect.com/
  walletConnectProjectId: "01ee15712187949f2a2dadb65cda86ae",
  // 可选：支付成功通知的后端Webhook
  notifyWebhookUrl: "",
  // 动态加载 Lottery ABI（根目录下的 Lottery.abi）
  async loadLotteryAbi() {
    const res = await fetch('/Lottery.abi');
    if (!res.ok) throw new Error('加载 Lottery.abi 失败');
    return await res.json();
  }
};