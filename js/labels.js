// Part of APK.audio - Cable & Panel Label Wizard
// Ported from OneThing gui-shell/labels and 190_panels

export function generateCableLabel(cable) {
  return {
    wireNumber: cable.wireNumber || 'W-0001',
    line1: `${cable.srcDevice || 'SRC'}:${cable.srcPort || 'OUT'}`,
    line2: `${cable.dstDevice || 'DST'}:${cable.dstPort || 'IN'}`,
    signalType: cable.signalType || 'ANALOG'
  };
}

export function formatAverySheetHtml(labels = []) {
  const cards = labels.map(l => `
    <div style="width:200px; height:80px; border:1px dashed #94a3b8; border-radius:4px; padding:6px; font-family:monospace; font-size:10px; display:flex; flex-direction:column; justify-content:space-between; background:#fff; color:#000;">
      <div style="font-weight:700; font-size:12px; color:#0284c7;">${l.wireNumber}</div>
      <div>FROM: ${l.line1}</div>
      <div>TO:   ${l.line2}</div>
      <div style="font-size:8px; color:#64748b;">[${l.signalType}]</div>
    </div>
  `).join('');

  return `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; padding:20px;">${cards}</div>`;
}
