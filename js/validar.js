// Página de meseros: escanea el QR del cliente y pregunta al Apps Script si el código es real y vigente.

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const scanView = document.getElementById('scanView');
const scanFrame = document.getElementById('scanFrame');
const scanBtn = document.getElementById('scanBtn');
const scanMsg = document.getElementById('scanMsg');
const verdict = document.getElementById('verdict');
const accessView = document.getElementById('accessView');
const accessForm = document.getElementById('accessForm');
const accessInput = document.getElementById('accessKey');
const accessMsg = document.getElementById('accessMsg');

let stream = null;
let cuenta = null;
let ultimoToken = '';

// ---------- Clave de meseros ----------
// Se carga una vez desde el link #k=CLAVE y queda guardada en este celular
const CLAVE_LS = 'el_legado_clave_meseros';
const leerClave = () => { try { return localStorage.getItem(CLAVE_LS) || ''; } catch (e) { return ''; } };
const guardarClave = c => { try { localStorage.setItem(CLAVE_LS, c); } catch (e) { /* modo privado */ } };
const borrarClave = () => { try { localStorage.removeItem(CLAVE_LS); } catch (e) { /* modo privado */ } };

function pedirClave(mensaje = '') {
  detenerCamara();
  scanView.hidden = true;
  verdict.hidden = true;
  accessView.hidden = false;
  accessMsg.textContent = mensaje;
  accessInput.value = '';
}

accessForm.addEventListener('submit', e => {
  e.preventDefault();
  const c = accessInput.value.trim();
  if (!c) return;
  guardarClave(c);
  accessView.hidden = true;
  ultimoToken ? validar(ultimoToken) : mostrarEscaner();
});

function mostrarEscaner() {
  accessView.hidden = true;
  verdict.hidden = true;
  scanView.hidden = false;
}

// ---------- Cámara ----------
async function iniciarEscaneo() {
  verdict.hidden = true;
  scanView.hidden = false;
  scanMsg.textContent = '';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (err) {
    scanMsg.textContent = 'No pudimos abrir la cámara. Revisa los permisos del navegador para este sitio.';
    return;
  }
  video.srcObject = stream;
  await video.play();
  scanFrame.classList.add('live');
  scanBtn.hidden = true;
  requestAnimationFrame(leerCuadro);
}

function detenerCamara() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  scanFrame.classList.remove('live');
  scanBtn.hidden = false;
}

function leerCuadro() {
  if (!stream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      const token = extraerToken(code.data);
      if (token) {
        if (navigator.vibrate) navigator.vibrate(80);
        detenerCamara();
        return validar(token);
      }
    }
  }
  requestAnimationFrame(leerCuadro);
}

// El QR trae la URL de esta página con ?t=CODIGO (o solo el código)
function extraerToken(texto) {
  try {
    const t = new URL(texto, location.href).searchParams.get('t');
    if (t) return t;
  } catch (e) { /* no es URL */ }
  return /^[0-9a-f]{32}$/i.test(texto.trim()) ? texto.trim() : '';
}

// ---------- Validación ----------
async function validar(token) {
  ultimoToken = token;
  accessView.hidden = true;
  scanView.hidden = true;
  verdict.hidden = false;
  verdict.className = 'verdict checking';
  verdict.innerHTML = '<div class="verdict-icon"><span class="spinner"></span></div><h2>Verificando…</h2>';
  clearInterval(cuenta);
  if (!/^[0-9a-f]{32}$/i.test(token)) return mostrarInvalido();
  if (!leerClave()) return pedirClave();

  try {
    const d = await consultarApi({ accion: 'validar', t: token, clave: leerClave() });
    d.valido ? mostrarValido(d) : mostrarInvalido();
  } catch (err) {
    if (err.message === 'no_autorizado') { borrarClave(); return pedirClave('Clave incorrecta. Pide el link actualizado al encargado.'); }
    if (err.message === 'demasiadas_consultas') err.message = 'Demasiados intentos. Espera un minuto.';
    verdict.className = 'verdict error';
    verdict.innerHTML = `
      <div class="verdict-icon">!</div>
      <h2>No se pudo verificar</h2>
      <p class="verdict-sub">${err.message === 'sin_configurar' ? 'La página aún no está conectada a la planilla.' : err.message.startsWith('Demasiados') ? err.message : 'Revisa la conexión a internet e inténtalo otra vez.'}</p>
      ${botonOtro('Reintentar', 'reintentar')}`;
  }
}

function mostrarValido(d) {
  const aviso = d.escaneosPrevios > 0
    ? `<p class="verdict-warn">Atención: este código ya se escaneó ${d.escaneosPrevios} ${d.escaneosPrevios === 1 ? 'vez' : 'veces'}${d.primerEscaneo ? `, la primera a las ${escaparHtml(d.primerEscaneo)}` : ''}. Confirma que el descuento no se haya aplicado antes.</p>`
    : '';
  verdict.className = 'verdict ok';
  verdict.innerHTML = `
    <div class="verdict-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
    <h2>Descuento válido</h2>
    <p class="verdict-amount">${escaparHtml(d.descuento)}</p>
    ${d.detalle ? `<p class="verdict-sub">${escaparHtml(d.detalle)}</p>` : ''}
    <dl class="verdict-data">
      ${d.nombre || d.apellido ? `<div><dt>Cliente</dt><dd>${escaparHtml([d.nombre, d.apellido].filter(Boolean).join(' '))}</dd></div>` : ''}
      <div><dt>RUT</dt><dd>${escaparHtml(d.rut)}</dd></div>
      <div><dt>Vence en</dt><dd class="verdict-time">--:--</dd></div>
    </dl>
    ${aviso}
    ${botonOtro('Escanear otro')}`;

  const fin = Date.now() + d.segundosRestantes * 1000;
  const reloj = verdict.querySelector('.verdict-time');
  const tick = () => {
    const resto = Math.max(0, Math.round((fin - Date.now()) / 1000));
    reloj.textContent = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, '0')}`;
    if (resto === 0) { clearInterval(cuenta); reloj.textContent = 'Expirado'; }
  };
  tick();
  cuenta = setInterval(tick, 1000);
}

function mostrarInvalido() {
  verdict.className = 'verdict bad';
  verdict.innerHTML = `
    <div class="verdict-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg></div>
    <h2>Código no válido</h2>
    <p class="verdict-sub">El código expiró, ya no existe o no fue emitido por El Legado. Pide al cliente que genere uno nuevo desde la web.</p>
    ${botonOtro('Escanear otro')}`;
}

const botonOtro = (texto, accion = 'escanear') =>
  `<button type="button" class="btn btn-solid staff-btn" data-accion="${accion}"><span class="label">${texto}</span></button>`;

verdict.addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  b.dataset.accion === 'reintentar' ? validar(ultimoToken) : iniciarEscaneo();
});
scanBtn.addEventListener('click', iniciarEscaneo);

// Link de meseros con la clave: validar.html#k=CLAVE
const claveUrl = new URLSearchParams(location.hash.slice(1)).get('k');
if (claveUrl) guardarClave(claveUrl);

// Por si el link con la clave se abre estando ya en esta página
addEventListener('hashchange', () => {
  const k = new URLSearchParams(location.hash.slice(1)).get('k');
  if (!k) return;
  guardarClave(k);
  history.replaceState(null, '', location.pathname);
  mostrarEscaner();
});

const tokenUrl = new URLSearchParams(location.search).get('t');
// No dejar el código ni la clave en la barra de direcciones ni en el historial
if (claveUrl || tokenUrl) history.replaceState(null, '', location.pathname);

if (tokenUrl && !leerClave()) {
  // Lo abrió alguien sin clave (normalmente el cliente escaneando su propio QR): no se valida ni se cuenta
  scanView.hidden = true;
  verdict.hidden = false;
  verdict.className = 'verdict info';
  verdict.innerHTML = `
    <div class="verdict-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 18h2v2h-2z"/></svg></div>
    <h2>Muestra este código al mesero</h2>
    <p class="verdict-sub">El descuento se valida al escanearlo el personal de El Legado.</p>`;
} else if (tokenUrl) {
  validar(tokenUrl);
} else if (!leerClave()) {
  pedirClave();
}
