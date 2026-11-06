// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { connectCableHost, toBlock, blockMeta, fromBlock, normalizeRuns, runFromThing } from './cableHost.js';
import { cableTable } from './cableTable.js';
import { LABEL_STOCKS, getStock, DEFAULT_STOCK_ID } from './labelStock.js';
import { FIELD_TOKENS, ROW_PRESETS, DEFAULT_ROW_TEMPLATES } from './labelFields.js';
import { layoutSheets } from './labelLayout.js';
import { buildSheetSvg, makeCanvasMeasurer } from './labelSheetSvg.js';
import { cablesToIfc, cablesFromIfc } from './cableIfc.js';

const S0 = () => (typeof window !== 'undefined' ? window.APKSoftapp : null);
const normId = (id) => String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CSV_FIELDS = ['wireNumber', 'source', 'sourceConnector', 'destination', 'destConnector', 'wireType', 'sourceRoom', 'destinationRoom', 'color'];

/** Say a problem (APKSoftapp card), or fall back to alert when the SDK did not load. */
function say(code, opts) {
  const S = S0();
  if (S && S.showProblem) S.showProblem(code, opts);
  else if (typeof alert === 'function') alert(`${opts.subject ? opts.subject + ': ' : ''}${opts.detail || code}`);
}

/** Why a loaded block / file gives the labeller nothing to use ('' when it does). Names the field. */
export function blockFault(parts, block) {
  if (block == null) return '';
  if (typeof block !== 'object') return `The block is ${typeof block}, not a cable_labels object.`;
  const notes = [];
  if (!parts.runs && !parts.stockId && !parts.config) notes.push('It has no runs[], cables[], stockId or config field, so nothing was loaded.');
  if (parts.stockId && !LABEL_STOCKS.some((st) => normId(st.id) === normId(parts.stockId))) {
    notes.push(`stockId "${parts.stockId}" is not a known label stock (${LABEL_STOCKS.map((st) => st.id).join(', ')}); ${getStock(parts.stockId).id} is used instead.`);
  }
  return notes.join(' ');
}

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

    this.initElements();
    this.attachEvents();
    this.loadSampleRuns();

    // The CAD bridge (cad.like.audio/host@1) via the vendored APKSoftapp client. It
    // says editorReady at once, so the elements above exist before a block arrives.
    const S = window.APKSoftapp;
    this.host = S ? connectCableHost(S, {
      getState: () => ({ stockId: this.stockId, config: this.config, runs: this.runs }),
      onLoad: (parts, meta, block) => this.applyBlock(parts, meta, block),
    }) : null;

    if (S) S.describe({
      name: 'Cable Label Wizard',
      does: 'Lays cable runs out as printable wrap-around labels on a chosen label stock, both ends marked.',
      inputs: [
        { name: 'Cable block', from: 'the CAD (cable_labels block: runs[] or cables[], stockId, config)', kind: 'block' },
        { name: 'Block .json', from: 'Open (a file saved by Save & Return, or any { cables: [...] } / [...] list)', kind: 'file' },
        { name: 'Cable model .ifc', from: 'Open (IFC4X3: each IfcCableSegment is a run, its ends the ports it joins)', kind: 'file' },
        { name: 'Cable CSV', from: `Import CSV (header row with ${CSV_FIELDS.join(', ')})`, kind: 'file' },
        { name: 'Discovered devices', from: 'the bus, via Discovered (kinds filter from config/discovered.json)', kind: 'bus', topic: 'Device/<kind>/<id>' },
      ],
      outputs: [
        { name: 'Label sheets', to: "the browser's print dialog (Print)", kind: 'file' },
        { name: 'Cable CSV', to: 'cable_labels_<date>.csv download (Export CSV)', kind: 'file' },
        { name: 'Cable block', to: 'the CAD drawing (Save & Return), or standalone Save Model: cable_labels.json + its cable_labels.ifc twin (the cables as IfcCableSegment)', kind: 'block' },
      ],
      controls: [
        { name: '1. Stock', how: 'Pick the label stock, the start offset (skip used labels) and the preview theme' },
        { name: '2. Templates', how: 'Type the three label rows or pick a preset; click a {token} pill to insert it' },
        { name: '3. Format', how: 'Both ends, end marker (A/B, src/dest, swap) and ALL CAPS' },
        { name: 'Prev / Next Sheet, Print', how: 'Page through the preview and print it' },
        { name: 'Cable table', how: '+ Add Cable, edit a cell, delete a row; Import / Export CSV' },
        { name: 'Discovered / Open / Save & Return / ✕', how: 'Start a run from a bus device, open a .json, send back to the CAD, close' },
      ],
      problems: ['bad_json', 'bad_input', 'file_unreadable', 'config_invalid', 'save_failed'],
    });
  }

  changed() {
    if (this.host) this.host.changed(toBlock({ stockId: this.stockId, config: this.config, runs: this.runs }));
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
    this.tableHost = document.getElementById('cable-table');
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
    this.btnClose?.addEventListener('click', () => { if (this.host) this.host.close(); });
    this.btnSyncDiscovered?.addEventListener('click', () => this.toggleDiscovered());

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

  /** The Discovered panel: what the bus knows (APKSoftapp.discovered), each one can start a run. */
  async toggleDiscovered() {
    const panel = document.getElementById('discovered-panel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (panel.hidden || panel.dataset.started) return;
    panel.dataset.started = '1';
    // the Discovered panel is the shared client's (ROAD-3502): kinds in config/discovered.json
    if (!window.APKSoftapp) return;
    await window.APKSoftapp.discoveredPanel(document.getElementById('discovered-table'), {
      status: document.getElementById('discovered-status'),
      configUrl: './config/discovered.json',
      id: 'cable-labels-discovered',
      pickLabel: 'New run from',
      onPick: (thing) => {
        this.runs.push(runFromThing(thing, this.runs.length + 1));
        this.render();
        this.changed();
      },
    });
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
    return normalizeRuns(rawList);
  }

  handleBlockLoaded(block, meta) {
    this.applyBlock(fromBlock(block), meta, block);
    this.changed();
  }

  /** Apply what a block sets (fromBlock): runs, stock, config. */
  applyBlock(parts, meta = {}, block = null) {
    const fault = blockFault(parts, block);
    if (fault) say('bad_input', { subject: meta.blockName || meta.title || 'CAD block', detail: fault,
      fix: ['Open a cable_labels block (runs[], stockId, config) or a cable list ({ "cables": [...] }).'] });
    if (parts.runs) this.runs = parts.runs;
    if (parts.stockId) {
      this.stockId = parts.stockId;
      this.selectStock.value = this.stockId;
    }
    if (parts.config) {
      this.config = { ...this.config, ...parts.config };
      this.populateDropdowns();
    }
    const tag = document.getElementById('block-tag');
    if (tag && (meta.blockName || meta.title)) tag.textContent = meta.blockName || meta.title;
    this.render();
  }

  /** Save: into the drawing inside the CAD. Standalone: the block and its .ifc twin (the cables), both or
      neither (APKSoftapp.saveModel). Returns 'host' | 'download' | 'directory' | '' (nothing saved). */
  async saveBlock() {
    if (!this.host) {
      const tag = document.getElementById('block-tag');
      if (tag) tag.textContent = 'NOT SAVED: SHARED CODE MISSING';
      return '';
    }
    const block = toBlock({ stockId: this.stockId, config: this.config, runs: this.runs });
    const meta = blockMeta(this.runs);
    const S = S0();
    let how = '';
    if (this.host.embedded || !S || typeof S.saveModel !== 'function') {
      try { how = this.host.save(block, meta); }
      catch (e) { say('save_failed', { subject: 'cable_labels', detail: e && e.message ? e.message : String(e), onRetry: () => this.saveBlock() }); return ''; }
    } else {
      const r = await S.saveModel(block, { name: meta.filename, toIfc: (b) => cablesToIfc(b, { name: meta.filename }) });
      if (!r.ok) {
        if (!r.cancelled) S.showProblem(r.problem || 'save_failed', { onRetry: () => this.saveBlock() });
        return '';
      }
      how = r.via;
    }
    const tag = document.getElementById('block-tag');
    if (tag && how) tag.textContent = how === 'host' ? 'SAVED TO THE CAD' : `SAVED ${meta.filename.toUpperCase()}.IFC + .JSON`;
    return how;
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
    if (!this.tableHost) return;
    cableTable(this.tableHost, this.runs, {
      onEdit: () => { this.renderPreviewOnly(); this.changed(); },
      onDelete: (i) => { this.runs.splice(i, 1); this.render(); this.changed(); },
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
    event.target.value = '';   // the same file can be picked again after a fix
    const retry = () => this.fileImportCsv?.click();
    const fix = [`Give the CSV a header row naming its columns (${CSV_FIELDS.join(', ')}), one cable per line below it. Export CSV writes one to start from.`];
    const reader = new FileReader();
    reader.onerror = () => say('file_unreadable', { subject: file.name, detail: reader.error ? reader.error.message : 'The browser could not read the file.', onRetry: retry });
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        say('bad_input', { subject: file.name, detail: lines.length ? 'The CSV has a header row but no cable rows; nothing was imported.' : 'The file is empty; nothing was imported.', fix, onRetry: retry });
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      if (!headers.some((h) => CSV_FIELDS.includes(h))) {
        say('bad_input', { subject: file.name, detail: `Header row "${lines[0].slice(0, 120)}" names none of the label fields, so every label would be blank; nothing was imported.`, fix, onRetry: retry });
        return;
      }
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
        this.changed();
      }
    };
    reader.readAsText(file);
  }

  /** An IFC model's cables (cableIfc.js) as the runs; the label sheet stays as it is. */
  loadIfc(stepText, name) {
    let parts;
    try { parts = cablesFromIfc(stepText); }
    catch (err) {
      say('bad_input', { subject: name, detail: err.message, onRetry: () => this.promptOpen(),
        fix: ['Open an .ifc saved by this wizard (or the Wirelist, or a bench): it needs IfcCableSegment cables.'] });
      return false;
    }
    this.applyBlock(parts, { title: name });
    this.changed();
    return true;
  }

  /** Open a cable_labels .json, a { cables: [...] } list, or an IFC model (.ifc: its cables). */
  async promptOpen() {
    const S = S0();
    if (S && typeof S.openModel === 'function') {
      const r = await S.openModel({});
      if (!r.ok) {
        if (!r.cancelled) S.showProblem(r.problem, { onRetry: () => this.promptOpen(),
          fix: ['Pick a cable_labels .json saved by Save, a { "cables": [...] } list, or an .ifc with IfcCableSegment cables.'] });
        return;
      }
      if (r.kind === 'ifc') this.loadIfc(r.text, r.name);
      else this.handleBlockLoaded(r.model, { title: r.name });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const retry = () => this.promptOpen();
      const reader = new FileReader();
      reader.onerror = () => say('file_unreadable', { subject: file.name, detail: reader.error ? reader.error.message : 'The browser could not read the file.', onRetry: retry });
      reader.onload = (re) => {
        let parsed;
        try {
          parsed = JSON.parse(re.target.result);
        } catch (err) {
          say('bad_json', { subject: file.name, detail: `${file.name} is not valid JSON: ${err.message}`, onRetry: retry,
            fix: ['Pick a cable_labels .json saved by Save & Return, or a { "cables": [...] } list.'] });
          return;
        }
        this.handleBlockLoaded(parsed, { title: file.name });
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
