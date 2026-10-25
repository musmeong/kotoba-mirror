globalThis.KotobaScroll = (() => {
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const widgets = '.CodeMirror,.cm-editor,.monaco-editor,.ace_editor,[data-km-code-widget]';
  function geometry(doc, target) {
    const root = !target || target === doc || target === doc.documentElement || target === doc.body;
    const el = root ? doc.scrollingElement : target;
    return { root, el, rect: root ? { left:0, top:0, right:doc.defaultView.innerWidth, bottom:doc.defaultView.innerHeight } : el.getBoundingClientRect(),
      width:root ? doc.defaultView.innerWidth : el.clientWidth, height:root ? doc.defaultView.innerHeight : el.clientHeight };
  }
  function capture(doc, target, identify) {
    const { root, el, rect, width, height } = geometry(doc, target);
    const view = doc.defaultView;
    const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    const right = Math.min(view.innerWidth, rect.right), bottom = Math.min(view.innerHeight, rect.bottom);
    let anchor, point;
    if (right > left && bottom > top) {
      const x = left + (right-left)*.4;
      const y = top + Math.min(64, (bottom-top)*.15);
      const hit = doc.elementFromPoint(x, y);
      if (hit && el.contains(hit)) {
        anchor = hit.closest(widgets) || hit.closest('img,svg,p,li,pre,figure,table') || hit.closest('[data-km-id]') || hit;
        if (!el.contains(anchor) || anchor === el) anchor = undefined;
        point = y;
      }
    }
    const box = anchor?.getBoundingClientRect();
    return { time:Date.now(), id:root ? null : identify(el), x:el.scrollLeft/Math.max(1,el.scrollWidth-width), y:el.scrollTop/Math.max(1,el.scrollHeight-height),
      anchor:anchor ? identify(anchor) : null, offset:box ? (box.top-rect.top)/Math.max(1,height) : 0,
      point:box ? (point-rect.top)/Math.max(1,height) : undefined,
      progress:box?.height ? clamp((point-box.top)/box.height,0,1) : 0 };
  }
  function apply(doc, target, state, find) {
    const { el, rect, width, height } = geometry(doc, target);
    if (!el || !Number.isFinite(state.y) || !Number.isFinite(state.x)) return;
    const anchor = find(state.anchor), box = anchor?.getBoundingClientRect();
    let y = state.y*(el.scrollHeight-height);
    if (box?.height && el.contains(anchor) && anchor !== el) {
      y = el.scrollTop+box.top-rect.top;
      y += Number.isFinite(state.point) && Number.isFinite(state.progress) ? state.progress*box.height-state.point*height : -state.offset*height;
    }
    el.scrollTo({top:Math.max(0,y),left:Math.max(0,state.x*(el.scrollWidth-width)),behavior:'instant'});
    return { until:performance.now()+160, top:el.scrollTop, left:el.scrollLeft };
  }
  function wasApplied(target, record) {
    return record && performance.now()<record.until && Math.abs(target.scrollTop-record.top)<1 && Math.abs(target.scrollLeft-record.left)<1;
  }
  return { capture, apply, wasApplied };
})();
