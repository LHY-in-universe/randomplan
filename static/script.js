/* ═══════════════════════════════════════════════════════════════════════════
   今天吃什么？— 随机美食决策系统 交互脚本
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── API 基地址 ────────────────────────────────────────────────────────
  const API = {
    categories: '/api/categories',
    category(id) { return `/api/categories/${id}`; },
    restaurants(catId) { return `/api/categories/${catId}/restaurants`; },
    restaurant(id) { return `/api/restaurants/${id}`; },
    random(catId) { return catId ? `/api/random?category_id=${catId}` : '/api/random'; },
    aiRecommend: '/api/ai/recommend',
    aiImage: '/api/ai/image',
  };

  // ── 状态 ─────────────────────────────────────────────────────────────
  const state = {
    categories: [],
    currentTab: 'random',
    selectedCategoryId: '',
    editingCatId: null,
    editingResId: null,
    editingResCatId: null,
    tempMenu: [],
    spinning: false,
  };

  // ── 通用 Emoji ────────────────────────────────────────────────────────
  const COMMON_EMOJIS = ['🍽️','🥢','🍣','🍔','🍕','🍜','🍰','🍩','🥩','🍲','🌮','🍱','🍝','🍳','🥗','🍿'];

  // ── 工具 ──────────────────────────────────────────────────────────────
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function $(id) { return document.getElementById(id); }

  // ── 初始化 ────────────────────────────────────────────────────────────
  async function init() {
    await fetchCategories();
    fetchSettings();
    renderEmojiPicker();
    bindEvents();
  }

  async function fetchCategories() {
    try {
      const res = await fetch(API.categories);
      if (!res.ok) throw new Error('加载分类失败');
      state.categories = await res.json();
      renderAll();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function renderAll() {
    syncSelectedCategory();
    renderCategoryChips();
    renderManageBody();
    updateRandomPageVisibility();
  }

  function syncSelectedCategory() {
    if (!state.selectedCategoryId) return;
    const exists = state.categories.some(cat => cat.id === state.selectedCategoryId);
    if (!exists) state.selectedCategoryId = '';
  }

  function findCategoryById(catId) {
    return state.categories.find(cat => cat.id === catId) || null;
  }

  function findRestaurantById(catId, resId) {
    const cat = findCategoryById(catId);
    if (!cat) return null;
    return cat.restaurants.find(res => res.id === resId) || null;
  }

  // ── 事件绑定（替代内联 onclick） ─────────────────────────────────────
  function bindEvents() {
    $('tab-random').addEventListener('click', () => switchTab('random'));
    $('tab-manage').addEventListener('click', () => switchTab('manage'));
    $('spin-btn').addEventListener('click', doRandom);

    // 结果卡片：查看菜单 + 再来一次
    $('result-card').addEventListener('click', (e) => {
      if (e.target.closest('.result-menu-toggle')) toggleMenu();
      if (e.target.closest('.reroll-btn')) doRandom();
    });

    // 空状态按钮
    $('empty-random').addEventListener('click', (e) => {
      if (e.target.closest('.empty-btn')) switchTab('manage');
    });

    // 管理页：新增分类
    $('btn-add-cat').addEventListener('click', openAddCategoryModal);

    // 管理页：分类/餐厅操作（事件委托）
    $('manage-body').addEventListener('click', (e) => {
      const editCatBtn = e.target.closest('[data-action="edit-cat"]');
      const delCatBtn = e.target.closest('[data-action="del-cat"]');
      const editResBtn = e.target.closest('[data-action="edit-res"]');
      const delResBtn = e.target.closest('[data-action="del-res"]');
      const addResBtn = e.target.closest('[data-action="add-res"]');

      if (editCatBtn) openEditCategoryModalById(editCatBtn.dataset.catId);
      if (delCatBtn) deleteCategory(delCatBtn.dataset.catId);
      if (editResBtn) openEditRestaurantModalById(editResBtn.dataset.catId, editResBtn.dataset.resId);
      if (delResBtn) deleteRestaurant(delResBtn.dataset.resId);
      if (addResBtn) openAddRestaurantModal(addResBtn.dataset.catId);
    });

    // 分类 chips（事件委托）
    $('category-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) selectCategory(chip.dataset.id || '');
    });

    // 分类 Modal
    $('modal-category').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal('modal-category');
    });
    $('modal-category').querySelector('.modal-close').addEventListener('click', () => closeModal('modal-category'));
    $('modal-category').querySelector('.modal-btn.cancel').addEventListener('click', () => closeModal('modal-category'));
    $('btn-save-cat').addEventListener('click', saveCategory);

    // 餐厅 Modal
    $('modal-restaurant').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal('modal-restaurant');
    });
    $('modal-restaurant').querySelector('.modal-close').addEventListener('click', () => closeModal('modal-restaurant'));
    $('modal-restaurant').querySelector('.modal-btn.cancel').addEventListener('click', () => closeModal('modal-restaurant'));
    $('btn-save-res').addEventListener('click', saveRestaurant);

    // 菜单输入
    $('menu-item-input').addEventListener('keydown', handleMenuKeydown);
    document.querySelector('.menu-add-btn').addEventListener('click', addMenuTag);

    // Emoji 选择器（事件委托）
    $('emoji-picker').addEventListener('click', (e) => {
      const opt = e.target.closest('.emoji-option');
      if (opt) selectEmoji(opt, opt.dataset.emoji);
    });

    // 全局键盘
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(m => closeModal(m.id));
      }
    });

    // 设置面板
    $('settings-toggle').addEventListener('click', () => {
      $('settings-section').classList.toggle('collapsed');
    });
    $('btn-save-settings').addEventListener('click', saveSettings);
    $('toggle-key-vis').addEventListener('click', () => {
      const input = $('api-key-input');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  // ── 标签切换 ─────────────────────────────────────────────────────────
  function switchTab(tab) {
    state.currentTab = tab;
    $('tab-random').classList.toggle('active', tab === 'random');
    $('tab-manage').classList.toggle('active', tab === 'manage');
    $('page-random').classList.toggle('active', tab === 'random');
    $('page-manage').classList.toggle('active', tab === 'manage');
    if (tab === 'random') updateRandomPageVisibility();
  }

  // ── 渲染: 分类 Chips ─────────────────────────────────────────────────
  function renderCategoryChips() {
    const container = $('category-chips');
    const chips = state.categories.map(cat =>
      `<button class="chip${cat.id === state.selectedCategoryId ? ' active' : ''}" data-id="${cat.id}">${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</button>`
    ).join('');
    container.innerHTML = `<button class="chip${state.selectedCategoryId ? '' : ' active'}" data-id="" id="chip-all">🍽️ 全部随机</button>` + chips;
  }

  function selectCategory(catId) {
    state.selectedCategoryId = catId;
    renderCategoryChips();
    $('result-card').classList.remove('show');
  }

  // ── 随机决定 ─────────────────────────────────────────────────────────
  async function doRandom() {
    if (state.spinning) return;
    state.spinning = true;

    const btn = $('spin-btn');
    btn.disabled = true;
    btn.style.opacity = '0.6';

    const catId = state.selectedCategoryId;

    try {
      const res = await fetch(API.random(catId));
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || '暂无可用餐厅', 'error');
        return;
      }
      const data = await res.json();
      showResult(data);
    } catch {
      showToast('请求失败，请检查网络', 'error');
    } finally {
      state.spinning = false;
      btn.disabled = false;
      btn.style.opacity = '';
    }
  }

  function showResult(data) {
    const card = $('result-card');
    $('result-badge').textContent = `${data.category.icon} ${data.category.name}`;
    $('result-emoji').textContent = data.category.icon;
    $('result-restaurant').textContent = data.restaurant.name;
    $('result-address').textContent = data.restaurant.address || '';
    $('result-dish').textContent = data.recommended_dish || '（暂无菜单）';

    const menuList = $('result-menu-list');
    if (data.restaurant.menu && data.restaurant.menu.length > 0) {
      menuList.innerHTML = data.restaurant.menu.map(d => `<div class="menu-item-row">🍴 ${escapeHtml(d)}</div>`).join('');
      menuList.classList.remove('show');
      card.querySelector('.result-menu-toggle').style.display = '';
    } else {
      menuList.innerHTML = '';
      menuList.classList.remove('show');
      card.querySelector('.result-menu-toggle').style.display = 'none';
    }

    // AI 图片区域
    const imgEl = $('result-ai-image');
    const imgLoading = $('result-ai-image-loading');
    imgEl.style.display = 'none';
    imgEl.src = '';
    imgLoading.style.display = '';

    // AI 推荐语区域
    const aiText = $('result-ai-text');
    aiText.textContent = '';
    aiText.style.display = '';
    const aiLoading = $('result-ai-loading');
    aiLoading.style.display = '';

    card.classList.remove('show');
    void card.offsetWidth;
    card.classList.add('show');

    const aiPayload = {
      restaurant: data.restaurant.name,
      dish: data.recommended_dish || '',
      category: data.category.name,
    };

    fetchAIRecommend(aiPayload);
    fetchAIImage(aiPayload);
  }

  async function fetchAIRecommend(payload) {
    const aiText = $('result-ai-text');
    const aiLoading = $('result-ai-loading');

    try {
      const res = await fetch(API.aiRecommend, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      aiLoading.style.display = 'none';

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      aiText.textContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') break;
          try {
            const chunk = JSON.parse(payload);
            if (chunk.content) aiText.textContent += chunk.content;
            if (chunk.error) { showToast(chunk.error, 'error'); break; }
          } catch {}
        }
      }
    } catch {
      aiLoading.style.display = 'none';
      aiText.textContent = '';
    }
  }

  async function fetchAIImage(payload) {
    const imgEl = $('result-ai-image');
    const imgLoading = $('result-ai-image-loading');

    try {
      const res = await fetch(API.aiImage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      imgLoading.style.display = 'none';
      if (data.image_url) {
        imgEl.src = data.image_url;
        imgEl.style.display = '';
        imgEl.onload = () => { imgEl.classList.add('loaded'); };
        imgEl.onerror = () => { imgEl.style.display = 'none'; };
      }
    } catch {
      imgLoading.style.display = 'none';
    }
  }



  function toggleMenu() {
    $('result-menu-list').classList.toggle('show');
  }

  // ── 更新随机页面可见性 ──────────────────────────────────────────────
  function updateRandomPageVisibility() {
    const hasData = state.categories.some(c => c.restaurants.length > 0);
    $('category-selector').style.display = hasData ? '' : 'none';
    document.querySelector('.spin-area').style.display = hasData ? '' : 'none';
    $('result-card').classList.remove('show');
    $('result-card').style.display = hasData ? '' : 'none';
    $('empty-random').style.display = hasData ? 'none' : '';
  }

  // ── 分类 CRUD ────────────────────────────────────────────────────────
  function openAddCategoryModal() {
    state.editingCatId = null;
    $('modal-cat-title').textContent = '新增分类';
    $('cat-name-input').value = '';
    $('cat-icon-input').value = '';
    document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
    $('btn-save-cat').textContent = '创建';
    showModal('modal-category');
  }

  function openEditCategoryModal(cat) {
    state.editingCatId = cat.id;
    $('modal-cat-title').textContent = '编辑分类';
    $('cat-name-input').value = cat.name;
    $('cat-icon-input').value = cat.icon;
    document.querySelectorAll('.emoji-option').forEach(e => {
      e.classList.toggle('selected', e.dataset.emoji === cat.icon);
    });
    $('btn-save-cat').textContent = '保存';
    showModal('modal-category');
  }

  function openEditCategoryModalById(catId) {
    const cat = findCategoryById(catId);
    if (!cat) {
      showToast('分类不存在或已被删除', 'error');
      return;
    }
    openEditCategoryModal(cat);
  }

  async function saveCategory() {
    if (state.spinning) return;
    state.spinning = true;

    const name = $('cat-name-input').value.trim();
    const icon = $('cat-icon-input').value.trim() || '🍽️';

    if (!name) { showToast('分类名称不能为空', 'error'); state.spinning = false; return; }

    try {
      let res;
      if (state.editingCatId) {
        res = await fetch(API.category(state.editingCatId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon }),
        });
      } else {
        res = await fetch(API.categories, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }

      closeModal('modal-category');
      await fetchCategories();
      showToast(state.editingCatId ? '分类已更新' : '分类已创建', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      state.spinning = false;
    }
  }

  async function deleteCategory(catId) {
    if (!confirm('确定要删除该分类及其下所有餐厅吗？此操作不可恢复。')) return;

    try {
      const res = await fetch(API.category(catId), { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      await fetchCategories();
      showToast('分类已删除', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // ── 餐厅 CRUD ────────────────────────────────────────────────────────
  function openAddRestaurantModal(catId) {
    state.editingResId = null;
    state.editingResCatId = catId;
    state.tempMenu = [];
    $('modal-res-title').textContent = '新增餐厅';
    $('res-name-input').value = '';
    $('res-addr-input').value = '';
    $('btn-save-res').textContent = '创建';
    renderMenuTags();
    showModal('modal-restaurant');
  }

  function openEditRestaurantModal(catId, res) {
    state.editingResId = res.id;
    state.editingResCatId = catId;
    state.tempMenu = [...res.menu];
    $('modal-res-title').textContent = '编辑餐厅';
    $('res-name-input').value = res.name;
    $('res-addr-input').value = res.address || '';
    $('btn-save-res').textContent = '保存';
    renderMenuTags();
    showModal('modal-restaurant');
  }

  function openEditRestaurantModalById(catId, resId) {
    const res = findRestaurantById(catId, resId);
    if (!res) {
      showToast('餐厅不存在或已被删除', 'error');
      return;
    }
    openEditRestaurantModal(catId, res);
  }

  async function saveRestaurant() {
    if (state.spinning) return;
    state.spinning = true;

    const name = $('res-name-input').value.trim();
    const address = $('res-addr-input').value.trim();

    if (!name) { showToast('餐厅名称不能为空', 'error'); state.spinning = false; return; }

    try {
      let res;
      if (state.editingResId) {
        res = await fetch(API.restaurant(state.editingResId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, address, menu: state.tempMenu }),
        });
      } else {
        res = await fetch(API.restaurants(state.editingResCatId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, address, menu: state.tempMenu }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }

      closeModal('modal-restaurant');
      await fetchCategories();
      showToast(state.editingResId ? '餐厅已更新' : '餐厅已创建', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      state.spinning = false;
    }
  }

  async function deleteRestaurant(resId) {
    if (!confirm('确定要删除该餐厅吗？')) return;

    try {
      const res = await fetch(API.restaurant(resId), { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      await fetchCategories();
      showToast('餐厅已删除', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // ── 菜单标签操作 ─────────────────────────────────────────────────────
  function addMenuTag() {
    const input = $('menu-item-input');
    const raw = input.value.trim();
    if (!raw) return;
    const items = raw.split(/\s+/).filter(Boolean);
    let added = 0;
    for (const item of items) {
      if (!state.tempMenu.includes(item)) {
        state.tempMenu.push(item);
        added++;
      }
    }
    input.value = '';
    input.focus();
    renderMenuTags();
    if (items.length > 1 && added > 0) {
      showToast(`已添加 ${added} 个菜品`, 'success');
    }
  }

  function removeMenuTag(idx) {
    state.tempMenu.splice(idx, 1);
    renderMenuTags();
  }

  function handleMenuKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addMenuTag();
    }
  }

  function renderMenuTags() {
    const container = $('menu-tags');
    if (state.tempMenu.length === 0) {
      container.innerHTML = '<span style="color:var(--text-muted);font-size:0.82rem;">暂无菜品，请在下方添加</span>';
      return;
    }
    container.innerHTML = state.tempMenu.map((m, i) =>
      `<span class="menu-tag">${escapeHtml(m)}<span class="menu-tag-remove" data-remove-idx="${i}">×</span></span>`
    ).join('');
  }

  // 菜单标签删除（事件委托）
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-idx]');
    if (removeBtn) removeMenuTag(Number(removeBtn.dataset.removeIdx));
  });

  // ── 渲染: 管理页面 ──────────────────────────────────────────────────
  function renderManageBody() {
    const container = $('manage-body');

    if (state.categories.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="display:block;grid-column:1/-1;padding:40px 20px;">
          <div class="empty-icon">📂</div>
          <div class="empty-text">还没有分类</div>
          <div class="empty-sub">点击上方按钮新增第一个分类吧</div>
        </div>`;
      return;
    }

    container.innerHTML = state.categories.map(cat => `
      <div class="cat-card">
        <div class="cat-card-header">
          <div class="cat-card-title">
            <span class="cat-card-icon">${escapeHtml(cat.icon)}</span>${escapeHtml(cat.name)}
          </div>
          <div class="cat-card-actions">
            <button class="icon-btn edit" data-action="edit-cat" data-cat-id="${cat.id}" title="编辑">✎</button>
            <button class="icon-btn del" data-action="del-cat" data-cat-id="${cat.id}" title="删除">✕</button>
          </div>
        </div>
        <div class="cat-card-body">
          ${cat.restaurants.length === 0
            ? '<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;text-align:center;">暂无餐厅</div>'
            : cat.restaurants.map(r => `
              <div class="restaurant-item">
                <div class="res-info">
                  <div class="res-name">${escapeHtml(r.name)}</div>
                  ${r.address ? `<div class="res-addr">📍 ${escapeHtml(r.address)}</div>` : ''}
                  <div class="res-menu-tags">
                    ${r.menu.slice(0, 4).map(d => `<span class="res-menu-tag">${escapeHtml(d)}</span>`).join('')}
                    ${r.menu.length > 4 ? `<span class="res-menu-tag">+${r.menu.length - 4}</span>` : ''}
                  </div>
                </div>
                <div class="res-item-actions">
                  <button class="icon-btn edit" data-action="edit-res" data-cat-id="${cat.id}" data-res-id="${r.id}" title="编辑">✎</button>
                  <button class="icon-btn del" data-action="del-res" data-res-id="${r.id}" title="删除">✕</button>
                </div>
              </div>
            `).join('')
          }
          <button class="add-restaurant-btn" data-action="add-res" data-cat-id="${cat.id}">＋ 添加餐厅</button>
        </div>
      </div>
    `).join('');
  }

  // ── Emoji 选择器 ─────────────────────────────────────────────────────
  function renderEmojiPicker() {
    const container = $('emoji-picker');
    container.innerHTML = COMMON_EMOJIS.map(e =>
      `<span class="emoji-option" data-emoji="${e}">${e}</span>`
    ).join('');
  }

  function selectEmoji(el, emoji) {
    document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    $('cat-icon-input').value = emoji;
  }

  // ── Modal 工具 ───────────────────────────────────────────────────────
  function showModal(id) {
    $(id).classList.add('show');
  }

  function closeModal(id) {
    $(id).classList.remove('show');
  }

  // ── Toast 通知 ───────────────────────────────────────────────────────
  function showToast(message, type) {
    const toast = $('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;

    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // ── AI 配置 ─────────────────────────────────────────────────────────
  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      const statusEl = $('api-key-status');
      if (data.has_env_key) {
        statusEl.textContent = '✅ 已配置（环境变量）';
      } else if (data.has_stored_key) {
        statusEl.textContent = `✅ 已配置 ${data.api_key_masked}`;
      } else {
        statusEl.textContent = '⚠️ 未配置，AI 推荐和图片功能不可用';
      }
    } catch {}
  }

  async function saveSettings() {
    const key = $('api-key-input').value.trim();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siliconflow_api_key: key }),
      });
      if (!res.ok) throw new Error();
      showToast('API Key 已保存', 'success');
      $('api-key-input').value = '';
      await fetchSettings();
    } catch {
      showToast('保存失败', 'error');
    }
  }

  // ── 启动 ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
