# 今天吃什么？ 🍽️

一个用于解决“今天吃什么”选择困难的小型 Web 应用。  
后端使用 Flask，前端使用原生 HTML/CSS/JavaScript，数据直接保存在本地 `data.json`。

## 功能概览

- 按分类或全局随机推荐一家餐厅
- 从餐厅菜单中随机推荐一道菜
- 在页面中维护分类、餐厅、地址和菜单
- 无数据库依赖，数据持久化到本地 JSON 文件

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3 + Flask + Flask-CORS |
| 前端 | HTML + CSS + Vanilla JavaScript |
| 存储 | 本地 JSON 文件 |

## 运行环境

- Python 3.10+
- macOS / Linux / Windows 均可
- 现代浏览器

## 快速启动

仓库里已经包含一个 `venv/`，也可以自己重新创建虚拟环境。

### 方式一：直接使用仓库内虚拟环境

```bash
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 方式二：重新创建虚拟环境

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

启动后访问：

```text
http://127.0.0.1:5000
```

## 项目结构

```text
random-plan/
├── .gitignore         # Git 忽略规则
├── app.py             # Flask 后端与 REST API
├── data.json          # 本地数据文件
├── requirements.txt   # Python 依赖列表
├── venv/              # 虚拟环境（当前仓库已包含）
└── static/
    ├── index.html     # 页面结构
    ├── style.css      # 页面样式
    └── script.js      # 前端交互逻辑
```

## 数据结构

`data.json` 的结构如下：

```json
{
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

数据关系：

- 一个分类包含多家餐厅
- 一家餐厅包含一个菜单数组
- 随机推荐时先选分类，再选餐厅，再选菜品

## 页面说明

### 随机决定

- 可选择“全部随机”或某个分类
- 点击“帮我决定”后返回推荐餐厅和推荐菜品
- 如果该餐厅有菜单，可展开查看完整菜单

### 数据管理

- 新增、编辑、删除分类
- 在分类下新增、编辑、删除餐厅
- 为餐厅维护地址和菜单条目

## API 接口

### 1. 获取所有分类

```http
GET /api/categories
```

返回所有分类及其餐厅信息。

### 2. 新增分类

```http
POST /api/categories
Content-Type: application/json
```

请求体：

```json
{
  "name": "韩餐",
  "icon": "🍲"
}
```

### 3. 更新分类

```http
PUT /api/categories/<cat_id>
Content-Type: application/json
```

请求体示例：

```json
{
  "name": "火锅",
  "icon": "🍲"
}
```

### 4. 删除分类

```http
DELETE /api/categories/<cat_id>
```

删除分类时会一并删除该分类下的餐厅。

### 5. 在分类下新增餐厅

```http
POST /api/categories/<cat_id>/restaurants
Content-Type: application/json
```

请求体：

```json
{
  "name": "海底捞",
  "address": "南京东路 100 号",
  "menu": ["番茄锅", "肥牛", "虾滑"]
}
```

### 6. 更新餐厅

```http
PUT /api/restaurants/<res_id>
Content-Type: application/json
```

请求体示例：

```json
{
  "name": "海底捞人民广场店",
  "address": "南京东路 100 号",
  "menu": ["番茄锅", "毛肚", "虾滑"]
}
```

### 7. 删除餐厅

```http
DELETE /api/restaurants/<res_id>
```

### 8. 随机推荐

```http
GET /api/random
GET /api/random?category_id=<cat_id>
```

返回示例：

```json
{
  "category": {
    "id": "cat_2",
    "name": "日料",
    "icon": "🍣"
  },
  "restaurant": {
    "id": "res_3",
    "name": "樱花寿司",
    "address": "示例街道3号",
    "menu": ["三文鱼寿司", "金枪鱼寿司", "加州卷"]
  },
  "recommended_dish": "三文鱼寿司"
}
```

## 接口校验规则

当前接口包含以下基础校验：

- 请求体必须是 JSON 对象
- 分类名称不能为空
- 分类名称不能重复
- 分类图标如果传入则不能为空
- 餐厅名称不能为空
- 菜单必须是数组
- 菜单中的空字符串会被自动过滤

常见错误响应：

```json
{"error": "请求体必须是 JSON 对象"}
```

```json
{"error": "该分类已存在"}
```

```json
{"error": "菜单必须是数组"}
```

## 开发说明

- 数据直接写入 `data.json`，适合单机、小规模、本地使用
- 当前没有数据库锁与并发写保护，不适合多人同时写入
- 前端是原生 JS，没有打包步骤
- 结果区域、管理页和弹窗都由 `static/script.js` 动态渲染

## 常见问题

### 1. `5000` 端口被占用怎么办？

可以先关闭现有进程，或手动换端口运行：

```bash
venv/bin/python -c "import app; app.app.run(host='127.0.0.1', debug=False, port=5001)"
```

然后访问：

```text
http://127.0.0.1:5001
```

### 2. 为什么我修改完数据刷新页面才看到？

因为数据由后端接口写入 `data.json`，页面通过前端重新拉取接口数据后更新显示。

### 3. 可以直接改 `data.json` 吗？

可以，但需要保证 JSON 格式正确，并遵循现有数据结构。

## 后续可扩展方向

- 增加搜索、排序、收藏、最近选择记录
- 为菜单增加权重或“不想吃”过滤
- 增加导入导出功能
- 增加测试和 `requirements.txt`
