// URL de la aplicación web de Google Apps Script (ver apps-script/INSTRUCCIONES.md).
// Pega aquí la URL que termina en /exec. La usan descuentos.html y validar.html.
const BENEFICIOS_API = 'https://script.google.com/macros/s/AKfycbxzgsUHf1o9yzdJlU6hBjgSEp2qqucyv4xDk2xwIPgsoSjn7fku5vvDvN7D0_eQxKI4sw/exec';

// Consulta al Apps Script con un tiempo máximo de espera
async function consultarApi(params, msMax = 15000) {
  if (!BENEFICIOS_API) throw new Error('sin_configurar');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), msMax);
  try {
    const res = await fetch(`${BENEFICIOS_API}?${new URLSearchParams(params)}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'error');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const escaparHtml = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
