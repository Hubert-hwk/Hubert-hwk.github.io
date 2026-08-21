# Hubert Blog

部署在 GitHub Pages 的个人技术博客，内容聚焦 AI 工程、自动化和个人项目复盘。

## 本地预览

这是一个已生成的静态站点；在仓库根目录执行：

```bash
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`。

## 维护约定

- 新文章放在 `YYYY/MM/DD/slug/index.html`，并同步更新首页、归档、`atom.xml` 与 `sitemap.xml`。
- 每个页面应保留唯一的 `title`、description、canonical 和 Open Graph 元数据。
- 发布前至少检查桌面端和手机端布局、站内链接及浏览器控制台。
- 提交前运行 `python3 scripts/check_site.py`；GitHub Actions 会重复执行该检查。
- 当前仓库仅保存可部署的静态产物；若要恢复 Hexo 写作与构建流程，需要另行迁移或找回原始源码仓库。
