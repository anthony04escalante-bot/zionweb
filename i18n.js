/* Botón Español / English. Español es el idioma original de la página; el inglés se aplica
   reemplazando textos con el diccionario window.I18N_EN (archivo i18n-en.js).
   - Claves: texto en español normalizado (espacios simples). Si la clave empieza con "<" es el
     HTML interno de un párrafo con negritas o enlaces, y se reemplaza completo.
   - window.I18N_EN_RULES: [[regex, reemplazo], ...] para textos que llevan números.
   - Los elementos con translate="no" o class "notranslate" no se tocan.
   - La elección se guarda en el navegador; ?lang=en o ?lang=es en la dirección la fuerza. */
(function () {
  var D = window.I18N_EN || {}, R = (window.I18N_EN_RULES || []).map(function (r) { return [new RegExp('^' + r[0] + '$'), r[1]]; });
  var ATTRS = ['placeholder', 'aria-label', 'alt', 'title'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, svg: 1, SVG: 1 };
  var INLINE = { B: 1, STRONG: 1, EM: 1, I: 1, A: 1, SPAN: 1, SMALL: 1, BR: 1, U: 1, MARK: 1, SUP: 1, SUB: 1 };
  var esText = new WeakMap(), enText = new WeakMap(), esHTML = new WeakMap(), enHTML = new WeakMap(), esAttr = new WeakMap();
  var lang = 'es', obs = null, busy = false;
  try { lang = localStorage.getItem('idioma') === 'en' ? 'en' : 'es'; } catch (e) {}
  var q = /[?&]lang=(en|es)\b/.exec(location.search); if (q) lang = q[1];

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function tr(s) {
    var k = norm(s); if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(D, k)) return D[k];
    for (var i = 0; i < R.length; i++) { if (R[i][0].test(k)) return k.replace(R[i][0], R[i][1]); }
    // Textos compuestos: «A · B · C» o «Etiqueta: valor» se traducen por partes.
    var sep = k.indexOf(' · ') > -1 ? ' · ' : (/^·\s/.test(k) ? null : (k.indexOf(': ') > 0 ? ': ' : null));
    if (/^·\s/.test(k)) { var r0 = tr(k.slice(2)); return r0 == null ? null : '· ' + r0; }
    if (!sep) return null;
    var parts = sep === ': ' ? [k.slice(0, k.indexOf(': ')), k.slice(k.indexOf(': ') + 2)] : k.split(sep), hit = false;
    for (var p = 0; p < parts.length; p++) { var tp = parts[p] ? tr(parts[p]) : null; if (tp != null) { parts[p] = tp; hit = true; } }
    return hit ? parts.join(sep) : null;
  }
  function skipped(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if (SKIP[el.nodeName] || el.getAttribute('translate') === 'no' || (el.classList && el.classList.contains('notranslate'))) return true;
    }
    return false;
  }
  // Un párrafo con negritas/enlaces se traduce entero, siempre que adentro no haya nada con id ni controles.
  function richKey(el) {
    if (!el.firstElementChild || !el.textContent.trim()) return null;
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) { if (!INLINE[all[i].nodeName] || all[i].id) return null; }
    return '<' + norm(el.innerHTML);
  }
  function doEl(el) {
    if (skipped(el)) return true;
    for (var a = 0; a < ATTRS.length; a++) doAttr(el, ATTRS[a]);
    if (el.nodeName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) doAttr(el, 'value');
    if (lang === 'en') {
      var src = esHTML.has(el) && el.innerHTML === enHTML.get(el) ? esHTML.get(el) : null;
      var key = src ? '<' + norm(src) : richKey(el);
      if (key && Object.prototype.hasOwnProperty.call(D, key)) {
        if (!src) esHTML.set(el, el.innerHTML);
        el.innerHTML = D[key]; enHTML.set(el, el.innerHTML); return true;
      }
    } else if (esHTML.has(el)) {
      if (el.innerHTML === enHTML.get(el)) el.innerHTML = esHTML.get(el);
      esHTML.delete(el); return true;
    }
    return false;
  }
  function doAttr(el, name) {
    if (!el.hasAttribute(name)) return;
    var m = esAttr.get(el); if (!m) { m = {}; esAttr.set(el, m); }
    var cur = el.getAttribute(name);
    if (!(name in m) || (cur !== m[name] && cur !== m[name + '_en'])) m[name] = cur;
    var en = lang === 'en' ? tr(m[name]) : null;
    var want = en != null ? en : m[name]; m[name + '_en'] = en;
    if (cur !== want) el.setAttribute(name, want);
  }
  function doText(n) {
    var cur = n.nodeValue;
    if (!esText.has(n) || cur !== enText.get(n)) esText.set(n, cur);
    var es = esText.get(n);
    if (lang === 'en') {
      var en = tr(es); if (en == null) return;
      var m = /^(\s*)[\s\S]*?(\s*)$/.exec(es), out = m[1] + en + m[2];
      enText.set(n, out); if (cur !== out) n.nodeValue = out;
    } else if (cur !== es) { n.nodeValue = es; }
  }
  function walk(root) {
    if (root.nodeType === 3) { if (!skipped(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    if (doEl(root)) return;
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function apply() {
    busy = true;
    document.documentElement.lang = lang === 'en' ? 'en' : 'es';
    walk(document.body);
    if (!esText.has(document)) esText.set(document, document.title);
    var t = lang === 'en' ? tr(esText.get(document)) : null;
    document.title = t != null ? t : esText.get(document);
    var bs = document.querySelectorAll('.idioma [data-l]');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-l') === lang);
    var bt = document.querySelectorAll('.idioma');
    for (var j = 0; j < bt.length; j++) bt[j].setAttribute('aria-label', lang === 'en' ? 'Cambiar a español' : 'Switch to English');
    if (obs) obs.takeRecords();
    busy = false;
  }
  function set(l) {
    lang = l; try { localStorage.setItem('idioma', l); } catch (e) {}
    apply();
    try { document.dispatchEvent(new CustomEvent('idioma', { detail: l })); } catch (e) {}
  }
  function boton() {
    var slots = document.querySelectorAll('[data-idioma]');
    for (var i = 0; i < slots.length; i++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'idioma'; b.setAttribute('translate', 'no');
      b.innerHTML = '<span data-l="es">ES</span><span data-l="en">EN</span>';
      b.addEventListener('click', function () { set(lang === 'en' ? 'es' : 'en'); });
      slots[i].appendChild(b);
    }
  }
  function init() {
    boton(); apply();
    obs = new MutationObserver(function (list) {
      if (busy || lang !== 'en') return;
      busy = true;
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'characterData') { if (!skipped(m.target.parentNode)) doText(m.target); }
        else if (m.type === 'attributes') { if (!skipped(m.target)) doAttr(m.target, m.attributeName); }
        else for (var k = 0; k < m.addedNodes.length; k++) walk(m.addedNodes[k]);
      }
      obs.takeRecords(); busy = false;
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  window.idioma = { get: function () { return lang; }, set: set, t: function (s) { return lang === 'en' ? (tr(s) || s) : s; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
