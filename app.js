/* ===== app.js — GitHub AI 雷达前端逻辑 ===== */

const DATA_URL = './radar_history.json';
const RAW_DATA_URL = './raw_trending.json';

// ===== 全局状态 =====
let allProjects = [];
let rawProjects = [];
let currentPage = 'analyzed';
let currentSort = { key: 'total', dir: 'desc' };
let searchQuery = '';
let trackFilter = 'all';
let currentPageNum = 1;
let rawCurrentPageNum = 1;
const PAGE_SIZE = 15;
const RAW_PAGE_SIZE = 10;

// ===== 初始化 =====
async function init() {
  try {
    // 加载分析数据
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('数据加载失败');
    allProjects = await res.json();

    // 加载原始榜单数据
    try {
      const rawRes = await fetch(RAW_DATA_URL + '?t=' + Date.now());
      if (rawRes.ok) {
        const rawData = await rawRes.json();
        rawProjects = rawData.projects || [];
        document.getElementById('raw-date').textContent = rawData.date || '—';
        document.getElementById('raw-count').textContent = rawProjects.length;
      }
    } catch (e) {
      console.log('原始榜单数据加载失败:', e);
    }

    updateLastUpdate();
    updateStats();
    buildDateOptions();
    renderTop3();
    renderHistory();
    renderRawList();
    bindEvents();
    bindNavEvents();
  } catch (e) {
    console.error(e);
    document.getElementById('top3-grid').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1"><div class="icon">⚠️</div><p>数据加载失败</p></div>`;
    document.getElementById('history-tbody').innerHTML =
      `<tr><td colspan="10" class="loading-cell"><div class="empty-state"><div class="icon">⚠️</div><p>无数据</p></div></td></tr>`;
  }
}

// ===== 导航事件 =====
function bindNavEvents() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      switchPage(page);
    });
  });
}

function switchPage(page) {
  currentPage = page;
  
  // 更新导航按钮状态
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === page);
  });
  
  // 切换页面内容
  document.querySelectorAll('.page-content').forEach(content => {
    content.classList.toggle('active', content.id === `page-${page}`);
  });
}

// ===== 更新统计看板 =====
function updateStats() {
  if (!allProjects.length) return;
  const dates = [...new Set(allProjects.map(p => p.date))].sort().reverse();
  const latestDate = dates[0];
  const todayProjects = allProjects.filter(p => p.date === latestDate);

  document.getElementById('stat-total').textContent = allProjects.length;
  document.getElementById('stat-today').textContent = todayProjects.length;
  document.getElementById('stat-days').textContent = dates.length;
  
  const avg = todayProjects.length
    ? (todayProjects.reduce((s, p) => s + p.scores.total, 0) / todayProjects.length).toFixed(1)
    : '—';
  document.getElementById('stat-avg').textContent = avg;
  
  const topScore = todayProjects.length
    ? Math.max(...todayProjects.map(p => p.scores.total))
    : '—';
  document.getElementById('stat-top-score').textContent = topScore;
}

// ===== 更新最后更新时间 =====
function updateLastUpdate() {
  if (!allProjects.length) return;
  const dates = [...new Set(allProjects.map(p => p.date))].sort().reverse();
  const latest = dates[0];
  document.getElementById('last-update').textContent = `最近更新：${latest}`;
}

// ===== 构建日期选项 =====
function buildDateOptions() {
  const dates = [...new Set(allProjects.map(p => p.date))].sort().reverse();
  const sel = document.getElementById('top3-date');
  dates.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d + (i === 0 ? ' (最新)' : '');
    sel.appendChild(opt);
  });
}

// ===== 渲染 Top 3 =====
function renderTop3(date) {
  const dates = [...new Set(allProjects.map(p => p.date))].sort().reverse();
  const targetDate = date || dates[0];

  // 取当天 is_top 项目，不足则按分数补，最终按总分降序排列
  let tops = allProjects.filter(p => p.date === targetDate && p.is_top);
  if (tops.length < 3) {
    const others = allProjects
      .filter(p => p.date === targetDate && !p.is_top)
      .sort((a, b) => b.scores.total - a.scores.total);
    tops = [...tops, ...others].slice(0, 3);
  }
  tops = tops.sort((a, b) => b.scores.total - a.scores.total).slice(0, 3);

  const grid = document.getElementById('top3-grid');
  if (!tops.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">📭</div><p>该日期暂无数据</p></div>`;
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const rankClass = ['rank-1', 'rank-2', 'rank-3'];

  grid.innerHTML = tops.map((p, i) => {
    const s = p.scores;
    return `
    <div class="top3-card ${rankClass[i]}" onclick="openModal('${p.id}')">
      <div class="card-rank-badge">${medals[i]}</div>
      <div class="card-header">
        <div class="card-title">
          <a href="${p.url}" target="_blank" onclick="event.stopPropagation()">${p.title}</a>
        </div>
        <div class="card-stars">⭐ ${p.stars || 0}</div>
      </div>
      <div class="card-description">${p.description}</div>
      <div class="card-scores">
        <div class="score-item">
          <span class="score-label">Vibecoding</span>
          <div class="score-bar-wrap">
            <div class="score-bar"><div class="score-bar-fill vibe" style="width:${(s.vibecoding_ease/3)*100}%"></div></div>
            <span class="score-val">${s.vibecoding_ease}/3</span>
          </div>
        </div>
        <div class="score-item">
          <span class="score-label">逻辑护城河</span>
          <div class="score-bar-wrap">
            <div class="score-bar"><div class="score-bar-fill moat" style="width:${(s.logic_moat/3)*100}%"></div></div>
            <span class="score-val">${s.logic_moat}/3</span>
          </div>
        </div>
        <div class="score-item">
          <span class="score-label">赛道契合</span>
          <div class="score-bar-wrap">
            <div class="score-bar"><div class="score-bar-fill track" style="width:${(s.track_fit/2)*100}%"></div></div>
            <span class="score-val">${s.track_fit}/2</span>
          </div>
        </div>
        <div class="score-item">
          <span class="score-label">增长潜力</span>
          <div class="score-bar-wrap">
            <div class="score-bar"><div class="score-bar-fill growth" style="width:${(s.growth_potential/2)*100}%"></div></div>
            <span class="score-val">${s.growth_potential}/2</span>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <div class="total-score">
          <span class="num">${s.total}</span>
          <span class="denom">/12</span>
        </div>
        <span class="card-date">${p.date}</span>
      </div>
    </div>`;
  }).join('');
}

// ===== 渲染历史列表 =====
function renderHistory() {
  let list = [...allProjects];
  
  // 搜索筛选
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p => 
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }
  
  // 赛道筛选
  if (trackFilter !== 'all') {
    switch(trackFilter) {
      case 'top':
        list = list.filter(p => p.is_top);
        break;
      case 'high':
        list = list.filter(p => p.scores.total >= 8);
        break;
      case 'vibe':
        list = list.filter(p => p.scores.vibecoding_ease >= 3);
        break;
      case 'growth':
        list = list.filter(p => p.scores.growth_potential >= 2);
        break;
    }
  }
  
  // 排序
  list.sort((a, b) => {
    let aVal, bVal;
    switch(currentSort.key) {
      case 'title': aVal = a.title; bVal = b.title; break;
      case 'date': aVal = a.date; bVal = b.date; break;
      case 'vibecoding_ease': aVal = a.scores.vibecoding_ease; bVal = b.scores.vibecoding_ease; break;
      case 'logic_moat': aVal = a.scores.logic_moat; bVal = b.scores.logic_moat; break;
      case 'track_fit': aVal = a.scores.track_fit; bVal = b.scores.track_fit; break;
      case 'growth_potential': aVal = a.scores.growth_potential; bVal = b.scores.growth_potential; break;
      default: aVal = a.scores.total; bVal = b.scores.total;
    }
    return currentSort.dir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });
  
  // 更新总数
  document.getElementById('total-count').textContent = list.length;
  
  // 分页
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const start = (currentPageNum - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);
  
  // 渲染表格
  const tbody = document.getElementById('history-tbody');
  if (!pageItems.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading-cell"><div class="empty-state"><div class="icon">📭</div><p>无匹配项目</p></div></td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map((p, i) => `
      <tr onclick="openModal('${p.id}')">
        <td class="col-rank">${start + i + 1}</td>
        <td class="col-title">
          <div class="project-title">${escapeHtml(p.title)}</div>
          <div class="project-desc">${escapeHtml(p.description).substring(0, 60)}...</div>
        </td>
        <td class="col-date">${p.date}</td>
        <td class="col-stars">⭐ ${p.stars || 0}</td>
        <td class="col-score total">${p.scores.total}</td>
        <td class="col-score">${p.scores.vibecoding_ease}</td>
        <td class="col-score">${p.scores.logic_moat}</td>
        <td class="col-score">${p.scores.track_fit}</td>
        <td class="col-score">${p.scores.growth_potential}</td>
        <td class="col-top">${p.is_top ? '🏆' : ''}</td>
      </tr>
    `).join('');
  }
  
  // 渲染分页
  renderPagination(totalPages, currentPageNum, 'pagination', (page) => {
    currentPageNum = page;
    renderHistory();
  });
}

// ===== 渲染原始榜单 =====
function renderRawList() {
  const container = document.getElementById('raw-list');
  
  if (!rawProjects.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>暂无原始榜单数据</p></div>`;
    return;
  }
  
  // 分页
  const totalPages = Math.ceil(rawProjects.length / RAW_PAGE_SIZE);
  const start = (rawCurrentPageNum - 1) * RAW_PAGE_SIZE;
  const pageItems = rawProjects.slice(start, start + RAW_PAGE_SIZE);
  
  container.innerHTML = pageItems.map(p => `
    <div class="raw-item" onclick="openRawModal(${p.rank})">
      <div class="raw-rank">#${p.rank}</div>
      <div class="raw-content">
        <div class="raw-header">
          <h3 class="raw-title">
            <a href="${p.url}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(p.title)}</a>
          </h3>
          <div class="raw-stats">
            <span class="raw-stars">⭐ ${p.stars}</span>
            <span class="raw-forks">🍴 ${p.forks}</span>
            ${p.language ? `<span class="raw-lang">📦 ${p.language}</span>` : ''}
          </div>
        </div>
        <div class="raw-chinese-summary">${escapeHtml(p.chinese_summary || '')}</div>
        <p class="raw-desc">${escapeHtml(p.description)}</p>
        ${p.topics && p.topics.length ? `
          <div class="raw-topics">
            ${p.topics.map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="raw-click-hint">👆 点击查看详情</div>
      </div>
    </div>
  `).join('');
  
  // 渲染分页
  renderPagination(totalPages, rawCurrentPageNum, 'raw-pagination', (page) => {
    rawCurrentPageNum = page;
    renderRawList();
  });
}

// ===== 打开原始榜单详情弹窗 =====
function openRawModal(rank) {
  const p = rawProjects.find(x => x.rank === rank);
  if (!p) return;
  
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-header">
      <h2>${escapeHtml(p.title)}</h2>
      <div class="modal-stars">⭐ ${p.stars} stars · 🍴 ${p.forks} forks</div>
    </div>
    <div class="modal-date">📅 ${p.date} · 📦 ${p.language || 'Unknown'}</div>
    
    <div class="modal-category" style="margin: 16px 0; padding: 8px 16px; background: var(--accent-bg); border-radius: var(--radius); color: var(--accent); font-weight: 500;">
      ${escapeHtml(p.category || '开发工具')}
    </div>
    
    <div class="modal-desc">
      <h4>📝 项目介绍</h4>
      <p style="white-space: pre-line;">${escapeHtml(p.detailed_description || p.description)}</p>
    </div>
    
    ${p.metaphor ? `
    <div class="modal-metaphor" style="background: var(--gold-bg); padding: 16px; border-radius: var(--radius); margin: 16px 0; border-left: 4px solid var(--gold);">
      <h4 style="color: var(--gold); margin-bottom: 8px;">💡 通俗理解</h4>
      <p style="color: var(--text-primary); margin: 0;">${escapeHtml(p.metaphor)}</p>
    </div>
    ` : ''}
    
    ${p.usage ? `
    <div class="modal-usage" style="margin: 16px 0;">
      <h4>🎯 适合谁用</h4>
      <p>${escapeHtml(p.usage)}</p>
    </div>
    ` : ''}
    
    ${p.topics && p.topics.length ? `
    <div class="modal-topics" style="margin: 16px 0;">
      <h4>🏷️ 相关标签</h4>
      <div class="raw-topics" style="margin-top: 8px;">
        ${p.topics.map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="modal-actions">
      <a href="${p.url}" target="_blank" class="btn-primary">🔗 访问 GitHub</a>
      ${p.homepage ? `<a href="${p.homepage}" target="_blank" class="btn-outline">🌐 项目主页</a>` : ''}
    </div>
  `;
  
  document.getElementById('modal-overlay').classList.add('open');
}

// ===== 渲染分页控件 =====
function renderPagination(totalPages, currentPage, containerId, onPageChange) {
  const container = document.getElementById(containerId);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '<div class="pagination-inner">';
  
  // 上一页
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${onPageChange.name}(${currentPage - 1})">上一页</button>`;
  
  // 页码
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  if (startPage > 1) {
    html += `<button class="page-btn" onclick="${onPageChange.name}(1)">1</button>`;
    if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
  }
  
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange.name}(${i})">${i}</button>`;
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
    html += `<button class="page-btn" onclick="${onPageChange.name}(${totalPages})">${totalPages}</button>`;
  }
  
  // 下一页
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${onPageChange.name}(${currentPage + 1})">下一页</button>`;
  
  html += '</div>';
  
  // 使用事件委托
  container.innerHTML = html;
  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = parseInt(e.target.textContent);
      if (!isNaN(page)) {
        onPageChange(page);
      }
    });
  });
}

// ===== 打开详情弹窗 =====
function openModal(projectId) {
  const p = allProjects.find(x => x.id === projectId);
  if (!p) return;
  
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-header">
      <h2>${escapeHtml(p.title)}</h2>
      <div class="modal-stars">⭐ ${p.stars || 0} stars</div>
    </div>
    <div class="modal-date">📅 ${p.date} · ${p.is_top ? '🏆 今日精选' : ''}</div>
    <div class="modal-desc">
      <h4>项目描述</h4>
      <p>${escapeHtml(p.description)}</p>
    </div>
    <div class="modal-metaphor">
      <h4>💡 通俗理解</h4>
      <p>${escapeHtml(p.metaphor)}</p>
    </div>
    <div class="modal-scores">
      <h4>📊 评分详情</h4>
      <div class="score-grid">
        <div class="score-card">
          <span class="score-label">Vibecoding 难度</span>
          <span class="score-value">${p.scores.vibecoding_ease}/3</span>
          <p class="score-reason">${escapeHtml(p.score_reasons.vibecoding_ease)}</p>
        </div>
        <div class="score-card">
          <span class="score-label">逻辑护城河</span>
          <span class="score-value">${p.scores.logic_moat}/2</span>
          <p class="score-reason">${escapeHtml(p.score_reasons.logic_moat)}</p>
        </div>
        <div class="score-card">
          <span class="score-label">赛道匹配度</span>
          <span class="score-value">${p.scores.track_fit}/2</span>
          <p class="score-reason">${escapeHtml(p.score_reasons.track_fit)}</p>
        </div>
        <div class="score-card">
          <span class="score-label">增长潜力</span>
          <span class="score-value">${p.scores.growth_potential}/2</span>
          <p class="score-reason">${escapeHtml(p.score_reasons.growth_potential)}</p>
        </div>
      </div>
      <div class="score-total-box">
        <span>总分</span>
        <strong>${p.scores.total}/12</strong>
      </div>
    </div>
    <div class="modal-actions">
      <a href="${p.url}" target="_blank" class="btn-primary">🔗 访问 GitHub</a>
    </div>
  `;
  
  document.getElementById('modal-overlay').classList.add('open');
}

// ===== 关闭弹窗 =====
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ===== 绑定事件 =====
function bindEvents() {
  // 搜索
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    currentPageNum = 1;
    renderHistory();
  });
  
  // 排序
  document.getElementById('sort-select').addEventListener('change', e => {
    const [key, dir] = e.target.value.split('_');
    currentSort = { key, dir };
    renderHistory();
  });
  
  // 表头排序
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = { key, dir: 'desc' };
      }
      renderHistory();
    });
  });
  
  // 赛道筛选
  document.querySelectorAll('.track-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trackFilter = btn.dataset.track;
      currentPageNum = 1;
      renderHistory();
    });
  });
  
  // 日期选择
  document.getElementById('top3-date').addEventListener('change', e => {
    renderTop3(e.target.value);
  });
  
  // ESC 关闭弹窗
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// ===== 工具函数 =====
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== 启动 =====
init();
