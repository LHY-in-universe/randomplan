#!/usr/bin/env python3
"""
随机吃什么决策系统 - Flask 后端
"""

import json
import random
import uuid
import os
import portalocker
import requests as http_requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')

# ─── SiliconFlow AI 配置 ────────────────────────────────────────────────────
SF_API_KEY = os.environ.get('SILICONFLOW_API_KEY', '')
SF_BASE_URL = os.environ.get('SILICONFLOW_BASE_URL', 'https://api.siliconflow.cn/v1')
SF_CHAT_MODEL = os.environ.get('SF_CHAT_MODEL', 'deepseek-ai/DeepSeek-V4-Flash')
SF_IMAGE_MODEL = os.environ.get('SF_IMAGE_MODEL', 'Kwai-Kolors/Kolors')


def get_effective_api_key():
    """优先取环境变量，否则从 data.json 的 settings 读取"""
    if SF_API_KEY:
        return SF_API_KEY
    data = load_data()
    return data.get('settings', {}).get('siliconflow_api_key', '')


def load_data():
    """加载本地 JSON 数据"""
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        portalocker.lock(f, portalocker.LOCK_SH)
        data = json.load(f)
        portalocker.unlock(f)
    return data


def save_data(data):
    """保存数据到本地 JSON 文件（加写锁防并发）"""
    with open(DATA_FILE, 'r+', encoding='utf-8') as f:
        portalocker.lock(f, portalocker.LOCK_EX)
        f.seek(0)
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.truncate()
        portalocker.unlock(f)


def get_json_body():
    """获取并校验 JSON 请求体"""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return None, (jsonify({'error': '请求体必须是 JSON 对象'}), 400)
    return body, None


def normalize_text(value, default=''):
    """将字符串输入裁剪为干净文本"""
    return value.strip() if isinstance(value, str) else default


def normalize_menu_items(value):
    """校验并清理菜单数组"""
    if value is None:
        return []
    if not isinstance(value, list):
        return None
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def category_name_exists(categories, name, exclude_id=None):
    """检查分类名称是否重复"""
    normalized_name = name.casefold()
    return any(
        cat.get('id') != exclude_id
        and isinstance(cat.get('name'), str)
        and cat['name'].casefold() == normalized_name
        for cat in categories
    )


# ─── 静态文件服务 ───────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


# ─── 分类 API ─────────────────────────────────────────────────────────────────

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """获取所有分类及餐厅信息"""
    data = load_data()
    return jsonify(data['categories'])


@app.route('/api/categories', methods=['POST'])
def add_category():
    """新增分类"""
    body, error_response = get_json_body()
    if error_response:
        return error_response

    name = normalize_text(body.get('name'))
    icon = normalize_text(body.get('icon')) or '🍽️'

    if not name:
        return jsonify({'error': '分类名称不能为空'}), 400

    data = load_data()
    # 检查重名
    if category_name_exists(data['categories'], name):
        return jsonify({'error': '该分类已存在'}), 409

    new_cat = {
        'id': f'cat_{uuid.uuid4().hex[:8]}',
        'name': name,
        'icon': icon,
        'restaurants': []
    }
    data['categories'].append(new_cat)
    save_data(data)
    return jsonify(new_cat), 201


@app.route('/api/categories/<cat_id>', methods=['PUT'])
def update_category(cat_id):
    """更新分类信息"""
    body, error_response = get_json_body()
    if error_response:
        return error_response

    data = load_data()

    cat = next((c for c in data['categories'] if c['id'] == cat_id), None)
    if not cat:
        return jsonify({'error': '分类不存在'}), 404

    if 'name' in body:
        name = normalize_text(body.get('name'))
        if not name:
            return jsonify({'error': '分类名称不能为空'}), 400
        if category_name_exists(data['categories'], name, exclude_id=cat_id):
            return jsonify({'error': '该分类已存在'}), 409
        cat['name'] = name
    if 'icon' in body:
        icon = normalize_text(body.get('icon'))
        if not icon:
            return jsonify({'error': '分类图标不能为空'}), 400
        cat['icon'] = icon

    save_data(data)
    return jsonify(cat)


@app.route('/api/categories/<cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    """删除分类"""
    data = load_data()
    original_len = len(data['categories'])
    data['categories'] = [c for c in data['categories'] if c['id'] != cat_id]

    if len(data['categories']) == original_len:
        return jsonify({'error': '分类不存在'}), 404

    save_data(data)
    return jsonify({'message': '删除成功'})


# ─── 餐厅 API ─────────────────────────────────────────────────────────────────

@app.route('/api/categories/<cat_id>/restaurants', methods=['POST'])
def add_restaurant(cat_id):
    """向某分类新增餐厅"""
    body, error_response = get_json_body()
    if error_response:
        return error_response

    name = normalize_text(body.get('name'))
    address = normalize_text(body.get('address'))
    menu = normalize_menu_items(body.get('menu', []))

    if not name:
        return jsonify({'error': '餐厅名称不能为空'}), 400
    if menu is None:
        return jsonify({'error': '菜单必须是数组'}), 400

    data = load_data()
    cat = next((c for c in data['categories'] if c['id'] == cat_id), None)
    if not cat:
        return jsonify({'error': '分类不存在'}), 404

    new_res = {
        'id': f'res_{uuid.uuid4().hex[:8]}',
        'name': name,
        'address': address,
        'menu': menu
    }
    cat['restaurants'].append(new_res)
    save_data(data)
    return jsonify(new_res), 201


@app.route('/api/restaurants/<res_id>', methods=['PUT'])
def update_restaurant(res_id):
    """更新餐厅信息"""
    body, error_response = get_json_body()
    if error_response:
        return error_response

    data = load_data()

    for cat in data['categories']:
        res = next((r for r in cat['restaurants'] if r['id'] == res_id), None)
        if res:
            if 'name' in body:
                name = normalize_text(body.get('name'))
                if not name:
                    return jsonify({'error': '餐厅名称不能为空'}), 400
                res['name'] = name
            if 'address' in body:
                res['address'] = normalize_text(body.get('address'))
            if 'menu' in body:
                menu = normalize_menu_items(body.get('menu'))
                if menu is None:
                    return jsonify({'error': '菜单必须是数组'}), 400
                res['menu'] = menu
            save_data(data)
            return jsonify(res)

    return jsonify({'error': '餐厅不存在'}), 404


@app.route('/api/restaurants/<res_id>', methods=['DELETE'])
def delete_restaurant(res_id):
    """删除餐厅"""
    data = load_data()

    for cat in data['categories']:
        original_len = len(cat['restaurants'])
        cat['restaurants'] = [r for r in cat['restaurants'] if r['id'] != res_id]
        if len(cat['restaurants']) < original_len:
            save_data(data)
            return jsonify({'message': '删除成功'})

    return jsonify({'error': '餐厅不存在'}), 404


# ─── 随机决定 API ─────────────────────────────────────────────────────────────

@app.route('/api/random', methods=['GET'])
def get_random():
    """
    随机从指定分类中选择一个餐厅及一道菜
    Query params:
        category_id: 分类ID（不传则全局随机）
    """
    cat_id = request.args.get('category_id', '').strip()
    data = load_data()

    if cat_id:
        cat = next((c for c in data['categories'] if c['id'] == cat_id), None)
        if not cat:
            return jsonify({'error': '分类不存在'}), 404
        pool = [cat]
    else:
        pool = data['categories']

    # 收集所有有餐厅的分类
    valid_cats = [c for c in pool if c['restaurants']]
    if not valid_cats:
        return jsonify({'error': '该分类下暂无餐厅，请先添加餐厅'}), 404

    chosen_cat = random.choice(valid_cats)
    chosen_res = random.choice(chosen_cat['restaurants'])
    chosen_dish = random.choice(chosen_res['menu']) if chosen_res['menu'] else None

    return jsonify({
        'category': {'id': chosen_cat['id'], 'name': chosen_cat['name'], 'icon': chosen_cat['icon']},
        'restaurant': chosen_res,
        'recommended_dish': chosen_dish
    })


# ─── AI 推荐语 API ─────────────────────────────────────────────────────────

@app.route('/api/ai/recommend', methods=['POST'])
def ai_recommend():
    """调用 SiliconFlow LLM 流式生成幽默推荐语"""
    from flask import Response

    body, error_response = get_json_body()
    if error_response:
        return error_response

    restaurant = normalize_text(body.get('restaurant'))
    dish = normalize_text(body.get('dish'))
    category = normalize_text(body.get('category'))

    if not restaurant or not dish:
        return jsonify({'error': '餐厅名称和菜品名称不能为空'}), 400

    if not get_effective_api_key():
        def no_key():
            yield f'data: {json.dumps({"content": "AI 推荐功能暂未配置，请联系管理员设置 API Key。"}, ensure_ascii=False)}\n\n'
            yield 'data: [DONE]\n\n'
        return Response(no_key(), content_type='text/event-stream')

    prompt = (
        f"你是一个幽默风趣的美食推荐官。用户刚刚随机选了一家餐厅「{restaurant}」"
        f"（分类：{category or '美食'}），推荐的菜品是「{dish}」。"
        f"请用轻松搞笑的语气，生成一段50字以内的推荐语，要有画面感，让人看了就想吃。"
        f"不要加引号、不要加表情符号前缀，直接输出推荐语。"
    )

    def generate():
        try:
            resp = http_requests.post(
                f'{SF_BASE_URL}/chat/completions',
                headers={
                    'Authorization': f'Bearer {get_effective_api_key()}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': SF_CHAT_MODEL,
                    'messages': [{'role': 'user', 'content': prompt}],
                    'max_tokens': 200,
                    'temperature': 0.9,
                    'stream': True,
                    'enable_thinking': False,
                },
                timeout=60,
                stream=True,
            )
            resp.raise_for_status()
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                line = raw_line.decode('utf-8') if isinstance(raw_line, bytes) else raw_line
                if not line.startswith('data:'):
                    continue
                payload = line[5:].strip()
                if payload == '[DONE]':
                    yield 'data: [DONE]\n\n'
                    break
                try:
                    chunk = json.loads(payload)
                    delta = chunk['choices'][0].get('delta', {})
                    content = delta.get('content', '')
                    if content:
                        yield f'data: {json.dumps({"content": content}, ensure_ascii=False)}\n\n'
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
        except http_requests.Timeout:
            yield f'data: {json.dumps({"error": "AI 推荐生成超时"}, ensure_ascii=False)}\n\n'
            yield 'data: [DONE]\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)}, ensure_ascii=False)}\n\n'
            yield 'data: [DONE]\n\n'

    return Response(generate(), content_type='text/event-stream')


# ─── AI 菜品图片 API ──────────────────────────────────────────────────────

@app.route('/api/ai/image', methods=['POST'])
def ai_image():
    """调用 SiliconFlow 图像生成 API 生成菜品图片"""
    body, error_response = get_json_body()
    if error_response:
        return error_response

    dish = normalize_text(body.get('dish'))
    category = normalize_text(body.get('category'))

    if not dish:
        return jsonify({'error': '菜品名称不能为空'}), 400

    if not get_effective_api_key():
        return jsonify({'image_url': None})

    prompt = (
        f"A delicious plate of {dish}, {category or 'Chinese'} cuisine, "
        f"professional food photography, warm lighting, shallow depth of field, "
        f"appetizing presentation on a ceramic plate, restaurant quality"
    )

    try:
        resp = http_requests.post(
            f'{SF_BASE_URL}/images/generations',
            headers={
                'Authorization': f'Bearer {get_effective_api_key()}',
                'Content-Type': 'application/json',
            },
            json={
                'model': SF_IMAGE_MODEL,
                'prompt': prompt,
                'image_size': '1024x1024',
                'batch_size': 1,
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        image_url = data['images'][0]['url'] if data.get('images') else None
        return jsonify({'image_url': image_url})
    except http_requests.Timeout:
        return jsonify({'error': 'AI 图片生成超时，请稍后再试'}), 504
    except Exception as e:
        return jsonify({'error': f'AI 图片生成失败：{str(e)}'}), 500


# ─── 设置 API（前端配置 API Key）───────────────────────────────────────────

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """读取 AI 配置信息（不暴露完整 key）"""
    data = load_data()
    stored_key = data.get('settings', {}).get('siliconflow_api_key', '')
    return jsonify({
        'has_env_key': bool(SF_API_KEY),
        'has_stored_key': bool(stored_key),
        'api_key_masked': (
            stored_key[:4] + '…' + stored_key[-4:]
            if len(stored_key) > 12
            else '已配置' if stored_key else ''
        ),
    })


@app.route('/api/settings', methods=['PUT'])
def update_settings():
    """保存 AI 配置"""
    body, error_response = get_json_body()
    if error_response:
        return error_response

    data = load_data()
    if 'settings' not in data:
        data['settings'] = {}

    key = normalize_text(body.get('siliconflow_api_key', ''))
    data['settings']['siliconflow_api_key'] = key
    save_data(data)
    return jsonify({'message': '设置已保存'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(debug=debug, port=port)
