// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { BlockBridge } from './blockBridge.js';
import { LABEL_STOCKS, getStock, DEFAULT_STOCK_ID } from './labelStock.js';
import { FIELD_TOKENS, ROW_PRESETS, DEFAULT_ROW_TEMPLATES } from './labelFields.js';
import { layoutSheets } from './labelLayout.js';
import { buildSheetSvg, makeCanvasMeasurer } from './labelSheetSvg.js';

export class CableWizardApp {
  constructor() {
    this.stockId = DEFAULT_STOCK_ID;
    this.config = {
      rows: [...DEFAULT_ROW_TEMPLATES],
      forceAllCaps: true,
      bothEnds: true,
      endMarker: 'ab', // 'none' | 'ab' | 'srcdest' | 'swap'
      startOffset: 0,
    };
    this.runs = [];
    this.currentPageIndex = 0;
    this.previewTheme = 'dark';
    this.measurer = makeCanvasMeasurer();

    this.bridge = new BlockBridge({
      name: 'Cable Label Wizard',
      type: 'cable_labels',
      onBlockLoaded: (block, meta) => this.handleBlockLoaded(block, meta),
      onBlockChanged: () => {},
    });

    this.initElements();
    this.attachEvents();
    this.loadInitialData();
  }

  initElements() {
    // Window header buttons
    this.btnOpen = document.getElementById('btn-open');
    this.btnSave = document.getElementById('btn-save');
    this.btnClose = document.getElementById('btn-close');
    this.btnSyncDiscovered = document.getElementById('btn-sync-discovered');

    // Wizard step tabs
    this.tabStep1 = document.getElementById('tab-step1');
    this.tabStep2 = document.getElementById('tab-step2');
    this.tabStep3 = document.getElementById('tab-step3');
    this.paneStep1 = document.getElementById('pane-step1');
    this.paneStep2 = document.getElementById('pane-step2');
    this.paneStep3 = document.getElementById('pane-step3');

    // Controls - Step 1
    this.selectStock = document.getElementById('select-stock');
    this.inputOffset = document.getElementById('input-start-offset');
    this.selectTheme = document.getElementById('select-theme');

    // Controls - Step 2
    this.inputRow1 = document.getElementById('input-row1');
    this.inputRow2 = document.getElementById('input-row2');
    this.inputRow3 = document.getElementById('input-row3');
    this.selectPreset1 = document.getElementById('select-preset1');
    this.selectPreset2 = document.getElementById('select-preset2');
    this.selectPreset3 = document.getElementById('select-preset3');
    this.chkBothEnds = document.getElementById('chk-both-ends');
    this.selectEndMarker = document.getElementById('select-end-marker');
    this.chkAllCaps = document.getElementById('chk-all-caps');

    // Step 3 / Data
    this.tableBody = document.getElementById('cable-table-body');
    this.btnAddRow = document.getElementById('btn-add-row');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.fileImportCsv = document.getElementById('file-import-csv');
    this.btnPrint = document.getElementById('btn-print');

    // Preview controls
    this.previewContainer = document.getElementById('sheet-preview-container');
    this.btnPrevPage = document.getElementById('btn-prev-page');
    this.btnNextPage = document.getElementById('btn-next-page');
    this.pageIndicator = document.getElementById('page-indicator');
    this.labelCountPill = document.getElementById('label-count-pill');

    this.populateDropdowns();
  }

  populateDropdowns() {
    // Stocks
    this.selectStock.innerHTML = '';
    LABEL_STOCKS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.sheet.standard}, ${s.grid.cols}x${s.grid.rows})`;
      this.selectStock.appendChild(opt);
    });
    this.selectStock.value = this.stockId;

    // Presets
    [this.selectPreset1, this.selectPreset2, this.selectPreset3].forEach((sel, idx) => {
      sel.innerHTML = '<option value="">Preset Template...</option>';
      ROW_PRESETS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.template;
        opt.textContent = p.label;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        if (!sel.value && sel.value !== '') return;
        const target = idx === 0 ? this.inputRow1 : (idx === 1 ? this.inputRow2 : this.inputRow3);
        target.value = sel.value;
        this.updateConfigFromInputs();
      });
    });

    this.inputRow1.value = this.config.rows[0];
    this.inputRow2.value = this.config.rows[1];
    this.inputRow3.value = this.config.rows[2];
    this.chkBothEnds.checked = this.config.bothEnds;
    this.selectEndMarker.value = this.config.endMarker;
    this.chkAllCaps.checked = this.config.forceAllCaps;
    this.inputOffset.value = this.config.startOffset;
  }

  attachEvents() {
    // Window lifecycle
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.bridge.close());
    this.btnSyncDiscovered?.addEventListener('click', () => this.loadFromDiscoveredProject());

    // Tabs
    const tabs = [
      { tab: this.tabStep1, pane: this.paneStep1 },
      { tab: this.tabStep2, pane: this.paneStep2 },
      { tab: this.tabStep3, pane: this.paneStep3 },
    ];
    tabs.forEach(({ tab, pane }) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.tab.classList.remove('active');
          t.pane.classList.remove('active');
        });
        tab.classList.add('active');
        pane.classList.add('active');
      });
    });

    // Inputs changing sheet config
    const onConfigChange = () => this.updateConfigFromInputs();
    this.selectStock.addEventListener('change', () => {
      this.stockId = this.selectStock.value;
      this.render();
    });
    this.inputOffset.addEventListener('input', onConfigChange);
    this.selectTheme.addEventListener('change', () => {
      this.previewTheme = this.selectTheme.value;
      this.render();
    });
    this.inputRow1.addEventListener('input', onConfigChange);
    this.inputRow2.addEventListener('input', onConfigChange);
    this.inputRow3.addEventListener('input', onConfigChange);
    this.chkBothEnds.addEventListener('change', onConfigChange);
    this.selectEndMarker.addEventListener('change', onConfigChange);
    this.chkAllCaps.addEventListener('change', onConfigChange);

    // Pagination
    this.btnPrevPage.addEventListener('click', () => {
      if (this.currentPageIndex > 0) {
        this.currentPageIndex--;
        this.renderPreviewOnly();
      }
    });
    this.btnNextPage.addEventListener('click', () => {
      const pages = this.getPages();
      if (this.currentPageIndex < pages.length - 1) {
        this.currentPageIndex++;
        this.renderPreviewOnly();
      }
    });

    // Table Actions
    this.btnAddRow?.addEventListener('click', () => {
      const nextNum = (this.runs.length + 1).toString().padStart(4, '0');
      this.runs.push({
        id: `cbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        wireNumber: `W-${nextNum}`,
        source: 'CORE-SW01',
        sourceConnector: 'ETH-01',
        destination: 'DEV-DSP01',
        destConnector: 'DANTE-1',
        wireType: 'CAT6A-STP',
        sourceRoom: 'RACK-A',
        destinationRoom: 'RACK-B',
        color: 'BLUE',
      });
      this.render();
    });

    this.btnExportCsv?.addEventListener('click', () => this.exportCsv());
    this.fileImportCsv?.addEventListener('change', (e) => this.importCsv(e));
    this.btnPrint?.addEventListener('click', () => window.print());

    // Token insertion buttons
    document.querySelectorAll('.token-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const token = `{${e.target.dataset.token}}`;
        // insert into active or default row 1
        const active = document.activeElement;
        const target = (active === this.inputRow2 || active === this.inputRow3) ? active : this.inputRow1;
        target.value += (target.value ? ' ' : '') + token;
        this.updateConfigFromInputs();
      });
    });
  }

  updateConfigFromInputs() {
    this.config.rows = [
      this.inputRow1.value || '',
      this.inputRow2.value || '',
      this.inputRow3.value || '',
    ];
    this.config.bothEnds = this.chkBothEnds.checked;
    this.config.endMarker = this.selectEndMarker.value;
    this.config.forceAllCaps = this.chkAllCaps.checked;
    this.config.startOffset = parseInt(this.inputOffset.value, 10) || 0;
    this.renderPreviewOnly();
  }

  loadInitialData() {
    // Attempt loading from discovered project, fallback to default runs
    this.loadFromDiscoveredProject().catch(() => {
      this.loadSampleRuns();
    });
  }

  async loadFromDiscoveredProject() {
    try {
      const data = await this.bridge.fetchDiscoveredProject();
      if (data && (data.cables || data.wires || data.runs || data.connections)) {
        const raw = data.cables || data.wires || data.runs || data.connections;
        this.runs = this.normalizeRuns(raw);
        this.render();
        return;
      }
    } catch (_) {}
    this.loadSampleRuns();
  }

  loadSampleRuns() {
    this.runs = [
      { id: 'cbl_001', wireNumber: 'A10101', source: 'SW-NET-01', sourceConnector: 'P01', destination: 'DSP-CORE-01', destConnector: 'LAN1', wireType: 'CAT6A', sourceRoom: 'MDF', destinationRoom: 'MDF', color: 'BLUE' },
      { id: 'cbl_002', wireNumber: 'A10102', source: 'SW-NET-01', sourceConnector: 'P02', destination: 'DSP-CORE-01', destConnector: 'LAN2', wireType: 'CAT6A', sourceRoom: 'MDF', destinationRoom: 'MDF', color: 'BLUE' },
      { id: 'cbl_003', wireNumber: 'A10201', source: 'DSP-CORE-01', sourceConnector: 'OUT1', destination: 'AMP-MAIN-L', destConnector: 'IN1', wireType: 'ANALOG-AUDIO', sourceRoom: 'MDF', destinationRoom: 'RACK-B', color: 'GRAY' },
      { id: 'cbl_004', wireNumber: 'A10202', source: 'DSP-CORE-01', sourceConnector: 'OUT2', destination: 'AMP-MAIN-R', destConnector: 'IN1', wireType: 'ANALOG-AUDIO', sourceRoom: 'MDF', destinationRoom: 'RACK-B', color: 'GRAY' },
      { id: 'cbl_005', wireNumber: 'V20101', source: 'CAM-PTZ-01', sourceConnector: 'HDMI', destination: 'TX-ENC-01', destConnector: 'HDMI-IN', wireType: 'HDMI-4K', sourceRoom: 'ROOM-101', destinationRoom: 'ROOM-101', color: 'BLACK' },
      { id: 'cbl_006', wireNumber: 'V20102', source: 'TX-ENC-01', sourceConnector: 'ETH', destination: 'SW-NET-01', destConnector: 'P24', wireType: 'CAT6A', sourceRoom: 'ROOM-101', destinationRoom: 'MDF', color: 'BLUE' },
    ];
    this.render();
  }

  normalizeRuns(rawList) {
    if (!Array.isArray(rawList)) return [];
    return rawList.map((item, idx) => ({
      id: item.id || `cbl_${idx + 1}`,
      wireNumber: item.wireNumber || item.number || item.label || `CBL-${idx + 1}`,
      source: item.source || item.fromDevice || item.from || 'SRC',
      sourceConnector: item.sourceConnector || item.fromPort || '',
      destination: item.destination || item.toDevice || item.to || 'DEST',
      destConnector: item.destConnector || item.toPort || '',
      wireType: item.wireType || item.type || 'SIGNAL',
      sourceRoom: item.sourceRoom || '',
      destinationRoom: item.destinationRoom || '',
      color: item.color || '',
    }));
  }

  handleBlockLoaded(block, meta) {
    if (block) {
      if (Array.isArray(block.runs)) this.runs = block.runs;
      else if (Array.isArray(block.cables)) this.runs = this.normalizeRuns(block.cables);
      else if (Array.isArray(block)) this.runs = this.normalizeRuns(block);

      if (block.stockId) {
        this.stockId = block.stockId;
        this.selectStock.value = this.stockId;
      }
      if (block.config) {
        this.config = { ...this.config, ...block.config };
        this.populateDropdowns();
      }
      this.render();
    }
  }

  saveBlock() {
    const block = {
      type: 'cable_labels',
      stockId: this.stockId,
      config: this.config,
      runs: this.runs,
      timestamp: new Date().toISOString(),
    };
    this.bridge.saveBlock(block, {
      title: `Cable Labels (${this.runs.length} runs)`,
      count: this.runs.length,
    });
  }

  getPages() {
    const stock = getStock(this.stockId);
    return layoutSheets(this.runs, this.config, stock);
  }

  render() {
    this.renderTable();
    this.renderPreviewOnly();
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    this.runs.forEach((run, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-idx">${idx + 1}</td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="wireNumber" value="${run.wireNumber || ''}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="source" value="${run.source || ''}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="sourceConnector" value="${run.sourceConnector || ''}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="destination" value="${run.destination || ''}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="destConnector" value="${run.destConnector || ''}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="wireType" value="${run.wireType || ''}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="sourceRoom" value="${run.sourceRoom || ''}"></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="destinationRoom" value="${run.destinationRoom || ''}"></td>
        <td class="col-actions">
          <button class="btn-icon btn-del-row" data-idx="${idx}" title="Delete Cable">🗑</button>
        </td>
      `;
      this.tableBody.appendChild(tr);
    });

    // Attach inline edit handlers
    this.tableBody.querySelectorAll('.cell-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const f = e.target.dataset.field;
        this.runs[i][f] = e.target.value;
        this.renderPreviewOnly();
        this.bridge.notifyChanged();
      });
    });

    this.tableBody.querySelectorAll('.btn-del-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        this.runs.splice(i, 1);
        this.render();
        this.bridge.notifyChanged();
      });
    });
  }

  renderPreviewOnly() {
    const stock = getStock(this.stockId);
    const pages = layoutSheets(this.runs, this.config, stock);

    if (this.currentPageIndex >= pages.length) {
      this.currentPageIndex = Math.max(0, pages.length - 1);
    }

    const totalLabels = this.runs.length * (this.config.bothEnds ? 2 : 1);
    this.labelCountPill.textContent = `${this.runs.length} Runs · ${totalLabels} Labels · ${pages.length} Sheet(s)`;
    this.pageIndicator.textContent = pages.length > 0 ? `Sheet ${this.currentPageIndex + 1} of ${pages.length}` : '0 Sheets';

    if (pages.length === 0) {
      this.previewContainer.innerHTML = '<div class="preview-empty">No cable runs to preview</div>';
      return;
    }

    const page = pages[this.currentPageIndex];
    const svgString = buildSheetSvg(page, stock, {
      measure: this.measurer,
      theme: this.previewTheme,
      showCellNumbers: true,
    });

    this.previewContainer.innerHTML = svgString;
  }

  exportCsv() {
    const headers = ['wireNumber', 'source', 'sourceConnector', 'destination', 'destConnector', 'wireType', 'sourceRoom', 'destinationRoom', 'color'];
    const lines = [headers.join(',')];
    this.runs.forEach(r => {
      const row = headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`);
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cable_labels_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  }

  importCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const newRuns = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        const run = { id: `cbl_imp_${i}` };
        headers.forEach((h, col) => {
          run[h] = parts[col] || '';
        });
        newRuns.push(run);
      }
      if (newRuns.length > 0) {
        this.runs = newRuns;
        this.render();
        this.bridge.notifyChanged();
      }
    };
    reader.readAsText(file);
  }

  promptOpen() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const parsed = JSON.parse(re.target.result);
          this.handleBlockLoaded(parsed, { title: file.name });
        } catch (err) {
          alert('Invalid JSON block file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}

// Auto-boot in browser
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.cableWizard = new CableWizardApp();
  });
}
