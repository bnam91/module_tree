const path = require('path');
const { COLOR_PRESETS, COLOR_NAME_MAP } = require('./constants');
const notes = require('./notes');

function createHtml({ treeData, initialState, rootDir, folderIconDataUri }) {
  const title = `Directory Tree - ${path.basename(rootDir)}`;
  const dataAsString = JSON.stringify(treeData);
  const folderIcon = folderIconDataUri;
  const initialStateString = JSON.stringify(initialState || {});
  const colorPresetsString = JSON.stringify(COLOR_PRESETS);
  const colorNameMapString = JSON.stringify(COLOR_NAME_MAP);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p class="meta">${rootDir}</p>
    <div class="controls">
      ${require('./ui').renderControls({
        colorPresets: COLOR_PRESETS,
        defaultColor: '#329AF8',
      })}
      ${notes.renderNotesToggleButton()}
      <button id="refresh-tree">트리 새로고침</button>
      <button id="toggle-labels">라벨 숨기기</button>
      <button id="toggle-hidden">숨김 파일 보기</button>
    </div>
    <div class="hint">* 컨트롤 키를 누르면 숨김 체크박스가 모두 표시됩니다.</div>
    <div class="hint">⌘C: 이름 복사 · ⌥⌘C: 전체 경로 복사 (선택 후)</div>
    <div class="workspace">
      <div id="tree-root"></div>
      ${notes.renderNotesPanel()}
    </div>
    <div class="path-panel" id="path-panel">
      <span class="path-panel-label">선택 경로</span>
      <span class="path-panel-text" id="path-panel-text">선택된 항목 없음</span>
    </div>
  </div>

  <script>
    let treeData = ${dataAsString};
    const initialState = ${initialStateString};
    const COLOR_PRESETS = ${colorPresetsString};
    const COLOR_NAME_MAP = ${colorNameMapString};
    const hiddenPaths = new Set(initialState.hiddenPaths || []);
    let showHidden = initialState.showHidden || false;
    const LABELS_KEY = 'tree.labels';
    const LABEL_MAP_KEY = 'tree.labelMap';
    let labels = initialState.labels || [];
    let labelMap = new Map(Object.entries(initialState.labelMap || {}));
    let currentApplyLabel = '';
    let showLabels = initialState.showLabels !== false;
    let disabledLabels = new Set(initialState.disabledLabels || []);
    let expandedPaths = new Set(initialState.expandedPaths || []);
    let saveTimer = null;
    let refreshBadgeOn = false;
    let treeSnapshot = JSON.stringify(treeData);
    let noteContent = initialState.noteContent || '';
    let noteVisible = !!initialState.noteVisible;
    const rootDir = ${JSON.stringify(rootDir)};
    const normalizeRelPath = (relPath) => (relPath || '').replace(/^\\/+|\\/+$/g, '');
    let selectedRelPath = '';
    let selectedLabelEl = null;
    const pathPanelEl = document.getElementById('path-panel');
    const pathPanelTextEl = document.getElementById('path-panel-text');
    const filterTriggerEl = document.getElementById('filter-selected');
    const filterPanelEl = document.getElementById('filter-panel');
    const selectedFilterIds = new Set();
    let filterDropdownOpen = false;
    const notePanelEl = document.getElementById('note-panel');
    const noteTextEl = document.getElementById('note-text');

    function getFilterTargets() {
      return Array.from(selectedFilterIds);
    }

    function pruneSelectedFilters() {
      const validIds = new Set(labels.map((l) => l.id));
      Array.from(selectedFilterIds).forEach((id) => {
        if (!validIds.has(id)) selectedFilterIds.delete(id);
      });
    }

    function pruneDisabledLabels() {
      const validIds = new Set(labels.map((l) => l.id));
      Array.from(disabledLabels).forEach((id) => {
        if (!validIds.has(id)) disabledLabels.delete(id);
      });
    }

    function setExpandedState(relPath, expanded, li) {
      if (expanded) {
        expandedPaths.add(relPath);
      } else {
        expandedPaths.delete(relPath);
      }
      if (li) li.classList.toggle('expanded', expanded);
      scheduleSaveState();
    }

    function updatePathPanel() {
      if (!pathPanelEl || !pathPanelTextEl) return;
      const info = getSelectedInfo();
      if (!info) {
        pathPanelTextEl.textContent = '선택된 항목 없음';
        pathPanelEl.classList.add('empty');
        return;
      }
      const fullPath = buildFullPath(info.rel);
      pathPanelTextEl.textContent = fullPath;
      pathPanelTextEl.title = fullPath;
      pathPanelEl.classList.remove('empty');
    }

    function setFilterDropdown(open) {
      filterDropdownOpen = !!open;
      if (filterPanelEl) filterPanelEl.classList.toggle('open', filterDropdownOpen);
      if (filterTriggerEl) filterTriggerEl.classList.toggle('open', filterDropdownOpen);
    }

    function setRefreshBadge(on) {
      refreshBadgeOn = !!on;
      const btn = document.getElementById('refresh-tree');
      if (btn) {
        btn.textContent = refreshBadgeOn ? '트리 새로고침(!)' : '트리 새로고침';
      }
    }

    function renderFilterSelect() {
      if (!filterPanelEl) return;
      filterPanelEl.innerHTML = '';
      if (!labels.length) {
        const empty = document.createElement('div');
        empty.className = 'filter-placeholder';
        empty.textContent = '라벨 없음';
        filterPanelEl.appendChild(empty);
        return;
      }
      labels.forEach((lab) => {
        const row = document.createElement('label');
        row.className = 'filter-option';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selectedFilterIds.has(lab.id);
        cb.addEventListener('change', () => {
          if (cb.checked) selectedFilterIds.add(lab.id);
          else selectedFilterIds.delete(lab.id);
          updateFilterTriggerText();
          applyFilter();
        });
        const span = document.createElement('span');
        span.textContent = lab.name;
        row.appendChild(cb);
        row.appendChild(span);
        filterPanelEl.appendChild(row);
      });
      updateFilterTriggerText();
    }

    function updateApplySwatch() {
      const swatch = document.getElementById('apply-label-swatch');
      if (!swatch) return;
      if (!currentApplyLabel) {
        swatch.style.background = 'transparent';
        swatch.title = '라벨 색상';
        return;
      }
      const lab = labels.find((l) => l.id === currentApplyLabel);
      const color = (lab && lab.color) || '#22c55e';
      swatch.style.background = color;
      swatch.title = currentApplyLabel + ' (' + color + ')';
    }

    function loadNoteState() {
      if (noteTextEl) noteTextEl.value = noteContent || '';
      document.body.classList.toggle('show-notes', noteVisible);
      const btn = document.getElementById('toggle-notes');
      if (btn) btn.textContent = noteVisible ? '메모장 숨기기' : '메모장 보기';
    }

    function saveNoteContent() {
      if (!noteTextEl) return;
      noteContent = noteTextEl.value || '';
      scheduleSaveState();
    }

    function setNoteVisibility(on) {
      noteVisible = !!on;
      document.body.classList.toggle('show-notes', noteVisible);
      const btn = document.getElementById('toggle-notes');
      if (btn) btn.textContent = noteVisible ? '메모장 숨기기' : '메모장 보기';
      scheduleSaveState();
    }

    function updateFilterTriggerText() {
      if (!filterTriggerEl) return;
      let placeholder = filterTriggerEl.querySelector('.filter-placeholder');
      if (!placeholder) {
        placeholder = document.createElement('span');
        placeholder.className = 'filter-placeholder';
        filterTriggerEl.appendChild(placeholder);
      }
      if (!selectedFilterIds.size) {
        placeholder.textContent = '전체';
        filterTriggerEl.classList.remove('active');
      } else {
        placeholder.textContent = Array.from(selectedFilterIds).join(', ');
        filterTriggerEl.classList.add('active');
      }
    }

    function setSelectedLabel(labelEl) {
      if (selectedLabelEl === labelEl) return;
      if (selectedLabelEl) selectedLabelEl.classList.remove('selected');
      selectedLabelEl = labelEl || null;
      if (selectedLabelEl) {
        selectedLabelEl.classList.add('selected');
        const li = selectedLabelEl.closest('li.node');
        selectedRelPath = li ? normalizeRelPath(li.dataset.relPath) : '';
      } else {
        selectedRelPath = '';
      }
      updatePathPanel();
    }

    function restoreSelection() {
      if (!selectedRelPath) return;
      const target = Array.from(document.querySelectorAll('li.node')).find(
        (li) => normalizeRelPath(li.dataset.relPath) === selectedRelPath
      );
      if (target) {
        const label = target.querySelector('.label');
        if (label) setSelectedLabel(label);
      }
      updatePathPanel();
    }

    function buildFullPath(relPath) {
      if (!relPath) return rootDir;
      const sep = rootDir.endsWith('/') || rootDir.endsWith('\\\\') ? '' : '/';
      return rootDir + sep + relPath;
    }

    function getSelectedInfo() {
      if (!selectedLabelEl) return null;
      const li = selectedLabelEl.closest('li.node');
      if (!li) return null;
      const rel = normalizeRelPath(li.dataset.relPath);
      const nameEl = selectedLabelEl.querySelector('.name');
      const name = nameEl ? nameEl.textContent : '';
      return { rel, name };
    }

    async function writeToClipboard(text) {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (!ok) throw err;
        } catch (err2) {
          console.warn('클립보드 복사 실패', err2);
          alert('클립보드 복사에 실패했습니다.');
        }
      }
    }

    function isFormElement(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function initCopyHotkeys() {
      window.addEventListener('keydown', (e) => {
        if (!e.metaKey) return;
        const key = (e.key || '').toLowerCase();
        if (key !== 'c') return;
        if (isFormElement(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const info = getSelectedInfo();
        if (!info) {
          alert('먼저 파일이나 폴더를 선택하세요.');
          return;
        }
        const text = e.altKey ? buildFullPath(info.rel) : info.name;
        writeToClipboard(text);
      });
    }

    async function loadStateFromServer() {
      try {
        const res = await fetch('/state');
        const json = await res.json();
        labels = json.labels || [];
        labelMap = new Map(Object.entries(json.labelMap || {}));
        hiddenPaths.clear();
        (json.hiddenPaths || []).forEach((p) => hiddenPaths.add(p));
        showLabels = json.showLabels !== false;
        showHidden = !!json.showHidden;
        disabledLabels = new Set(json.disabledLabels || []);
        expandedPaths = new Set(json.expandedPaths || []);
        noteContent = json.noteContent || '';
        noteVisible = !!json.noteVisible;
      } catch (e) {
        console.warn('상태 로드 실패, 초기 상태를 사용합니다.', e);
      }
    }

    function scheduleSaveState() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const payload = {
          labels,
          labelMap: Object.fromEntries(labelMap),
          hiddenPaths: Array.from(hiddenPaths),
          showLabels,
          showHidden,
          disabledLabels: Array.from(disabledLabels),
          expandedPaths: Array.from(expandedPaths),
          noteContent,
          noteVisible,
        };
        fetch('/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch((e) => console.warn('상태 저장 실패', e));
      }, 300);
    }

    function getLabelById(id) {
      return labels.find((l) => l.id === id);
    }

    function getLabelsForPath(relPath) {
      const ids = labelMap.get(relPath) || [];
      return ids.map((id) => getLabelById(id)).filter((lab) => lab && !disabledLabels.has(lab.id));
    }

    function toggleLabelForPath(relPath, labelId) {
      if (!relPath || !labelId) return;
      const arr = labelMap.get(relPath) || [];
      const idx = arr.indexOf(labelId);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        arr.push(labelId);
      }
      labelMap.set(relPath, arr);
      scheduleSaveState();
    }

    function renderLabelDots(labelEl, relPath) {
      let dots = labelEl.querySelector('.label-dots');
      if (!dots) {
        dots = document.createElement('span');
        dots.className = 'label-dots';
        labelEl.appendChild(dots);
      }
      dots.innerHTML = '';
      const list = getLabelsForPath(relPath);
      list.forEach((lab) => {
        const dot = document.createElement('span');
        dot.className = 'label-dot';
        dot.style.backgroundColor = lab.color || '#22c55e';
        dot.title = lab.name;
        dots.appendChild(dot);
      });
    }

    function applyExpandedState() {
      document.querySelectorAll('li.node').forEach((li) => {
        const rel = (li.dataset.relPath || '').replace(/^\\/+|\\/+$/g, '');
        const shouldExpand = expandedPaths.has(rel) || rel === '';
        li.classList.toggle('expanded', shouldExpand);
      });
    }

    function createNode(node) {
      const li = document.createElement('li');
      li.className = 'node';
      const normalizedRel = normalizeRelPath(node.relPath);
      li.dataset.relPath = normalizedRel;

      const label = document.createElement('div');
      label.className = 'label ' + node.type;

      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.textContent = node.type === 'dir' ? '▸' : '·';

      const icon = document.createElement('span');
      icon.className = 'icon';
      if (node.type === 'dir' && ${folderIcon ? 'true' : 'false'}) {
        const img = document.createElement('img');
        img.src = '${folderIcon || ''}';
        img.alt = 'folder';
        icon.appendChild(img);
      } else {
        icon.textContent = node.type === 'dir' ? '📁' : node.type === 'symlink' ? '🔗' : '📄';
      }

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = node.name;

      const hideBox = document.createElement('input');
      hideBox.type = 'checkbox';
      hideBox.className = 'hide-checkbox';
      hideBox.title = '숨기기';

      label.appendChild(caret);
      label.appendChild(icon);
      label.appendChild(name);
      label.appendChild(hideBox);
      li.appendChild(label);

      const handleToggleLabel = (e) => {
        if (!e.altKey) return false;
        if (!currentApplyLabel) {
          alert('먼저 적용할 라벨을 선택하세요.');
          return true;
        }
        toggleLabelForPath(normalizedRel, currentApplyLabel);
        renderLabelDots(label, normalizedRel);
        applyFilter();
        e.stopPropagation();
        e.preventDefault();
        return true;
      };

      if (node.type === 'dir' && Array.isArray(node.children)) {
        const ul = document.createElement('ul');
        node.children.forEach((child) => {
          ul.appendChild(createNode(child));
        });
        li.appendChild(ul);

        label.addEventListener('click', (e) => {
          setSelectedLabel(label);
          if (handleToggleLabel(e)) return;
          const next = !li.classList.contains('expanded');
          setExpandedState(normalizedRel, next, li);
        });
      } else if (node.type === 'symlink') {
        label.title = '→ ' + node.target;
        label.classList.add('symlink');
        label.addEventListener('click', (e) => {
          setSelectedLabel(label);
          if (handleToggleLabel(e)) return;
          const next = !li.classList.contains('expanded');
          setExpandedState(normalizedRel, next, li);
        });
      } else {
        label.addEventListener('click', (e) => {
          setSelectedLabel(label);
          if (handleToggleLabel(e)) return;
          const next = !li.classList.contains('expanded');
          setExpandedState(normalizedRel, next, li);
        });
      }

      renderLabelDots(label, normalizedRel);

      hideBox.addEventListener('click', (e) => e.stopPropagation());
      hideBox.addEventListener('change', () => {
        if (!normalizedRel) return;
        if (hideBox.checked) {
          hiddenPaths.add(normalizedRel);
          li.classList.add('hidden-node');
        } else {
          hiddenPaths.delete(normalizedRel);
          li.classList.remove('hidden-node');
        }
        scheduleSaveState();
      });

      return li;
    }

    function renderTree(data) {
      const container = document.getElementById('tree-root');
      const rootList = document.createElement('ul');
      rootList.className = 'tree';

      const rootNode = createNode(data);
      rootNode.classList.add('expanded');
      rootList.appendChild(rootNode);

      container.appendChild(rootList);
      applyExpandedState();
    }

    function rerenderTree() {
      const container = document.getElementById('tree-root');
      if (container) container.innerHTML = '';
      if (treeData) {
        renderTree(treeData);
        refreshAllLabelDots();
        applyExpandedState();
        applyHiddenState();
        applyFilter();
        restoreSelection();
      }
    }

    function applyHiddenState() {
      document.querySelectorAll('li.node').forEach((li) => {
        const rel = (li.dataset.relPath || '').replace(/^\\/+|\\/+$/g, '');
        if (hiddenPaths.has(rel)) {
          li.classList.add('hidden-node');
          const checkbox = li.querySelector('.hide-checkbox');
          if (checkbox) checkbox.checked = true;
        } else {
          li.classList.remove('hidden-node');
          const checkbox = li.querySelector('.hide-checkbox');
          if (checkbox) checkbox.checked = false;
        }
      });
    }

    function applyFilter() {
      const targets = getFilterTargets();
      if (!targets.length) {
        document.querySelectorAll('li.node').forEach((li) => li.classList.remove('filter-hidden'));
        return;
      }

      const matches = (li) => {
        const rel = (li.dataset.relPath || '').replace(/^\\/+|\\/+$/g, '');
        const hasSelf = (labelMap.get(rel) || []).some((id) => targets.includes(id));
        const children = Array.from(li.querySelectorAll(':scope > ul > li'));
        let childHit = false;
        children.forEach((c) => {
          if (matches(c)) childHit = true;
        });
        const hit = hasSelf || childHit;
        li.classList.toggle('filter-hidden', !hit);
        return hit;
      };

      document.querySelectorAll('ul.tree > li').forEach((root) => matches(root));
    }

    function refreshAllLabelDots() {
      document.querySelectorAll('li.node').forEach((li) => {
        const rel = (li.dataset.relPath || '').replace(/^\\/+|\\/+$/g, '');
        const labelEl = li.querySelector('.label');
        if (labelEl) renderLabelDots(labelEl, rel);
      });
    }

    function populateLabelSelects() {
      const applySelect = document.getElementById('apply-label');
      const colorPresetSelect = document.getElementById('label-color-preset');
      const colorInput = document.getElementById('label-color');
      if (!applySelect) return;

      applySelect.innerHTML = '<option value="">선택</option>';

      labels.forEach((lab) => {
        const opt = document.createElement('option');
        opt.value = lab.id;
        opt.textContent = lab.name;
        applySelect.appendChild(opt);
      });

      pruneSelectedFilters();
      pruneDisabledLabels();
      renderFilterSelect();
      updateApplySwatch();

      // 컬러 프리셋 초기화
      if (colorPresetSelect) {
        colorPresetSelect.innerHTML = '';
        COLOR_PRESETS.forEach((c, idx) => {
          const opt = document.createElement('option');
          opt.value = c;
          const name = COLOR_NAME_MAP[c] || c;
          opt.textContent = name + ' (' + c + ')';
          opt.style.color = c;
          opt.style.fontWeight = '600';
          opt.style.backgroundColor = 'transparent';
          opt.dataset.color = c;
          if (idx === 4) opt.selected = true; // #329AF8 기본
          colorPresetSelect.appendChild(opt);
        });
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = '직접 선택';
        colorPresetSelect.appendChild(customOpt);
      }
      if (colorInput && colorPresetSelect && colorPresetSelect.value !== 'custom') {
        colorInput.value = colorPresetSelect.value;
        colorInput.disabled = true;
      }
    }

    function initLabelControls() {
      const nameInput = document.getElementById('label-name');
      const colorInput = document.getElementById('label-color');
      const colorPresetSelect = document.getElementById('label-color-preset');
      const addBtn = document.getElementById('add-label');
      const applySelect = document.getElementById('apply-label');
      const toggleLabelsBtn = document.getElementById('toggle-labels');
      const refreshBtn = document.getElementById('refresh-tree');

      const addLabel = () => {
        const name = (nameInput.value || '').trim();
        let color = colorInput.value || '#329AF8';
        if (colorPresetSelect) {
          if (colorPresetSelect.value && colorPresetSelect.value !== 'custom') {
            color = colorPresetSelect.value;
          }
        }
        if (!name) {
          alert('그룹 이름을 입력하세요.');
          return;
        }
        const id = name;
        const existing = labels.find((l) => l.id === id);
        if (existing) {
          existing.color = color;
        } else {
          labels.push({ id, name, color });
        }
        populateLabelSelects();
        applySelect.value = id;
        currentApplyLabel = id;
        refreshAllLabelDots();
        applyFilter();
        scheduleSaveState();
      };

      const deleteLabel = () => {
        if (!applySelect) return;
        const target = applySelect.value || '';
        if (!target) {
          alert('삭제할 라벨을 선택하세요.');
          return;
        }
        const ok = confirm('라벨 "' + target + '"을 삭제할까요? 해당 라벨이 적용된 모든 경로에서 제거됩니다.');
        if (!ok) return;

        // 라벨 목록에서 제거
        labels = labels.filter((l) => l.id !== target);

        // labelMap에서 해당 라벨 제거
        labelMap = new Map(
          Array.from(labelMap.entries()).map(([k, v]) => {
            const arr = (v || []).filter((id) => id !== target);
            return [k, arr];
          })
        );

        // 선택 상태 정리
        if (currentApplyLabel === target) currentApplyLabel = '';
        selectedFilterIds.delete(target);

        populateLabelSelects();
        refreshAllLabelDots();
        applyFilter();
        scheduleSaveState();
      };

      addBtn.addEventListener('click', addLabel);
      const deleteBtn = document.getElementById('delete-label');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteLabel);
      }
      applySelect.addEventListener('change', () => {
        currentApplyLabel = applySelect.value;
        updateApplySwatch();
      });
      if (colorPresetSelect && colorInput) {
        const syncCustom = () => {
          if (colorPresetSelect.value === 'custom') {
            colorInput.disabled = false;
          } else {
            colorInput.disabled = true;
            colorInput.value = colorPresetSelect.value || '#329AF8';
          }
        };
        colorPresetSelect.addEventListener('change', syncCustom);
        syncCustom();
      }
      const updateToggleLabelBtn = () => {
        toggleLabelsBtn.textContent = showLabels ? '라벨 숨기기' : '라벨 보이기';
        document.body.classList.toggle('hide-label-dots', !showLabels);
        toggleLabelsBtn.classList.toggle('active-labels', !showLabels);
        scheduleSaveState();
      };
      toggleLabelsBtn.addEventListener('click', () => {
        showLabels = !showLabels;
        updateToggleLabelBtn();
      });
      updateToggleLabelBtn();
      if (noteTextEl) {
        const saveHandler = () => saveNoteContent();
        noteTextEl.addEventListener('input', saveHandler);
        noteTextEl.addEventListener('blur', saveHandler);
      }
      const noteBtn = document.getElementById('toggle-notes');
      if (noteBtn) {
        noteBtn.addEventListener('click', () => {
          const next = !document.body.classList.contains('show-notes');
          setNoteVisibility(next);
          if (!next) saveNoteContent();
        });
      }
      updateApplySwatch();

      if (refreshBtn) {
        let refreshing = false;
        const setRefreshing = (on) => {
          refreshing = on;
          refreshBtn.textContent = on ? '새로고침 중...' : refreshBadgeOn ? '트리 새로고침(!)' : '트리 새로고침';
          refreshBtn.disabled = on;
        };
        refreshBtn.addEventListener('click', async () => {
          if (refreshing) return;
          setRefreshing(true);
          try {
            const res = await fetch('/tree');
            const json = await res.json();
            treeData = json;
            treeSnapshot = JSON.stringify(treeData);
            setRefreshBadge(false);
            rerenderTree();
          } catch (e) {
            console.warn('트리 새로고침 실패', e);
            alert('트리 새로고침에 실패했습니다.');
          } finally {
            setRefreshing(false);
          }
        });
      }
    }

    function initCheckboxHotkey() {
      let metaDown = false;
      const setState = (on) => {
        document.body.classList.toggle('show-checkboxes', on);
      };
      window.addEventListener('keydown', (e) => {
        if (e.metaKey && !metaDown) {
          metaDown = true;
          setState(true);
        }
      });
      window.addEventListener('keyup', (e) => {
        if (!e.metaKey && metaDown) {
          metaDown = false;
          setState(false);
        }
      });
      window.addEventListener('blur', () => {
        metaDown = false;
        setState(false);
      });
      // macOS에서 ctrl+클릭은 우클릭으로 취급되므로 체크박스 클릭 시 컨텍스트 메뉴를 막는다.
      document.addEventListener(
        'contextmenu',
        (e) => {
          const isCtrl = e.ctrlKey;
          const isCheckbox = !!e.target.closest('.hide-checkbox');
          if (isCtrl && isCheckbox) {
            e.preventDefault();
          }
        },
        { capture: true }
      );
    }

    function initHiddenToggle() {
      const btn = document.getElementById('toggle-hidden');
      const updateLabel = () => {
        btn.textContent = showHidden ? '숨김 파일 숨기기' : '숨김 파일 보기';
        btn.classList.toggle('active-hidden', showHidden);
        document.body.classList.toggle('show-hidden', showHidden);
        scheduleSaveState();
      };
      btn.addEventListener('click', () => {
        showHidden = !showHidden;
        updateLabel();
      });
      updateLabel();
    }

    renderTree(treeData);
    populateLabelSelects();
    refreshAllLabelDots();
    applyHiddenState();
    initCheckboxHotkey();
    initLabelControls();
    initHiddenToggle();
    initCopyHotkeys();
    updatePathPanel();
    updateApplySwatch();
    loadNoteState();
    if (filterTriggerEl) {
      filterTriggerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setFilterDropdown(!filterDropdownOpen);
      });
    }
    document.addEventListener('click', (e) => {
      if (!filterPanelEl || !filterTriggerEl) return;
      if (
        !filterPanelEl.contains(e.target) &&
        !filterTriggerEl.contains(e.target)
      ) {
        setFilterDropdown(false);
      }
    });

    // 주기적으로 트리 변경 감지 후 배지 표시 (과도한 리프레시 방지용)
    setInterval(async () => {
      try {
        const res = await fetch('/tree');
        const json = await res.json();
        const snap = JSON.stringify(json);
        if (snap !== treeSnapshot) {
          setRefreshBadge(true);
        }
      } catch (e) {
        // 무시 (네트워크/서버 불가)
      }
    }, 30000);
    if (pathPanelEl) {
      pathPanelEl.addEventListener('click', () => {
        const info = getSelectedInfo();
        if (!info) {
          alert('먼저 파일이나 폴더를 선택하세요.');
          return;
        }
        const fullPath = buildFullPath(info.rel);
        writeToClipboard(fullPath);
      });
    }
    applyFilter();

    // 상태를 서버에서 최신으로 불러와 동기화
    loadStateFromServer().then(() => {
      populateLabelSelects();
      refreshAllLabelDots();
      applyHiddenState();
      applyFilter();
      updateApplySwatch();
      loadNoteState();
      selectedFilterIds.clear();
      updateFilterTriggerText();
      renderFilterSelect();
      const applySelect = document.getElementById('apply-label');
      if (applySelect) applySelect.value = currentApplyLabel || '';
      document.body.classList.toggle('hide-label-dots', !showLabels);
      document.body.classList.toggle('show-hidden', showHidden);
      const toggleLabelsBtn = document.getElementById('toggle-labels');
      if (toggleLabelsBtn) {
        toggleLabelsBtn.textContent = showLabels ? '라벨 숨기기' : '라벨 보이기';
        toggleLabelsBtn.classList.toggle('active-labels', !showLabels);
      }
      const toggleHiddenBtn = document.getElementById('toggle-hidden');
      if (toggleHiddenBtn) {
        toggleHiddenBtn.textContent = showHidden ? '숨김 파일 숨기기' : '숨김 파일 보기';
      }
      rerenderTree();
    });
  </script>
</body>
</html>`;
}

module.exports = { createHtml };

