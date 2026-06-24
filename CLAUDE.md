# aiBA 项目协作规则

开始前读取工作区 AGENTS.md 和 SOUL.short.md。

1. 修改前先执行 git fetch、git status，确认最新主线和工作区状态。
2. 功能开发使用独立分支，不直接修改 main。
3. 每次正式修改都升级版本号，例如 v1.38 → v1.39。
4. 旧版本移入 backup/，不得删除。
5. index.html 与当前版本快照必须完全一致。
6. 同步更新 README 中的当前版本文件名。
7. 不覆盖或撤销其他 AI、用户已有的修改。
8. 修改后运行：
   - 内联 JavaScript 语法检查
   - git diff --check
   - 本地资源缺失检查
   - index.html 与版本快照一致性检查
9. 默认不做视觉浏览测试，由 TigerBro 手动验证。
10. 完成后自动 commit 并 push 当前功能分支。
11. 只有 TigerBro 明确说"合并主线"时才允许合并 main。
12. 合并前重新 fetch，确认 main 没有新提交；优先 fast-forward。
13. 合并后重新测试、push main，并确认本地 HEAD 与 origin/main 一致。
14. 保留各 AI 的原始 commit 作者，不 squash，除非 TigerBro 明确要求。
15. 最终汇报版本号、分支、commit、测试结果和是否已推送。
