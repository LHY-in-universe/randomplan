#!/usr/bin/env python3
"""
随机吃什么决策系统 - Flask 后端
"""

import json
import random
import uuid
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')


def load_data():
    """加载本地 JSON 数据"""
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_data(data):
    """保存数据到本地 JSON 文件"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


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


if __name__ == '__main__':
    app.run(debug=True, port=5000)
