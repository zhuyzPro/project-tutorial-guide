# 指南所 · 项目教程导航

一个用于发布和管理项目使用教程的轻量网站。前台按生活场景展示项目，读者可打开图文步骤查看完整教程；后台可以管理分类、教程、封面和排序，并查看访问与点击统计。

## 已包含功能

- 首页分类：生活权益、外卖奶茶、打车出行、网购入会、红包现金、游戏相关、其他项目。
- 项目教程：按“卡片前方（未点击）/卡片后方（点击后）”分组维护标题、卡片简介、卡片说明、详情介绍、封面图、图文操作路径、小提示与项目入口；启用状态在列表行左侧胶囊按钮直接切换。
- 后台管理：新增、编辑、删除、开关、移动和排序分类及项目。
- 数据中心：数据概览、访问趋势、访问来源、项目点击四个数据入口，统一支持今天、近 7 天、近 30 天、近 90 天和自定义日期筛选，并可按小时/按天查看趋势。
- 访问来源：按脱敏 IP 汇总访问次数，展示首次访问与最近访问时间；页面不会直接暴露原始 IP。
- GitHub Pages：根目录前台会通过 Actions 自动发布；数据与后台需要运行 Node/SQLite 服务。

## 本地运行

要求 Node.js 24+（使用内置 `node:sqlite`）。

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "change-this-before-use"
$env:COOKIE_SECURE = "false"
$env:COOKIE_PATH = "/api/"
node server/wayfind-server.js
```

然后访问：

- 前台：<http://127.0.0.1:4899/>
- 后台：<http://127.0.0.1:4899/admin/>

默认在 `server/guide.sqlite` 保存数据。请在生产环境设置强密码、`SESSION_SECRET`、`ADMIN_ORIGIN`，并通过 HTTPS 反向代理部署后台服务。可从 [`.env.example`](.env.example) 复制部署变量。

## 部署说明

`.github/workflows/pages.yml` 会将前台静态文件发布到 GitHub Pages。GitHub Pages 无法运行 Node/SQLite，因此生产环境需要单独部署 `server/wayfind-server.js`，再将前台的 `window.NAVIGUIDE_API_BASE` 指向服务端 API 地址，例如：

```html
<script>
  window.NAVIGUIDE_API_BASE = "https://guide.example.com/api";
  window.NAVIGUIDE_ADMIN_URL = "https://guide.example.com/admin/";
</script>
```

如果前台和后台同域部署，保持默认 `/api` 即可。若前台发布在 GitHub Pages，请在服务端设置 `PUBLIC_ORIGINS=https://<GitHub 用户名>.github.io`，并在前台页面加载前将 `window.NAVIGUIDE_API_BASE` 配置为服务端完整 API 地址。

## 后台菜单结构

```text
内容管理
├─ 项目教程       新增、编辑、删除、显示状态与分类内排序
└─ 分类管理       新增、编辑、删除、显示状态与全局排序
数据中心
└─ 数据概览       可展开/收起的统计入口
   ├─ 总览          大盘指标、热门分类、热门项目、来源摘要
   ├─ 访问趋势      按小时/按天查看访问次数变化
   ├─ 访问来源      脱敏 IP、访问次数、首次/最近访问
   └─ 项目点击      项目点击排名、分类、占比
```

项目编辑器中的字段按前台真实浏览路径拆分：

- 卡片前方：所属分类、项目标题、状态文案、卡片标记、卡片简介、卡片说明。
- 卡片后方：详情介绍、封面图 URL、逐步操作路径（标题/说明/图片）、小提示、入口 URL。
- 后台设置：色调和后台备注；项目/分类可见性在列表行左侧的启用胶囊按钮切换。

## 当前生产部署

生产环境使用独立 Node/SQLite 服务，部署配置保存在 `server/project-tutorial-guide.service` 和 `server/project-tutorial-guide.nginx.conf`。前台 GitHub Pages 会自动读取 `https://zhuyz.art/project-tutorial-guide-api`；后台通过 `https://zhuyz.art/project-tutorial-guide-admin/` 管理内容。数据库、会话和服务均与其他站点隔离。

## 目录结构

```text
index.html                 前台结构
styles.css                 前台视觉与响应式样式
app.js                     前台数据、搜索、教程抽屉与点击埋点
server/wayfind-server.js  Node/SQLite API、登录、教程与统计
server/admin/              后台管理页面
.github/workflows/         GitHub Pages 自动发布
```
