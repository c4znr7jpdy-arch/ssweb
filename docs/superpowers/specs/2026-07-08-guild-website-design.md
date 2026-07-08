# 燕云百业网站设计文档

## 项目概述

燕云十六声游戏内百业（帮派）内部展示网站。社主（管理员）通过网页后台管理内容，面向全体百业成员展示，无登录门槛。

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 前端 | HTML + CSS + JavaScript | 纯静态页面，无框架依赖 |
| 后端 | Node.js + Express | 轻量 API 服务 |
| 数据库 | SQLite | 单文件数据库，无需额外服务 |
| 部署 | 现有服务器 + 域名 | Nginx 反向代理 |

## 视觉设计系统

### 颜色变量
```css
:root {
  --bg: #050505;
  --panel: rgba(18, 16, 13, 0.86);
  --panel-light: rgba(34, 29, 22, 0.92);
  --gold: #c9a96e;
  --gold-soft: rgba(201, 169, 110, 0.24);
  --text: #f2eadc;
  --muted: #9c927f;
  --red: #6e1e1e;
}
```

### 字体
- 标题：Noto Serif SC
- 正文：Noto Sans SC

### 卡片风格
```css
.card {
  background: var(--panel);
  border: 1px solid rgba(201, 169, 110, 0.16);
  border-radius: 18px;
  backdrop-filter: blur(12px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(201, 169, 110, 0.45);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
}
```

### 动效
- Hover 展开：cubic-bezier(.2,.9,.2,1)，650ms
- 文字入场：translateY + opacity，400-450ms 延迟递增
- 呼吸动画：2s ease-in-out infinite

---

## 页面结构

### 主页（index.html）

主页分两屏，通过 CSS scroll-snap 滚动切换：

**第一屏：斜向分割画廊**
- 斜向 5° 分割面板，每个面板放百业成员图片
- Hover 效果：当前面板展开高亮（flex: 2.35），其他变暗（brightness .45）
- Hover 时浮现成员信息（名称、职位、简介），带入场动画
- 点击面板跳转到对应子页面
- 底部固定提示「HOVER TO EXPLORE」，呼吸动画
- 面板数量：5 个（可配置）
- 导航栏：顶部固定，左侧金色 logo「燕云百业」，右侧导航链接（主页、成员、活动日历、贡献榜、装备工具）
- 导航栏背景：顶部深色渐变到透明

**第二屏：视频展示区**
- 全屏视频播放区域
- 视频来源：社主自行录制，上传到服务器
- 初始状态：占位区域 + 播放按钮
- 视频样式：深色背景，视频居中，圆角阴影

---

### 成员页（members.html）

**页面定位**：百业江湖名册，让成员有身份感、归属感。

**路由**：`/members`

**页面布局**：
- 顶部：标题「百业成员」+ 副标题「江湖同路，皆为此间人」
- 筛选栏：全部 / 社主 / 副社 / 管理 / 核心成员 / 普通成员
- 成员卡片网格
- 点击卡片 → 跳转 `/member.html?id=1`

**成员卡片设计**：
```
┌────────────────────┐
│      角色截图       │
│                    │
│  昵称：风起燕云     │
│  身份：社主         │
│  标签：PVP / 活动   │
│  签名：一入燕云，皆是江湖 │
└────────────────────┘
```

**点击交互**：跳转成员专属页面

### 成员详情页（member.html）

**路由**：`/member.html?id=1`

**页面布局**：左右分栏，电影感呈现

**左侧 60%**：
- 成员图片从屏幕左侧边缘滑入，居中展示
- 图片占据左侧 60% 宽度
- 入场动画：translateX(-100%) → translateX(0)，cubic-bezier 缓动
- 图片带微弱光晕/阴影效果

**右侧 40%**：
- 打字机效果逐行显示信息，每行之间有延迟
- 显示顺序：
  1. ID / 编号
  2. 昵称
  3. 流派（主玩方向）
  4. 个人签名
- 打字机效果：逐字显示，光标闪烁
- 文字颜色：金色（#c9a96e）标题 + 白色正文

**返回导航**：左上角返回箭头，点击回到主页

---

### 活动日历页（calendar.html）

**页面定位**：百业行动安排表，一眼知道这周有什么活动、几点开始、谁组织。

**路由**：`/calendar`

**页面布局**：
- 左侧：月历视图
- 右侧：本周/今日活动列表
- 顶部：当前月份 + 上一月/下一月切换

**日历格子**：
- 日期数字
- 活动小圆点（类型颜色标记）
- 点击日期 → 右侧显示当天所有活动

**活动类型（5类）**：
| 类型 | 颜色标记 |
|------|----------|
| 百业团建 | 金色 |
| 副本活动 | 蓝色 |
| PVP 活动 | 红色 |
| 拍照合影 | 紫色 |
| 新人教学 | 绿色 |

**活动卡片设计**：
```
┌────────────────────────┐
│ 07月12日  周日  20:30   │
│ 百业团建：汴京集合拍照  │
│ 组织人：风起燕云        │
│ 状态：未开始            │
└────────────────────────┘
```

**活动状态**：未开始 / 进行中 / 已结束 / 已取消

**活动详情内容**：名称、类型、开始/结束时间、组织人、地点、说明、参与成员、备注

**第一版不做报名功能**，只展示活动。后续再加：我要参加、报名名单、签到、活动结束自动加积分。

---

### 贡献榜页（rank.html）

**页面定位**：荣誉墙，记录成员参与、活跃、组织活动的贡献，不做成「逼氪排行榜」。

**路由**：`/rank`

**页面布局**：
- 顶部：标题「百业贡献榜」+ 副标题「江湖有名，皆因同行」
- 统计卡片：总贡献积分 / 本月活跃成员 / 本周活动次数 / 当前榜首
- 排行榜切换：总榜 / 月榜 / 周榜

**榜单设计**：
- 前三名特殊处理：第1名金色高亮、第2名银色、第3名铜色
- 其余：普通暗色卡片

**榜单卡片**：
```
┌────────────────────────────┐
│ 01  风起燕云     社主   1280 │
│     最近贡献：组织百业团建    │
└────────────────────────────┘
```

**贡献积分规则**：
| 行为 | 积分 |
|------|------|
| 参加活动 | +10 |
| 组织活动 | +30 |
| 新人教学 | +20 |
| 攻略投稿 | +20 |
| 百业管理 | +15 |
| 特殊贡献 | 自定义 |

第一版由社主后台手动添加积分记录，不做自动统计。

---

### 游戏功能页（features.html）

占位页面，内容待定，预留内容区域结构。

### 装备工具（/tools/yysls/）

镜像部署燕云十六声装备毕业率管理器（原站：spongem.com/yysls/）。

**功能**：
- 装备录入与管理（主/副词条、定音词条）
- OCR 识别装备截图
- 毕业率分析
- 单件装备对比
- 词条优先级 / 培养建议 / 转律建议
- 多角色管理
- 数据导出/导入

**访问方式**：导航栏「游戏功能」→ 装备工具页面（iframe 嵌入或独立页面）

**文件位置**：`public/tools/yysls/`（已从原站镜像下载全部文件）

---

### 管理后台（admin.html）

**路由**：`/admin`

**登录方式**：简单密码保护，通过后写入 session。
- 环境变量配置：`ADMIN_PASSWORD=你的后台密码`
- 使用 express-session 管理会话

**后台页面**：
- `/admin/members` — 成员管理（增删改查）
- `/admin/events` — 活动管理（增删改查）
- `/admin/contributions` — 贡献积分管理（增删改查）

---

## 数据模型

### members（成员）
```sql
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  cover TEXT,
  tags TEXT,
  signature TEXT,
  join_date TEXT,
  status TEXT DEFAULT 'active',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```
- `tags`：字符串存储，如 `PVP,副本,活动组织`，后续复杂了再拆表
- `role`：社主 / 副社 / 管理 / 核心成员 / 普通成员

### events（活动）
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  leader TEXT,
  description TEXT,
  status TEXT DEFAULT 'upcoming',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```
- `type`：团建 / 副本 / PVP / 拍照 / 教学
- `status`：upcoming / ongoing / ended / cancelled

### event_members（活动参与成员）
```sql
CREATE TABLE event_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(member_id) REFERENCES members(id)
);
```

### contributions（贡献记录）
```sql
CREATE TABLE contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  points INTEGER NOT NULL,
  type TEXT,
  reason TEXT,
  event_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES members(id),
  FOREIGN KEY(event_id) REFERENCES events(id)
);
```

排行榜通过 SQL 聚合查询生成，无需单独建表。

---

## API 接口

### 成员
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/members` | 获取所有成员 |
| GET | `/api/members/:id` | 获取成员详情 |
| POST | `/api/admin/members` | 添加成员（需认证） |
| PUT | `/api/admin/members/:id` | 更新成员（需认证） |
| DELETE | `/api/admin/members/:id` | 删除成员（需认证） |

### 活动
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/events` | 获取活动列表（支持 ?month=YYYY-MM） |
| GET | `/api/events/:id` | 获取活动详情 |
| POST | `/api/admin/events` | 添加活动（需认证） |
| PUT | `/api/admin/events/:id` | 更新活动（需认证） |
| DELETE | `/api/admin/events/:id` | 删除活动（需认证） |

### 贡献
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rank?type=total\|month\|week` | 获取排行榜 |
| GET | `/api/contributions?member_id=1` | 获取成员贡献记录 |
| POST | `/api/admin/contributions` | 添加贡献记录（需认证） |
| DELETE | `/api/admin/contributions/:id` | 删除贡献记录（需认证） |

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth` | 管理员登录，返回 session |

所有 `/api/admin/*` 接口需携带 session cookie。

---

## 文件结构

```
e:\web\
├── public/                    # 前端静态文件
│   ├── index.html             # 主页
│   ├── members.html           # 成员列表页
│   ├── member.html            # 成员详情页
│   ├── calendar.html          # 活动日历页
│   ├── rank.html              # 贡献榜页
│   ├── features.html          # 游戏功能页（占位）
│   ├── admin.html             # 管理后台
│   ├── css/
│   │   └── style.css          # 全局样式 + 设计系统
│   ├── js/
│   │   ├── main.js            # 主页逻辑
│   │   ├── members.js         # 成员列表页逻辑
│   │   ├── member.js          # 成员详情页逻辑（滑入动画 + 打字机）
│   │   ├── calendar.js        # 活动日历逻辑
│   │   ├── rank.js            # 贡献榜逻辑
│   │   └── admin.js           # 管理后台逻辑
│   └── images/
│       ├── members/           # 成员头像/封面
│       └── videos/            # 视频文件
├── tools/                     # 第三方工具镜像
│   └── yysls/                 # 燕云十六声装备毕业率管理器
├── server/                    # 后端
│   ├── index.js               # Express 入口
│   ├── db.js                  # SQLite 初始化
│   ├── routes/
│   │   ├── members.js         # 成员路由
│   │   ├── events.js          # 活动路由
│   │   ├── contributions.js   # 贡献路由
│   │   └── auth.js            # 认证路由
│   └── middleware/
│       └── auth.js            # 鉴权中间件
├── data/
│   └── guild.db               # SQLite 数据库文件
├── package.json
└── .gitignore
```

---

## 开发顺序

1. **成员页** — 首页点击图片后要跳成员详情
2. **贡献榜** — 依赖 members 表
3. **活动日历** — 活动可关联贡献记录
4. **管理后台** — 统一管理成员、活动、积分

### 第一阶段最小可用版本
- `/members` — 成员展示
- `/rank` — 贡献榜展示
- `/calendar` — 活动展示
- `/admin` — 简单后台管理
