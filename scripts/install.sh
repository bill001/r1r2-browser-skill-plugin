#!/bin/sh
# install.sh — R1R2 浏览器技能插件包安装后置脚本
# 职责：
#   1. 检测平台，下载对应 r1r2-bsk 二进制到 bin/
#   2. npm install 构建 MCP Server
#   3. 创建 bin/r1r2-bsk 符号链接供 MCP Server 统一引用
#
# 由 arca-csr session-start hook 或用户手动执行。
set -eu

PLUGIN_ROOT="${PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
BSK_REPO="Tencent/BrowserSkill"          # 上游二进制来源
BSK_VERSION="${BSK_VERSION:-0.3.0}"

# ── 1. 平台检测 ─────────────────────────────────────────────
os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$arch" in
  aarch64 | arm64) arch="arm64" ;;
  x86_64 | amd64)  arch="x64" ;;
esac

case "$os-$arch" in
  darwin-arm64)  triple="aarch64-apple-darwin" ;;
  darwin-x64)    triple="x86_64-apple-darwin" ;;
  linux-arm64)   triple="aarch64-unknown-linux-musl" ;;
  linux-x64)     triple="x86_64-unknown-linux-musl" ;;
  *) echo "不支持的平台: $os-$arch" >&2; exit 1 ;;
esac

BSK_BIN="r1r2-bsk-$os-$arch"

# ── 2. 下载二进制 ───────────────────────────────────────────
BIN_DIR="${PLUGIN_ROOT}/bin"
mkdir -p "$BIN_DIR"

if [ -f "${BIN_DIR}/${BSK_BIN}" ]; then
  echo "✓ 二进制已存在: ${BSK_BIN}"
else
  URL="https://github.com/${BSK_REPO}/releases/download/cli-v${BSK_VERSION}/bsk-v${BSK_VERSION}-${triple}.tar.gz"
  echo "→ 下载二进制: ${URL}"
  TMP="$(mktemp -d)"
  curl -fSL --retry 3 -o "${TMP}/bsk.tar.gz" "$URL"
  tar -xzf "${TMP}/bsk.tar.gz" -C "$BIN_DIR" bsk 2>/dev/null || tar -xzf "${TMP}/bsk.tar.gz" -C "$BIN_DIR"
  # 重命名
  if [ -f "${BIN_DIR}/bsk" ]; then
    mv "${BIN_DIR}/bsk" "${BIN_DIR}/${BSK_BIN}"
  fi
  chmod +x "${BIN_DIR}/${BSK_BIN}"
  rm -rf "$TMP"
  echo "✓ 二进制已安装: ${BSK_BIN}"
fi

# ── 3. 创建符号链接 ─────────────────────────────────────────
ln -sf "$BSK_BIN" "${BIN_DIR}/r1r2-bsk"
echo "✓ 符号链接: bin/r1r2-bsk → ${BSK_BIN}"

# ── 4. 构建 MCP Server ──────────────────────────────────────
MCP_DIR="${PLUGIN_ROOT}/mcp-server"
if [ -f "${MCP_DIR}/package.json" ]; then
  echo "→ 构建 MCP Server..."
  if [ -x "$(command -v npm)" ]; then
    ( cd "$MCP_DIR" && npm install --omit=dev 2>/dev/null && npm run build 2>/dev/null ) \
      || ( cd "$MCP_DIR" && npm install 2>/dev/null && npx tsdown src/index.ts --format esm --out-dir dist --clean 2>/dev/null )
    echo "✓ MCP Server 已构建"
  else
    echo "⚠️ 未检测到 npm，MCP Server 未构建（可手动安装 Node.js 后重跑）"
  fi
fi

echo ""
echo "✅ R1R2 浏览器技能插件包安装完成"
echo "   二进制: bin/${BSK_BIN}"
echo "   MCP Server: mcp-server/dist/index.js"
echo "   提示: 请安装浏览器扩展 https://chromewebstore.google.com/detail/hhcmgoofomhgciiibhipgmgkgnoenaoi"
