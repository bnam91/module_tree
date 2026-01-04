function renderLabelCreateControls({ colorPresets, defaultColor }) {
  const options = colorPresets
    .map(
      (c, idx) =>
        `<option value="${c}" ${idx === 4 ? 'selected' : ''}>${c}</option>`
    )
    .join('');
  return `
      <div class="control-box">
        <label for="label-name">라벨 생성</label>
        <input id="label-name" type="text" placeholder="이름" />
        <select id="label-color-preset">
          ${options}
          <option value="custom">직접 선택</option>
        </select>
        <input id="label-color" type="color" value="${defaultColor}" title="색상" />
        <button id="add-label">추가</button>
        <button id="delete-label">삭제</button>
      </div>
  `;
}

function renderLabelFilter() {
  return `
      <div class="control-box">
        <label for="filter-label">특정 라벨만 보기</label>
        <div class="filter-container">
          <button type="button" class="filter-selected" id="filter-selected">
            <span class="filter-placeholder">전체</span>
          </button>
          <div class="filter-panel" id="filter-panel"></div>
        </div>
      </div>
  `;
}

function renderLabelApply() {
  return `
      <div class="control-box">
        <label for="apply-label">라벨 적용</label>
        <select id="apply-label">
          <option value="">선택</option>
        </select>
        <span class="apply-swatch" id="apply-label-swatch" title="라벨 색상"></span>
        <button id="label-note-btn" class="label-note-btn" title="라벨 메모">💬</button>
        <span class="hint">⌥+클릭으로 토글 적용</span>
      </div>
  `;
}

function renderControls({ colorPresets, defaultColor }) {
  return `
    ${renderLabelApply()}
    ${renderLabelCreateControls({ colorPresets, defaultColor })}
    ${renderLabelFilter()}
  `;
}

module.exports = {
  renderLabelCreateControls,
  renderLabelFilter,
  renderLabelApply,
  renderControls,
};

