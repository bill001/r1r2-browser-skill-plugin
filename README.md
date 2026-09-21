# R1R2 浏览器技能 (r1r2-browser-skill)

<p align="center">
  <strong>让 AI Agent 操作你已登录的浏览器，不中断你的工作。</strong>
</p>

**R1R2 浏览器技能** 将 ARCA.CSR.智驱 桌面智能体连接到你已登录的浏览器。
Agent 可以填写表单、审核资料、采集数据——一切都在独立的 Agent Window 中进行，
不影响你的正常浏览。

## 快速开始

### 1. 安装插件包

在 ARCA.CSR.智驱 桌面端：**设置 → 插件 → 安装**

粘贴本仓库 GitHub URL：
```
https://github.com/r1r2/r1r2-browser-skill-plugin
```

点击安装即可。插件包会自动下载 `r1r2-bsk` CLI 二进制和 MCP Server。

### 2. 安装浏览器扩展

安装插件包后，按提示在浏览器中安装扩展：

| 浏览器 | 安装地址 |
|--------|---------|
| Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/hhcmgoofomhgciiibhipgmgkgnoenaoi) |
| Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/browserskill/emacgiaaaiojkkpkddmmdfhmokgmnikg) |

安装后打开扩展弹窗，确认 **Connected** 状态。

### 3. 验证

```bash
r1r2-bsk doctor
```

所有检查项通过即可开始使用。

## 使用方式

在 ARCA.CSR 对话中直接用自然语言描述任务：

```
帮我打开 example.com 并总结页面内容
```

```
对我已打开的教育局网页进行职称申报资料审核
```

```
帮我填写 ICP 年报表单，企业信息如下：...
```

或显式调用：
```
/r1r2-browser-skill 打开 example.com 并总结页面内容
```

## 典型业务场景

| 场景 | 描述 |
|------|------|
| 🏫 职称申报审核 | 登录门户 → 提取材料数据 → 跨页对比 → 填写审核意见 → 截图存档 |
| 📋 ICP 年报填写 | 登录工信部系统 → 填写表单 → 上传材料 → 提交确认 |
| 📝 政府公文操作 | 导航目标页 → 读取数据 → 填写审批表单 → 下载归档 |
| 🔍 网站合规检查 | 遍历页面 → 截图存档 → 检查完整性 → 生成报告 |

## 安全须知

| 规则 | 说明 |
|------|------|
| 🔒 登录态复用 | Agent 使用你已登录的浏览器，**不存储密码** |
| 👁️ 标签借用确认 | 默认需确认才能借用你的标签页 |
| 🤝 人机协作 | 验证码/登录/确认对话框会暂停等你处理 |
| 📋 操作审计 | 所有操作记录在 `~/.r1r2-bsk/`，保留 30 天 |
| 🚫 不提取凭证 | Agent 绝不提取 cookies、tokens、密码 |

## 架构

```
ARCA.CSR.智驱 → MCP Server (Node.js) → r1r2-bsk CLI/daemon (Rust)
                                              ↕ WebSocket (localhost)
                                       Chrome Extension (MV3)
                                              ↕
                                       Agent Window (已登录浏览器)
```

| 组件 | 品牌 | 来源 |
|------|------|------|
| 插件包 | R1R2 | 本仓库 |
| r1r2-bsk CLI/daemon | R1R2 | fork 自 BrowserSkill，品牌替换 |
| Chrome Extension | BrowserSkill | Chrome Web Store（原版保持） |

## 许可证

MIT License — Copyright (c) 2026 重庆人一人二网络科技有限公司

基于开源项目 [BrowserSkill](https://github.com/Tencent/BrowserSkill)（MIT, Tencent）改造。
浏览器扩展组件保持原版品牌，由 BrowserSkill 开源项目维护发布。
