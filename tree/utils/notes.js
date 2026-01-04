function renderNotesPanel() {
  return `
    <div class="note-panel" id="note-panel">
      <div class="note-header">
        <span id="note-header-text">메모</span>
        <button id="note-close" class="note-close" title="닫기">×</button>
      </div>
      <div id="note-path" class="note-path"></div>
      <textarea id="note-text" placeholder="메모를 입력하세요"></textarea>
    </div>
  `;
}

function renderNotesToggleButton() {
  return `<button id="toggle-notes">메모장 보기</button>`;
}

module.exports = { renderNotesPanel, renderNotesToggleButton };


