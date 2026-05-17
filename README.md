# 今天吃什么？🍽️

一个帮你解决"今天吃什么"选择困难症的 Web 应用。  
随机推荐餐厅和菜品，支持 AI 生成推荐语和菜品图片。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3 + Flask |
| 前端 | HTML + CSS + Vanilla JS（无框架） |
| 存储 | 本地 `data.json` 文件 |
| AI | SiliconFlow API（可选的 LLM 推荐语 + 图片生成） |

---

## 快速启动

### 环境要求

- Python **3.10 或更高版本**
- 现代浏览器（Chrome / Edge / Firefox / Safari）

### 1. 获取代码

```bash
# 如果已 clone 则跳过
git clone <仓库地址>
cd random-plan
```

### 2. 创建虚拟环境

> 虚拟环境用于隔离 Python 依赖，避免和系统其他项目冲突。

**macOS / Linux：**

```bash
python3 -m venv .venv
```

**Windows（cmd / PowerShell）：**

```cmd
python -m venv .venv
```

### 3. 激活虚拟环境

**macOS / Linux：**

```bash
source .venv/bin/activate
```

**Windows（cmd）：**

```cmd
.venv\Scripts\activate
```

**Windows（PowerShell）：**

```powershell
.venv\Scripts\Activate.ps1
```

> 如果 PowerShell 提示"无法加载文件"，先执行：`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

激活成功后，终端提示符前面会出现 `(.venv)` 标志。

### 4. 安装依赖

```bash
pip install -r requirements.txt
```

### 5. 启动服务（同时启动前后端）

```bash
python app.py
```

这个命令会同时启动：
- **后端 API**（Flask，处理数据读写、随机推荐、AI 等功能）
- **前端页面**（静态 HTML/CSS/JS，由 Flask 托管，无需额外构建步骤）

### 6. 打开浏览器

访问 **http://127.0.0.1:5000**

---

## 自定义端口

默认跑在 **5000** 端口。要换端口，设置环境变量 `PORT`：

**macOS / Linux：**

```bash
PORT=5201 python app.py
```

**Windows（cmd）：**

```cmd
set PORT=5201
python app.py
```

**Windows（PowerShell）：**

```powershell
$env:PORT=5201
python app.py
```

---

## （可选）配置 AI 功能

应用支持两个 AI 扩展功能（需自行申请 API Key）：

- **AI 推荐语** — 随机后生成一段幽默的推荐文案
- **AI 菜品图片** — 根据菜品名生成实物图

默认这两个功能不启用，不影响核心随机功能。

### 配置方式

有两种方式设置 API Key（优先级从高到低）：

**方式 A：环境变量（推荐）**

```bash
# macOS / Linux
export SILICONFLOW_API_KEY=sk-xxxxxxxx
python app.py
```

```cmd
:: Windows cmd
set SILICONFLOW_API_KEY=sk-xxxxxxxx
python app.py
```

```powershell
# Windows PowerShell
$env:SILICONFLOW_API_KEY="sk-xxxxxxxx"
python app.py
```

**方式 B：页面内配置**

启动后在浏览器中打开应用 → 切换到「数据管理」→ 拉到页面底部，展开 **⚙️ AI 配置**，填入 API Key 后保存。

> 页面保存的 Key 会写入 `data.json`，下次启动仍然有效。

### 可选的配置项

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `SILICONFLOW_API_KEY` | API Key | （空） |
| `SILICONFLOW_BASE_URL` | API 地址 | `https://api.siliconflow.cn/v1` |
| `SF_CHAT_MODEL` | LLM 模型 | `deepseek-ai/DeepSeek-V4-Flash` |
| `SF_IMAGE_MODEL` | 图片模型 | `Kwai-Kolors/Kolors` |
| `FLASK_DEBUG` | 是否开启调试模式 | `1`（开启） |

---

## 功能使用

### 🎲 随机决定

1. 在顶部选择分类（或"全部随机"）
2. 点击中间 **🎲 帮我决定！** 按钮
3. 页面显示推荐的餐厅 + 菜品
4. 可展开查看完整菜单，或点击「再来一次」

### 📋 数据管理

- **新增分类** — 点击「＋ 新增分类」，填写名称和图标
- **编辑分类** — 点击分类卡片右上角的 ✎ 按钮
- **删除分类** — 点击分类卡片右上角的 ✕ 按钮
- **添加餐厅** — 在分类卡片底部点击「＋ 添加餐厅」
- **编辑餐厅** — 点击餐厅旁的 ✎ 按钮
- **删除餐厅** — 点击餐厅旁的 ✕ 按钮
- **管理菜单** — 在餐厅弹窗中，输入菜名按回车添加，点击 × 删除

---

## 项目结构

```text
random-plan/
├── .venv/                # Python 虚拟环境（首次运行后生成）
├── static/
│   ├── index.html        # 页面 HTML
│   ├── style.css         # 样式表
│   └── script.js         # 前端交互逻辑
├── app.py                # Flask 后端 + REST API
├── data.json             # 分类 / 餐厅 / 设置数据
├── requirements.txt      # Python 依赖列表
└── README.md
```

---

## API 接口一览

### 分类

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/categories` | 获取所有分类（含餐厅） |
| `POST` | `/api/categories` | 新增分类 |
| `PUT` | `/api/categories/<id>` | 更新分类 |
| `DELETE` | `/api/categories/<id>` | 删除分类（含旗下餐厅） |

### 餐厅

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/categories/<id>/restaurants` | 在分类下新增餐厅 |
| `PUT` | `/api/restaurants/<id>` | 更新餐厅 |
| `DELETE` | `/api/restaurants/<id>` | 删除餐厅 |

### 随机

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/random` | 全局随机 |
| `GET` | `/api/random?category_id=<id>` | 按分类随机 |

### AI

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/ai/recommend` | AI 推荐语（流式 SSE） |
| `POST` | `/api/ai/image` | AI 菜品图片 |

### 设置

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/settings` | 获取配置状态（不返回完整 Key） |
| `PUT` | `/api/settings` | 保存配置（如 `siliconflow_api_key`） |

---

## 数据结构

```json
{
  "settings": {
    "siliconflow_api_key": "sk-..."
  },
  "categories": [
    {
      "id": "cat_1",
      "name": "中餐",
      "icon": "🥢",
      "restaurants": [
        {
          "id": "res_1",
          "name": "老王饺子馆",
          "address": "示例街道1号",
          "menu": ["猪肉白菜饺子", "韭菜鸡蛋饺子"]
        }
      ]
    }
  ]
}
```

---

## 常见问题

### 端口被占用怎么办？

```bash
# 先杀掉占用端口的进程，再换一个端口启动
PORT=5201 python app.py
```

### 改完数据页面没刷新？

数据通过 API 读写，修改后页面会自动刷新。如果是直接改了 `data.json` 文件，刷新页面即可。

### 可以直接改 data.json 吗？

可以，注意保持 JSON 格式正确。改完刷新页面即可生效。

### Windows PowerShell 下 .venv 激活报错？

执行一次 `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` 即可。

### 没有 API Key 能用吗？

可以。AI 推荐语和菜品图片是可选功能，核心的随机推荐不需要任何 API Key。
