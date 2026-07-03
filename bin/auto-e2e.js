#!/usr/bin/env node
// auto-e2e CLI 入口。
// 此文件不被 tsc 编译,仅作为 bin 入口加载已构建的 dist/cli 并显式触发。
import { runCli } from '../dist/cli/index.js'

runCli().then((code) => {
  process.exitCode = code
})
