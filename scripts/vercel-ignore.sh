#!/bin/sh
# Vercel 的 Ignored Build Step：退出码 0 跳过构建，1 照常构建。
# 和上次成功部署的提交比较，只有前端相关文件没变时才跳过；拿不到上次的提交（首次部署、浅克隆）时照常构建。
cd "$(git rev-parse --show-toplevel)" || exit 1
prev="$VERCEL_GIT_PREVIOUS_SHA"
if [ -z "$prev" ] || ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  exit 1
fi
git diff --quiet "$prev" HEAD -- apps/web packages/core package.json pnpm-lock.yaml pnpm-workspace.yaml scripts/vercel-ignore.sh || exit 1
