/* ═══════════════════════════════════════════════════════════════════════════
   今天吃什么？— 随机美食决策系统 交互脚本
   ═══════════════════════════════════════════════════════════════════════════ */

// ── 状态 ─────────────────────────────────────────────────────────────────
const state = {
  categories: [],
  currentTab: 'random',
  selectedCategoryId: '',
  editingCatId: null,
  editingResId: null,
  editingResCatId: null,
  tempMenu: [],
};

// ── 通用 Emoji ────────────────────────────────────────────────────────────
const COMMON_EMOJIS = ['🍽️','🥢','🍣','🍔','🍕','🍜','🍰','🍩','🥩','🍲','🌮','🍱','🍝','🍳','🥗','🍿'];

// ── 初始化 ───────────────────────────────────────────────────────────────
async function init() {
  await fetchCategories();
  renderEmojiPicker();
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
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

// ── 标签切换 ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.currentTab = tab;
  document.getElementById('tab-random').classList.toggle('active', tab === 'random');
  document.getElementById('tab-manage').classList.toggle('active', tab === 'manage');
  document.getElementById('page-random').classList.toggle('active', tab === 'random');
  document.getElementById('page-manage').classList.toggle('active', tab === 'manage');
  if (tab === 'random') updateRandomPageVisibility();
}

// ── 渲染: 分类 Chips ─────────────────────────────────────────────────────
function renderCategoryChips() {
  const container = document.getElementById('category-chips');
  const chips = state.categories.map(cat =>
    `<button class="chip${cat.id === state.selectedCategoryId ? ' active' : ''}" data-id="${cat.id}" onclick="selectCategory('${cat.id}')">${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</button>`
  ).join('');
  container.innerHTML = `<button class="chip${state.selectedCategoryId ? '' : ' active'}" data-id="" id="chip-all" onclick="selectCategory('')">🍽️ 全部随机</button>` + chips;
}

function selectCategory(catId) {
  state.selectedCategoryId = catId;
  renderCategoryChips();
  // 重置结果卡片显示
  const card = document.getElementById('result-card');
  card.classList.remove('show');
}

function getSelectedCategoryId() {
  return state.selectedCategoryId;
}

// ── 随机决定 ─────────────────────────────────────────────────────────────
async function doRandom() {
  const catId = getSelectedCategoryId();
  const params = catId ? `?category_id=${catId}` : '';

  try {
    const res = await fetch(`/api/random${params}`);
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '暂无可用餐厅', 'error');
      return;
    }
    const data = await res.json();
    showResult(data);
  } catch (e) {
    showToast('请求失败，请检查网络', 'error');
  }
}

function showResult(data) {
  const card = document.getElementById('result-card');
  document.getElementById('result-badge').textContent = `${data.category.icon} ${data.category.name}`;
  document.getElementById('result-emoji').textContent = data.category.icon;
  document.getElementById('result-restaurant').textContent = data.restaurant.name;
  document.getElementById('result-address').textContent = data.restaurant.address || '';
  document.getElementById('result-dish').textContent = data.recommended_dish || '（暂无菜单）';

  // 完整菜单
  const menuList = document.getElementById('result-menu-list');
  if (data.restaurant.menu && data.restaurant.menu.length > 0) {
    menuList.innerHTML = data.restaurant.menu.map(d => `<div class="menu-item-row">🍴 ${escapeHtml(d)}</div>`).join('');
    menuList.classList.remove('show');
    document.querySelector('.result-menu-toggle').style.display = '';
  } else {
    menuList.innerHTML = '';
    menuList.classList.remove('show');
    document.querySelector('.result-menu-toggle').style.display = 'none';
  }

  card.classList.remove('show');
  void card.offsetWidth; // 强制回流以重新触发动画
  card.classList.add('show');
}

function toggleMenu() {
  document.getElementById('result-menu-list').classList.toggle('show');
}

// ── 更新随机页面可见性 ────────────────────────────────────────────────────
function updateRandomPageVisibility() {
  const hasData = state.categories.some(c => c.restaurants.length > 0);
  document.getElementById('category-selector').style.display = hasData ? '' : 'none';
  document.querySelector('.spin-area').style.display = hasData ? '' : 'none';
  document.getElementById('result-card').classList.remove('show');
  document.getElementById('result-card').style.display = hasData ? '' : 'none';
  document.getElementById('empty-random').style.display = hasData ? 'none' : '';
}

// ── 分类 CRUD ────────────────────────────────────────────────────────────
function openAddCategoryModal() {
  state.editingCatId = null;
  document.getElementById('modal-cat-title').textContent = '新增分类';
  document.getElementById('cat-name-input').value = '';
  document.getElementById('cat-icon-input').value = '';
  document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
  document.getElementById('btn-save-cat').textContent = '创建';
  showModal('modal-category');
}

function openEditCategoryModal(cat) {
  state.editingCatId = cat.id;
  document.getElementById('modal-cat-title').textContent = '编辑分类';
  document.getElementById('cat-name-input').value = cat.name;
  document.getElementById('cat-icon-input').value = cat.icon;
  document.querySelectorAll('.emoji-option').forEach(e => {
    e.classList.toggle('selected', e.dataset.emoji === cat.icon);
  });
  document.getElementById('btn-save-cat').textContent = '保存';
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
  const name = document.getElementById('cat-name-input').value.trim();
  const icon = document.getElementById('cat-icon-input').value.trim() || '🍽️';

  if (!name) { showToast('分类名称不能为空', 'error'); return; }

  try {
    let res;
    if (state.editingCatId) {
      res = await fetch(`/api/categories/${state.editingCatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon }),
      });
    } else {
      res = await fetch('/api/categories', {
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
  }
}

async function deleteCategory(catId) {
  if (!confirm('确定要删除该分类及其下所有餐厅吗？此操作不可恢复。')) return;

  try {
    const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    await fetchCategories();
    showToast('分类已删除', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── 餐厅 CRUD ────────────────────────────────────────────────────────────
function openAddRestaurantModal(catId) {
  state.editingResId = null;
  state.editingResCatId = catId;
  state.tempMenu = [];
  document.getElementById('modal-res-title').textContent = '新增餐厅';
  document.getElementById('res-name-input').value = '';
  document.getElementById('res-addr-input').value = '';
  document.getElementById('btn-save-res').textContent = '创建';
  renderMenuTags();
  showModal('modal-restaurant');
}

function openEditRestaurantModal(catId, res) {
  state.editingResId = res.id;
  state.editingResCatId = catId;
  state.tempMenu = [...res.menu];
  document.getElementById('modal-res-title').textContent = '编辑餐厅';
  document.getElementById('res-name-input').value = res.name;
  document.getElementById('res-addr-input').value = res.address || '';
  document.getElementById('btn-save-res').textContent = '保存';
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
  const name = document.getElementById('res-name-input').value.trim();
  const address = document.getElementById('res-addr-input').value.trim();

  if (!name) { showToast('餐厅名称不能为空', 'error'); return; }

  try {
    let res;
    if (state.editingResId) {
      res = await fetch(`/api/restaurants/${state.editingResId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, menu: state.tempMenu }),
      });
    } else {
      res = await fetch(`/api/categories/${state.editingResCatId}/restaurants`, {
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
  }
}

async function deleteRestaurant(resId) {
  if (!confirm('确定要删除该餐厅吗？')) return;

  try {
    const res = await fetch(`/api/restaurants/${resId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    await fetchCategories();
    showToast('餐厅已删除', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── 菜单标签操作 ─────────────────────────────────────────────────────────
function addMenuTag() {
  const input = document.getElementById('menu-item-input');
  const val = input.value.trim();
  if (!val) return;
  if (state.tempMenu.includes(val)) { showToast('该菜品已存在', 'error'); return; }
  state.tempMenu.push(val);
  input.value = '';
  input.focus();
  renderMenuTags();
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
  const container = document.getElementById('menu-tags');
  if (state.tempMenu.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:0.82rem;">暂无菜品，请在下方添加</span>';
    return;
  }
  container.innerHTML = state.tempMenu.map((m, i) =>
    `<span class="menu-tag">${escapeHtml(m)}<span class="menu-tag-remove" onclick="removeMenuTag(${i})">×</span></span>`
  ).join('');
}

// ── 渲染: 管理页面 ────────────────────────────────────────────────────────
function renderManageBody() {
  const container = document.getElementById('manage-body');

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
          <button class="icon-btn edit" onclick="openEditCategoryModalById('${cat.id}')" title="编辑">✎</button>
          <button class="icon-btn del" onclick="deleteCategory('${cat.id}')" title="删除">✕</button>
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
                <button class="icon-btn edit" onclick="openEditRestaurantModalById('${cat.id}', '${r.id}')" title="编辑">✎</button>
                <button class="icon-btn del" onclick="deleteRestaurant('${r.id}')" title="删除">✕</button>
              </div>
            </div>
          `).join('')
        }
        <button class="add-restaurant-btn" onclick="openAddRestaurantModal('${cat.id}')">＋ 添加餐厅</button>
      </div>
    </div>
  `).join('');
}

// ── Emoji 选择器 ─────────────────────────────────────────────────────────
function renderEmojiPicker() {
  const container = document.getElementById('emoji-picker');
  container.innerHTML = COMMON_EMOJIS.map(e =>
    `<span class="emoji-option" data-emoji="${e}" onclick="selectEmoji(this, '${e}')">${e}</span>`
  ).join('');
}

function selectEmoji(el, emoji) {
  document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('cat-icon-input').value = emoji;
}

// ── Modal 工具 ────────────────────────────────────────────────────────────
function showModal(id) {
  document.getElementById(id).classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

function closeModalOnBg(event, id) {
  if (event.target === event.currentTarget) closeModal(id);
}

// ── Toast 通知 ────────────────────────────────────────────────────────────
function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`; // reset + set type

  void toast.offsetWidth; // 强制回流
  toast.classList.add('show');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ── 键盘快捷键 ────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => closeModal(m.id));
  }
});

// ── 启动 ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
