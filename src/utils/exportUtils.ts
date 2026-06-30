const LIGHT = {
  background: '#ffffff',
  ring: '#d1d5db',
  innerRing: '#ddd6fe',
  segment: '#f3f4f6',
  divider: '#d1d5db',
  tick: '#9ca3af',
  label: '#374151',
};

const DARK = {
  background: '#111827',
  ring: '#2d3748',
  innerRing: '#3b2d60',
  segment: '#141620',
  divider: '#2a3347',
  tick: '#4b5563',
  label: '#e2e8f0',
};

type Palette = typeof LIGHT;

function resolveVars(el: Element, p: Palette) {
  const map: Record<string, string> = {
    'var(--chart-ring)': p.ring,
    'var(--chart-inner-ring)': p.innerRing,
    'var(--chart-segment)': p.segment,
    'var(--chart-divider)': p.divider,
    'var(--chart-tick)': p.tick,
    'var(--chart-label)': p.label,
  };
  for (const attr of Array.from(el.attributes)) {
    let val = attr.value;
    for (const [k, v] of Object.entries(map)) {
      if (val.includes(k)) val = val.split(k).join(v);
    }
    attr.value = val;
  }
  for (const child of Array.from(el.children)) resolveVars(child, p);
}

export async function exportChartAsImage(
  svgEl: SVGSVGElement,
  scheduleName: string,
  isDark: boolean,
): Promise<void> {
  const p = isDark ? DARK : LIGHT;
  const ns = 'http://www.w3.org/2000/svg';

  const chartW = parseFloat(svgEl.getAttribute('width') ?? '600');
  const chartH = parseFloat(svgEl.getAttribute('height') ?? '600');
  const titleH = 56;
  const plugH = 40;
  const totalW = chartW;
  const totalH = chartH + titleH + plugH;

  const wrap = document.createElementNS(ns, 'svg');
  wrap.setAttribute('xmlns', ns);
  wrap.setAttribute('width', String(totalW));
  wrap.setAttribute('height', String(totalH));

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', String(totalW));
  bg.setAttribute('height', String(totalH));
  bg.setAttribute('fill', p.background);
  wrap.appendChild(bg);

  const title = document.createElementNS(ns, 'text');
  title.setAttribute('x', String(totalW / 2));
  title.setAttribute('y', String(titleH / 2 + 4));
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('dominant-baseline', 'middle');
  title.setAttribute('fill', p.label);
  title.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
  title.setAttribute('font-size', '20');
  title.setAttribute('font-weight', '700');
  title.textContent = scheduleName || 'My Schedule';
  wrap.appendChild(title);

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  resolveVars(clone, p);

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('transform', `translate(0,${titleH})`);
  while (clone.firstChild) g.appendChild(clone.firstChild);
  wrap.appendChild(g);

  const plug = document.createElementNS(ns, 'text');
  plug.setAttribute('x', String(totalW / 2));
  plug.setAttribute('y', String(totalH - plugH / 2 + 2));
  plug.setAttribute('text-anchor', 'middle');
  plug.setAttribute('dominant-baseline', 'middle');
  plug.setAttribute('fill', p.tick);
  plug.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
  plug.setAttribute('font-size', '13');
  plug.setAttribute('opacity', '0.6');
  plug.textContent = 'daychart.fyi';
  wrap.appendChild(plug);

  const svgStr = new XMLSerializer().serializeToString(wrap);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = totalW * scale;
      canvas.height = totalH * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) { reject(new Error('PNG export failed')); return; }
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${(scheduleName || 'schedule').replace(/\s+/g, '-').toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(pngUrl), 100);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG load failed')); };
    img.src = svgUrl;
  });
}
