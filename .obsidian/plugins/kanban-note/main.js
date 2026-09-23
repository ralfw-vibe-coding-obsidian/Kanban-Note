'use strict';

const {
  MarkdownView,
  Modal,
  Notice,
  parseYaml,
  Platform,
  Plugin,
  setIcon,
  TextFileView
} = require('obsidian');

const VIEW_TYPE = 'kanban-note-view';
const VIEW_PROPERTY = 'kanban_note_view';
const VIEW_PROPERTY_VALUE = 'kanban';
const BOARD_HEADING = '# Kanban Note';

const COLUMNS = [
  { status: 'Backlog', group: '' },
  { status: 'Committed', group: '' },
  { status: 'Started', group: 'In Process' },
  { status: 'Blocked', group: 'In Process' },
  { status: 'Done', group: 'Finished' },
  { status: 'Aborted', group: 'Finished' }
];

const VALID_STATUSES = new Set(COLUMNS.map((column) => column.status));

function isKanbanNote(app, file) {
  if (!file) return false;
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  return frontmatter?.[VIEW_PROPERTY] === VIEW_PROPERTY_VALUE;
}

function cleanOneLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function yamlString(value) {
  const text = cleanOneLine(value);
  return text ? JSON.stringify(text) : '';
}

function isDateReached(value) {
  const date = cleanOneLine(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const now = new Date();
  const pad = (number) => String(number).padStart(2, '0');
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  return date <= today;
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(cleanOneLine).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((tag) => cleanOneLine(tag).replace(/^#/, '')).filter(Boolean);
  }
  return [];
}

function serializeCard(card) {
  const tags = normalizeTags(card.tags);
  const lines = [
    '## ' + (cleanOneLine(card.title) || 'Neue Karte'),
    '',
    '```kanban-card',
    'status: ' + (VALID_STATUSES.has(card.status) ? card.status : 'Backlog'),
    'deadline: ' + yamlString(card.deadline),
    'reminder: ' + yamlString(card.reminder),
    'owner: ' + yamlString(card.owner),
    'tags:'
  ];

  tags.forEach((tag) => lines.push('  - ' + yamlString(tag)));
  if (tags.length === 0) lines[lines.length - 1] = 'tags: []';
  lines.push('```');

  const note = String(card.note || '').trim();
  if (note) lines.push('', note);
  return lines.join('\n');
}

/* Findet Überschriften nur außerhalb von Codeblöcken. */
function markdownHeadings(text) {
  const headings = [];
  const lines = text.split('\n');
  let offset = 0;
  let fence = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
    } else if (!fence) {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (match) {
        headings.push({
          level: match[1].length,
          title: match[2].trim(),
          line: index,
          start: offset,
          end: offset + line.length
        });
      }
    }
    offset += line.length + 1;
  });

  return headings;
}

function parseCardBlock(body) {
  const match = body.match(/(?:^|\n)\s*```kanban-card\s*\n([\s\S]*?)\n\s*```\s*(?:\n|$)/i);
  if (!match) return { data: {}, note: body.trim() };

  let data = {};
  try {
    data = parseYaml(match[1]) || {};
  } catch (error) {
    data = {};
  }

  const note = (body.slice(0, match.index) + body.slice(match.index + match[0].length)).trim();
  return { data, note };
}

function parseBoard(text) {
  const headings = markdownHeadings(text);
  const boardHeadingIndex = headings.findIndex(
    (heading) => heading.level === 1 && heading.title === 'Kanban Note'
  );

  if (boardHeadingIndex === -1) return null;

  const boardHeading = headings[boardHeadingIndex];
  const nextTopHeading = headings
    .slice(boardHeadingIndex + 1)
    .find((heading) => heading.level === 1);
  const sectionEnd = nextTopHeading ? nextTopHeading.start : text.length;
  const cardHeadings = headings.filter(
    (heading) => heading.level === 2 && heading.start > boardHeading.start && heading.start < sectionEnd
  );

  const cards = cardHeadings.map((heading, index) => {
    const end = cardHeadings[index + 1]?.start || sectionEnd;
    const parsed = parseCardBlock(text.slice(heading.end, end));
    const status = VALID_STATUSES.has(parsed.data.status) ? parsed.data.status : 'Backlog';
    return {
      title: heading.title,
      status,
      deadline: cleanOneLine(parsed.data.deadline),
      reminder: cleanOneLine(parsed.data.reminder),
      owner: cleanOneLine(parsed.data.owner),
      tags: normalizeTags(parsed.data.tags),
      note: parsed.note,
      start: heading.start,
      end
    };
  });

  return { headingEnd: boardHeading.end, sectionEnd, cards };
}

class CardModal extends Modal {
  constructor(app, card, availableTags, onSave) {
    super(app);
    this.card = { ...card, tags: normalizeTags(card.tags) };
    this.availableTags = normalizeTags(availableTags);
    this.onSaveCard = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('knv-card-modal');
    this.modalEl.addClass('knv-card-modal-shell');
    contentEl.createEl('h2', { text: this.card.title ? 'Karte bearbeiten' : 'Neue Karte' });

    this.modalWindow = contentEl.ownerDocument.defaultView || window;
    this.visualViewport = this.modalWindow.visualViewport;
    this.activeField = null;
    this.handleFieldFocus = (event) => {
      if (!(event.target instanceof this.modalWindow.HTMLElement)) return;
      if (!event.target.matches('input, textarea, select')) return;
      this.activeField = event.target;
      this.keepActiveFieldVisible();
    };
    this.handleViewportChange = () => {
      this.updateMobileModalHeight();
      this.keepActiveFieldVisible();
    };
    contentEl.addEventListener('focusin', this.handleFieldFocus);
    this.modalWindow.addEventListener('resize', this.handleViewportChange);
    this.visualViewport?.addEventListener('resize', this.handleViewportChange);
    this.visualViewport?.addEventListener('scroll', this.handleViewportChange);
    this.updateMobileModalHeight();

    const fields = contentEl.createDiv({ cls: 'knv-modal-fields' });
    const title = fields.createEl('input', {
      cls: 'knv-modal-input',
      attr: { type: 'text', placeholder: 'Titel', 'aria-label': 'Titel' }
    });
    title.value = this.card.title || '';
    title.addEventListener('input', () => { this.card.title = title.value; });
    window.setTimeout(() => title.focus(), 0);

    const dates = fields.createDiv({ cls: 'knv-modal-dates' });
    this.addDateField(dates, 'Deadline', 'deadline');
    this.addDateField(dates, 'Reminder', 'reminder');

    const ownerAndTags = fields.createDiv({ cls: 'knv-owner-tags-fields' });
    const owner = ownerAndTags.createEl('input', {
      cls: 'knv-modal-input knv-owner-input',
      attr: { type: 'text', placeholder: 'Owner', 'aria-label': 'Owner' }
    });
    owner.value = this.card.owner || '';
    owner.addEventListener('input', () => { this.card.owner = owner.value; });

    const tagsControl = ownerAndTags.createDiv({ cls: 'knv-tags-control' });
    const tagsField = tagsControl.createDiv({ cls: 'knv-tags-field' });
    this.tagsChipsEl = tagsField.createDiv({ cls: 'knv-tags-edit-chips' });
    this.tagInput = tagsField.createEl('input', {
      cls: 'knv-tags-input',
      attr: { type: 'text', placeholder: 'Tag eingeben und Enter drücken', 'aria-label': 'Tags' }
    });
    this.tagSuggestionsEl = tagsControl.createDiv({ cls: 'knv-tag-suggestions' });
    this.tagInput.addEventListener('input', () => this.renderTagSuggestions());
    this.tagInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.addTag(this.tagInput.value);
    });
    this.renderTagChips();

    const note = fields.createEl('textarea', {
      cls: 'knv-modal-input knv-modal-note',
      attr: { rows: '8', placeholder: 'Notiz', 'aria-label': 'Notiz' }
    });
    note.value = this.card.note || '';
    note.addEventListener('input', () => {
      this.card.note = note.value;
      this.activeField = note;
      this.keepActiveFieldVisible();
    });

    const buttons = contentEl.createDiv({ cls: 'knv-modal-buttons' });
    const cancel = buttons.createEl('button', { text: 'Abbrechen' });
    cancel.addEventListener('click', () => this.close());
    const save = buttons.createEl('button', { cls: 'mod-cta', text: 'Speichern' });
    save.addEventListener('click', () => {
      this.addTag(this.tagInput.value);
      if (!cleanOneLine(this.card.title)) {
        new Notice('Bitte gib der Karte einen Titel.');
        return;
      }
      this.onSaveCard(this.card);
      this.close();
    });
  }

  addDateField(container, labelText, key) {
    const field = container.createDiv({ cls: 'knv-date-field' });
    const id = 'knv-' + key + '-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    field.createEl('label', { text: labelText, attr: { for: id } });
    const input = field.createEl('input', {
      cls: 'knv-modal-input',
      attr: { id, type: 'date', 'aria-label': labelText }
    });
    input.value = this.card[key] || '';
    input.addEventListener('input', () => { this.card[key] = input.value; });
  }

  addTag(value) {
    const additions = normalizeTags(value);
    if (additions.length === 0) return;
    const existing = new Set(this.card.tags.map((tag) => tag.toLocaleLowerCase()));
    additions.forEach((tag) => {
      if (!existing.has(tag.toLocaleLowerCase())) {
        this.card.tags.push(tag);
        existing.add(tag.toLocaleLowerCase());
      }
    });
    this.tagInput.value = '';
    this.renderTagChips();
    this.renderTagSuggestions();
  }

  removeTag(tagToRemove) {
    this.card.tags = this.card.tags.filter((tag) => tag !== tagToRemove);
    this.renderTagChips();
    this.tagInput.focus();
  }

  renderTagChips() {
    this.tagsChipsEl.empty();
    this.card.tags.forEach((tag) => {
      const chip = this.tagsChipsEl.createSpan({ cls: 'knv-edit-tag' });
      chip.createSpan({ text: tag });
      const remove = chip.createEl('button', {
        cls: 'clickable-icon',
        attr: { type: 'button', 'aria-label': 'Tag ' + tag + ' löschen' }
      });
      setIcon(remove, 'x');
      remove.addEventListener('click', () => this.removeTag(tag));
    });
  }

  renderTagSuggestions() {
    this.tagSuggestionsEl.empty();
    const query = cleanOneLine(this.tagInput.value).replace(/^#/, '').toLocaleLowerCase();
    if (!query) return;
    const selected = new Set(this.card.tags.map((tag) => tag.toLocaleLowerCase()));
    this.availableTags
      .filter((tag) => !selected.has(tag.toLocaleLowerCase()))
      .filter((tag) => tag.toLocaleLowerCase().includes(query))
      .slice(0, 8)
      .forEach((tag) => {
        const suggestion = this.tagSuggestionsEl.createEl('button', {
          cls: 'knv-tag-suggestion',
          attr: { type: 'button' },
          text: tag
        });
        suggestion.addEventListener('mousedown', (event) => event.preventDefault());
        suggestion.addEventListener('click', () => this.addTag(tag));
      });
  }

  updateMobileModalHeight() {
    if (!Platform.isMobile) return;
    const viewport = this.visualViewport;
    const viewportHeight = viewport?.height || this.modalWindow.innerHeight;
    const viewportTop = viewport?.offsetTop || 0;
    const availableHeight = Math.max(260, viewportHeight - 16);

    /* Mobile WebViews lassen modale Fenster teilweise hinter der Tastatur.
       Deshalb wird nicht nur der Inhalt, sondern der ganze Dialog explizit
       in die tatsächlich sichtbare Visual-Viewport-Fläche gesetzt. */
    this.modalEl.style.position = 'fixed';
    this.modalEl.style.display = 'flex';
    this.modalEl.style.flexDirection = 'column';
    this.modalEl.style.overflow = 'hidden';
    this.modalEl.style.top = viewportTop + 8 + 'px';
    this.modalEl.style.bottom = 'auto';
    this.modalEl.style.left = '8px';
    this.modalEl.style.right = '8px';
    this.modalEl.style.width = 'auto';
    this.modalEl.style.height = availableHeight + 'px';
    this.modalEl.style.maxHeight = availableHeight + 'px';
    this.modalEl.style.transform = 'none';
    this.contentEl.style.maxHeight = 'none';
    this.contentEl.style.height = '100%';
  }

  keepActiveFieldVisible() {
    const field = this.activeField;
    if (!field?.isConnected) return;
    const reveal = () => {
      const viewport = this.visualViewport;
      const bounds = field.getBoundingClientRect();
      const visibleTop = viewport ? viewport.offsetTop + 12 : 12;
      const visibleBottom = viewport
        ? viewport.offsetTop + viewport.height - 24
        : this.modalWindow.innerHeight - 24;
      const contentBounds = this.contentEl.getBoundingClientRect();
      const usableBottom = Math.min(visibleBottom, contentBounds.bottom - 12);

      if (bounds.bottom > usableBottom) {
        this.contentEl.scrollTop += bounds.bottom - usableBottom + 20;
      } else if (bounds.top < Math.max(visibleTop, contentBounds.top + 12)) {
        this.contentEl.scrollTop -= Math.max(visibleTop, contentBounds.top + 12) - bounds.top + 12;
      }
    };
    this.modalWindow.setTimeout(reveal, 80);
    this.modalWindow.setTimeout(reveal, 280);
  }

  onClose() {
    this.contentEl.removeEventListener('focusin', this.handleFieldFocus);
    this.modalWindow.removeEventListener('resize', this.handleViewportChange);
    this.visualViewport?.removeEventListener('resize', this.handleViewportChange);
    this.visualViewport?.removeEventListener('scroll', this.handleViewportChange);
    this.modalEl.removeClass('knv-card-modal-shell');
    this.modalEl.removeAttribute('style');
    this.contentEl.empty();
  }
}

class KanbanNoteView extends TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.file?.basename || 'Kanban Note'; }
  getIcon() { return 'columns-3'; }

  async setState(state, result) {
    await super.setState(state, result);
    /* Der Wechsel von Markdown zum Board ist nur eine andere Darstellung
       derselben Notiz und darf keinen zweiten Zurück-Schritt erzeugen. */
    result.history = false;
  }

  async onOpen() {
    this.addAction('file-text', 'Als Markdown anzeigen', () => this.plugin.showMarkdown(this));
    this.render();
  }

  getViewData() { return this.data || ''; }

  setViewData(data) {
    this.data = data;
    this.render();
  }

  clear() {
    this.data = '';
    this.contentEl.empty();
  }

  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass('knv-view');

    const board = parseBoard(this.data || '');
    if (!board) {
      const empty = root.createDiv({ cls: 'knv-empty' });
      empty.createEl('h2', { text: 'Der Kanban-Abschnitt fehlt' });
      empty.createEl('p', { text: 'Diese Notiz benötigt die Überschrift „# Kanban Note“.' });
      const repair = empty.createEl('button', { cls: 'mod-cta', text: 'Abschnitt ergänzen' });
      repair.addEventListener('click', () => this.addMissingSection());
      return;
    }

    const state = this.plugin.getBoardState(this.file?.path);
    const boardTags = this.boardTags();
    this.filterQuery = this.filterQuery || '';
    if (this.filterTag && !boardTags.some((tag) => tag.toLocaleLowerCase() === this.filterTag.toLocaleLowerCase())) {
      this.filterTag = '';
    }
    const toolbar = root.createDiv({ cls: 'knv-toolbar' });
    const filters = toolbar.createDiv({ cls: 'knv-filters' });
    const search = filters.createDiv({ cls: 'knv-search' });
    setIcon(search.createSpan({ cls: 'knv-search-icon' }), 'search');
    const searchInput = search.createEl('input', {
      attr: { type: 'text', placeholder: 'Suchen', 'aria-label': 'Karten durchsuchen' }
    });
    searchInput.value = this.filterQuery;
    const clearSearch = search.createEl('button', {
      cls: this.filterQuery ? 'clickable-icon knv-search-clear' : 'clickable-icon knv-search-clear is-hidden',
      attr: { type: 'button', 'aria-label': 'Suche leeren' }
    });
    setIcon(clearSearch, 'x');
    searchInput.addEventListener('input', () => {
      this.filterQuery = searchInput.value;
      clearSearch.toggleClass('is-hidden', !this.filterQuery);
      this.applyFilters();
    });
    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      this.filterQuery = '';
      clearSearch.addClass('is-hidden');
      this.applyFilters();
      searchInput.focus();
    });

    const tagFilters = filters.createDiv({ cls: 'knv-filter-tags' });
    boardTags.forEach((tag) => {
      const selected = this.filterTag?.toLocaleLowerCase() === tag.toLocaleLowerCase();
      const tagButton = tagFilters.createEl('button', {
        cls: selected ? 'knv-filter-tag is-selected' : 'knv-filter-tag',
        attr: { type: 'button', 'aria-pressed': String(selected) },
        text: '#' + tag
      });
      tagButton.addEventListener('click', () => {
        this.filterTag = selected ? '' : tag;
        this.render();
      });
    });

    const zoom = toolbar.createDiv({ cls: 'knv-zoom' });
    const zoomOut = zoom.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Verkleinern' } });
    setIcon(zoomOut, 'minus');
    zoomOut.addEventListener('click', () => this.changeZoom(-10));
    zoom.createSpan({ cls: 'knv-zoom-value', text: state.zoom + '%' });
    const zoomIn = zoom.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Vergrößern' } });
    setIcon(zoomIn, 'plus');
    zoomIn.addEventListener('click', () => this.changeZoom(10));

    const scroller = root.createDiv({ cls: 'knv-board-scroll' });
    const boardEl = scroller.createDiv({ cls: 'knv-board' });
    boardEl.style.zoom = String(state.zoom / 100);
    this.renderGroup(boardEl, '', ['Backlog']);
    this.renderGroup(boardEl, '', ['Committed']);
    this.renderGroup(boardEl, 'In Process', ['Started', 'Blocked']);
    this.renderGroup(boardEl, 'Finished', ['Done', 'Aborted']);
    this.applyFilters();
  }

  renderGroup(boardEl, title, statuses) {
    const group = boardEl.createDiv({ cls: title ? 'knv-group is-category' : 'knv-group' });
    if (title) group.createDiv({ cls: 'knv-group-title', text: title });
    const columns = group.createDiv({ cls: 'knv-group-columns' });
    statuses.forEach((status) => this.renderColumn(columns, status));
  }

  renderColumn(container, status) {
    const board = parseBoard(this.data || '');
    const state = this.plugin.getBoardState(this.file?.path);
    const collapsed = state.collapsed.includes(status);
    const column = container.createDiv({ cls: collapsed ? 'knv-column is-collapsed' : 'knv-column' });
    column.dataset.status = status;
    const header = column.createDiv({ cls: 'knv-column-header' });
    header.createSpan({ cls: 'knv-column-title', text: status });
    const actions = header.createDiv({ cls: 'knv-column-actions' });
    actions.createSpan({ cls: 'knv-count', text: String(board.cards.filter((card) => card.status === status).length) });
    const add = actions.createEl('button', {
      cls: 'clickable-icon knv-column-add',
      attr: { 'aria-label': 'Karte zu ' + status + ' hinzufügen' }
    });
    setIcon(add, 'plus');
    add.addEventListener('click', () => this.openNewCard(status));
    const collapse = actions.createEl('button', {
      cls: 'clickable-icon knv-column-collapse',
      attr: { 'aria-label': collapsed ? status + ' aufklappen' : status + ' zuklappen' }
    });
    setIcon(collapse, collapsed ? 'chevron-right' : 'chevron-left');
    collapse.addEventListener('click', () => this.toggleColumn(status));
    const cardsEl = column.createDiv({ cls: 'knv-cards' });

    cardsEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.clearDropMarkers();
      const target = this.dropTargetAt(cardsEl, event.clientY);
      if (target) target.addClass('is-drop-before');
      else column.addClass('is-drop-at-end');
    });
    cardsEl.addEventListener('dragleave', (event) => {
      if (!cardsEl.contains(event.relatedTarget)) this.clearDropMarkers();
    });
    cardsEl.addEventListener('drop', (event) => {
      event.preventDefault();
      const target = this.dropTargetAt(cardsEl, event.clientY);
      const targetIndex = target ? Number(target.dataset.cardIndex) : null;
      this.clearDropMarkers();
      const transferred = event.dataTransfer?.getData('text/kanban-note-card');
      if (!transferred) return;
      const index = Number(transferred);
      if (Number.isInteger(index)) this.moveCard(index, status, targetIndex, false);
    });

    board.cards.forEach((card, index) => {
      if (card.status !== status) return;
      const cardEl = cardsEl.createDiv({ cls: 'knv-card', attr: { draggable: 'true' } });
      cardEl.dataset.cardIndex = String(index);
      cardEl.dataset.searchText = [card.title, card.owner, card.note].join(' ').toLocaleLowerCase();
      cardEl.dataset.tags = JSON.stringify(card.tags.map((tag) => tag.toLocaleLowerCase()));
      cardEl.createDiv({ cls: 'knv-card-title', text: card.title });
      const metadata = cardEl.createDiv({ cls: 'knv-card-meta' });
      if (card.deadline) {
        const deadline = metadata.createSpan({
          cls: isDateReached(card.deadline) ? 'knv-date is-reached' : 'knv-date',
          attr: { 'aria-label': 'Deadline ' + card.deadline, title: 'Deadline' }
        });
        setIcon(deadline.createSpan({ cls: 'knv-date-icon' }), 'calendar');
        deadline.createSpan({ text: card.deadline });
      }
      if (card.reminder) {
        const reminder = metadata.createSpan({
          cls: isDateReached(card.reminder) ? 'knv-date is-reached' : 'knv-date',
          attr: { 'aria-label': 'Reminder ' + card.reminder, title: 'Reminder' }
        });
        setIcon(reminder.createSpan({ cls: 'knv-date-icon' }), 'bell');
        reminder.createSpan({ text: card.reminder });
      }
      if (card.owner) metadata.createSpan({ cls: 'knv-owner', text: card.owner });
      if (!metadata.hasChildNodes()) metadata.remove();

      if (card.note) {
        const preview = card.note.replace(/\s+/g, ' ').trim();
        const characters = Array.from(preview);
        const excerpt = characters.length > 100
          ? characters.slice(0, 100).join('').trimEnd() + ' [...]'
          : preview;
        cardEl.createDiv({ cls: 'knv-card-note', text: excerpt });
      }

      if (card.tags.length > 0) {
        const tags = cardEl.createDiv({ cls: 'knv-card-tags' });
        card.tags.forEach((tag) => tags.createSpan({ cls: 'knv-tag', text: '#' + tag }));
      }

      cardEl.addEventListener('click', () => {
        if (!this.suppressCardClick) this.openEditCard(index);
      });
      cardEl.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bounds = cardEl.getBoundingClientRect();
        const after = event.clientY > bounds.top + bounds.height / 2;
        this.clearDropMarkers();
        cardEl.addClass(after ? 'is-drop-after' : 'is-drop-before');
      });
      cardEl.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bounds = cardEl.getBoundingClientRect();
        const after = event.clientY > bounds.top + bounds.height / 2;
        const transferred = event.dataTransfer?.getData('text/kanban-note-card');
        this.clearDropMarkers();
        if (!transferred) return;
        const draggedIndex = Number(transferred);
        if (Number.isInteger(draggedIndex)) this.moveCard(draggedIndex, status, index, after);
      });
      cardEl.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/kanban-note-card', String(index));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        cardEl.addClass('is-dragging');
        this.suppressCardClick = true;
      });
      cardEl.addEventListener('dragend', () => {
        cardEl.removeClass('is-dragging');
        this.clearDropMarkers();
        window.setTimeout(() => { this.suppressCardClick = false; }, 0);
      });
    });

  }

  changeZoom(delta) {
    const state = this.plugin.getBoardState(this.file?.path);
    state.zoom = Math.max(40, Math.min(140, state.zoom + delta));
    this.plugin.saveBoardState(this.file?.path, state);
    this.render();
  }

  applyFilters() {
    const query = cleanOneLine(this.filterQuery).toLocaleLowerCase();
    const tag = cleanOneLine(this.filterTag).toLocaleLowerCase();
    this.contentEl.querySelectorAll('.knv-card').forEach((card) => {
      let tags = [];
      try { tags = JSON.parse(card.dataset.tags || '[]'); } catch (error) { tags = []; }
      const visible = (!query || (card.dataset.searchText || '').includes(query))
        && (!tag || tags.includes(tag));
      card.toggleClass('is-filtered-out', !visible);
    });

    this.contentEl.querySelectorAll('.knv-column').forEach((column) => {
      const visibleCards = column.querySelectorAll(':scope > .knv-cards > .knv-card:not(.is-filtered-out)').length;
      const count = column.querySelector('.knv-count');
      if (count) count.setText(String(visibleCards));
    });
  }

  toggleColumn(status) {
    const state = this.plugin.getBoardState(this.file?.path);
    state.collapsed = state.collapsed.includes(status)
      ? state.collapsed.filter((item) => item !== status)
      : [...state.collapsed, status];
    this.plugin.saveBoardState(this.file?.path, state);
    this.render();
  }

  openNewCard(status = 'Backlog') {
    new CardModal(this.app, {
      title: '', status, deadline: '', reminder: '', owner: '', tags: [], note: ''
    }, this.boardTags(), (card) => this.addCard(card)).open();
  }

  openEditCard(index) {
    const card = parseBoard(this.data || '')?.cards[index];
    if (!card) return;
    new CardModal(this.app, card, this.boardTags(), (changed) => this.replaceCard(index, changed)).open();
  }

  boardTags() {
    const cards = parseBoard(this.data || '')?.cards || [];
    return [...new Set(cards.flatMap((card) => card.tags))].sort((a, b) => a.localeCompare(b));
  }

  addCard(card) {
    const board = parseBoard(this.data || '');
    if (!board) return;
    const prefix = this.data.slice(0, board.sectionEnd).replace(/\s*$/, '');
    const suffix = this.data.slice(board.sectionEnd);
    this.updateData(prefix + '\n\n' + serializeCard(card) + '\n\n' + suffix.replace(/^\s*/, ''));
  }

  replaceCard(index, changed) {
    const card = parseBoard(this.data || '')?.cards[index];
    if (!card) return;
    const replacement = serializeCard(changed) + '\n\n';
    this.updateData(this.data.slice(0, card.start) + replacement + this.data.slice(card.end).replace(/^\s*/, ''));
  }

  clearDropMarkers() {
    this.contentEl.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-at-end').forEach((element) => {
      element.removeClass('is-drop-before', 'is-drop-after', 'is-drop-at-end');
    });
  }

  dropTargetAt(cardsEl, clientY) {
    const cards = Array.from(cardsEl.querySelectorAll(':scope > .knv-card:not(.is-dragging):not(.is-filtered-out)'));
    return cards.find((card) => {
      const bounds = card.getBoundingClientRect();
      return clientY < bounds.top + bounds.height / 2;
    }) || null;
  }

  moveCard(draggedIndex, status, targetIndex, after) {
    const board = parseBoard(this.data || '');
    if (!board || !board.cards[draggedIndex]) return;

    const cards = board.cards.slice();
    const moved = cards[draggedIndex];
    const target = targetIndex === null ? null : board.cards[targetIndex];
    cards.splice(draggedIndex, 1);
    moved.status = status;

    let insertAt;
    if (target && target !== moved) {
      const targetPosition = cards.indexOf(target);
      insertAt = targetPosition + (after ? 1 : 0);
    } else if (target === moved) {
      insertAt = Math.min(draggedIndex, cards.length);
    } else {
      const lastInColumn = cards.reduce(
        (found, card, index) => card.status === status ? index : found,
        -1
      );
      insertAt = lastInColumn === -1 ? cards.length : lastInColumn + 1;
    }

    cards.splice(insertAt, 0, moved);
    const firstCardStart = board.cards[0]?.start ?? board.sectionEnd;
    const beforeCards = this.data.slice(0, firstCardStart).replace(/\s*$/, '');
    const afterBoard = this.data.slice(board.sectionEnd).replace(/^\s*/, '');
    const serialized = cards.map(serializeCard).join('\n\n');
    const boardText = serialized ? beforeCards + '\n\n' + serialized + '\n\n' : beforeCards + '\n';
    this.updateData(boardText + afterBoard);
  }

  addMissingSection() {
    this.updateData((this.data || '').replace(/\s*$/, '') + '\n\n' + BOARD_HEADING + '\n');
  }

  updateData(data) {
    this.data = data;
    this.requestSave();
    this.render();
  }
}

module.exports = class KanbanNotePlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = { boards: saved?.boards || {} };
    this.markdownOverrides = new WeakMap();
    this.switchingLeaves = new WeakSet();
    this.noteActions = new Set();
    this.registerView(VIEW_TYPE, (leaf) => new KanbanNoteView(leaf, this));

    this.addCommand({
      id: 'convert-current-note',
      name: 'Aktuelle Notiz in Kanban Note umwandeln',
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (!checking) this.convertNote(view.file, view.leaf);
        return true;
      }
    });

    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => this.handleLeaf(leaf)));
    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      if (!file) return;
      window.setTimeout(() => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file?.path === file.path) this.handleLeaf(view.leaf);
      }, 0);
    }));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.decorateMarkdownLeaves()));

    this.app.workspace.onLayoutReady(() => {
      this.decorateMarkdownLeaves();
      this.app.workspace.getLeavesOfType('markdown').forEach((leaf) => this.handleLeaf(leaf));
    });
  }

  onunload() {
    this.noteActions.forEach((action) => action.remove());
    this.noteActions.clear();
  }

  getBoardState(path) {
    const key = path || '__default__';
    const saved = this.settings.boards[key] || {};
    return {
      zoom: Number.isFinite(saved.zoom) ? saved.zoom : 76,
      collapsed: Array.isArray(saved.collapsed)
        ? saved.collapsed.filter((status) => VALID_STATUSES.has(status))
        : []
    };
  }

  saveBoardState(path, state) {
    if (!path) return;
    this.settings.boards[path] = {
      zoom: state.zoom,
      collapsed: state.collapsed.slice()
    };
    this.saveData(this.settings);
  }

  decorateMarkdownLeaves() {
    this.app.workspace.getLeavesOfType('markdown').forEach((leaf) => this.ensureNoteAction(leaf));
  }

  ensureNoteAction(leaf) {
    const view = leaf?.view;
    if (!(view instanceof MarkdownView)) return;
    if (view.kanbanNoteAction?.isConnected) return;
    const action = view.addAction('columns-3', 'Als Kanban Note anzeigen', () => {
      const file = view.file;
      if (!file) return;
      if (isKanbanNote(this.app, file)) this.openBoard(file, leaf);
      else this.convertNote(file, leaf);
    });
    action.addClass('kanban-note-action');
    view.kanbanNoteAction = action;
    this.noteActions.add(action);
  }

  async handleLeaf(leaf) {
    if (!leaf || this.switchingLeaves.has(leaf) || !(leaf.view instanceof MarkdownView)) return;
    this.ensureNoteAction(leaf);
    const file = leaf.view.file;
    if (!file) return;
    const overridePath = this.markdownOverrides.get(leaf);
    if (overridePath && overridePath !== file.path) this.markdownOverrides.delete(leaf);
    if (this.markdownOverrides.get(leaf) === file.path) return;
    if (isKanbanNote(this.app, file)) await this.openBoard(file, leaf);
  }

  async convertNote(file, leaf) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter[VIEW_PROPERTY] = VIEW_PROPERTY_VALUE;
    });

    let text = await this.app.vault.read(file);
    const hasSection = markdownHeadings(text).some(
      (heading) => heading.level === 1 && heading.title === 'Kanban Note'
    );
    if (!hasSection) {
      text = text.replace(/\s*$/, '') + '\n\n' + BOARD_HEADING + '\n';
      await this.app.vault.modify(file, text);
    }

    this.markdownOverrides.delete(leaf);
    await this.openBoard(file, leaf);
    new Notice('Diese Notiz ist jetzt eine Kanban Note.');
  }

  async openBoard(file, leaf) {
    if (this.switchingLeaves.has(leaf)) return;
    this.switchingLeaves.add(leaf);
    try {
      await leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: true });
    } finally {
      this.switchingLeaves.delete(leaf);
    }
  }

  async showMarkdown(view) {
    if (!view.file) return;
    const leaf = view.leaf;
    const path = view.file.path;
    await view.save();
    this.markdownOverrides.set(leaf, path);
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source' }, active: true });
    this.ensureNoteAction(leaf);
  }
};
