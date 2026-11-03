// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * Standardized Standalone Block Editor Bridge.
 *
 * Implements the block contract:
 * - The caller (OS Window Manager, Schematic Canvas, or API) sends an entity block
 * - The editor loads the block, provides full editing UI in the OneThing environment
 * - The editor updates the block and returns the modified block on Save or change
 */
export class BlockBridge {
  constructor(options = {}) {
    this.editorName = options.name || 'Block Editor';
    this.blockType = options.type || 'generic';
    this.onBlockLoaded = options.onBlockLoaded || (() => {});
    this.onBlockChanged = options.onBlockChanged || (() => {});
    this.block = options.defaultBlock || null;
    this.meta = options.meta || {};
    this.isEmbedded = typeof window !== 'undefined' && window.parent && window.parent !== window;

    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'APK_LOAD_BLOCK' || msg.type === 'LOAD_BLOCK') {
        this.loadBlock(msg.block, msg.meta || {});
      } else if (msg.type === 'APK_REQUEST_BLOCK') {
        this.saveBlock();
      }
    });

    // Notify parent window that this editor block bridge is ready to receive data
    if (this.isEmbedded) {
      window.parent.postMessage({ type: 'APK_EDITOR_READY', editor: this.editorName, blockType: this.blockType }, '*');
    }
  }

  loadBlock(block, meta = {}) {
    this.block = block;
    this.meta = { ...this.meta, ...meta };
    const tag = document.getElementById('block-tag');
    if (tag) {
      tag.textContent = meta.title || meta.name || `${this.blockType.toUpperCase()} BLOCK`;
    }
    this.onBlockLoaded(this.block, this.meta);
  }

  notifyChanged() {
    this.onBlockChanged(this.block, this.meta);
    if (this.isEmbedded) {
      window.parent.postMessage({ type: 'APK_BLOCK_CHANGED', block: this.block, meta: this.meta }, '*');
    }
  }

  saveBlock() {
    if (this.isEmbedded) {
      window.parent.postMessage({ type: 'APK_SAVE_BLOCK', block: this.block, meta: this.meta }, '*');
    }
    // Also store in localStorage for standalone persistence
    try {
      localStorage.setItem(`apk_block_${this.blockType}`, JSON.stringify(this.block));
    } catch {}
    return this.block;
  }

  close() {
    if (this.isEmbedded) {
      window.parent.postMessage({ type: 'APK_CLOSE_BLOCK', editor: this.editorName }, '*');
    } else {
      window.close();
    }
  }

  /** Attempt to fetch live discovered project devices/cables from the local environment */
  async fetchDiscoveredProjectData() {
    // 1. Try window.parent.OS if embedded
    if (typeof window !== 'undefined' && window.parent?.OS?.discovered) {
      return window.parent.OS.discovered;
    }
    // 2. Try static discovered snapshot
    try {
      const res = await fetch('/FrontEnd/Gui_Frames/0_discovered/0_All_Discovered/all_discovered/all_discovered.json');
      if (res.ok) {
        const json = await res.json();
        return json?.all_discovered?.blocks?.Devices?.data || [];
      }
    } catch {}
    return [];
  }
}
