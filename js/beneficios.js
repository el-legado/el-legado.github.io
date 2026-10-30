// Buscador de beneficios por RUT y generación de QR de 5 minutos.
// La URL del Apps Script está en js/config.js.

const form = document.getElementById('rutForm');
const input = document.getElementById('rut');
const btn = document.getElementById('rutBtn');
const help = document.getElementById('rutHelp');
const result = document.getElementById('result');
const qrDialog = document.getElementById('qrDialog');

let rutActual = '';
let beneficioActual = null;
let cuentaRegresiva = null;

// ---------- RUT chileno ----------
const limpiarRut = v => v.replace(/[^0-9kK]/g, '').toUpperCase();

const calcularDv = cuerpo => {
  let suma = 0, mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
};

const rutValido = rut => /^\d{7,8}[0-9K]$/.test(rut) && calcularDv(rut.slice(0, -1)) === rut.slice(-1);

const formatearRut = rut => {
  if (rut.length < 2) return rut;
  return `${rut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rut.slice(-1)}`;
};

// Formato automático mientras se escribe: 12.345.678-9
input.addEventListener('input', () => {
  input.value = formatearRut(limpiarRut(input.value).slice(0, 9));
  input.removeAttribute('aria-invalid');
  help.textContent = '';
  help.classList.remove('error');
});

// ---------- Interfaz ----------
const setCargando = on => {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
  btn.querySelector('.label').textContent = on ? 'Buscando…' : 'Buscar';
};

const mostrarError = msg => {
  help.textContent = msg;
  help.classList.add('error');
};

const mostrarBeneficios = d => {
  const lista = d.beneficios.map(b => `
    <li>
      <button type="button" class="benefit" data-id="${escaparHtml(b.id)}">
        <span class="benefit-amount${String(b.descuento).length > 5 ? ' long' : ''}">${escaparHtml(b.descuento)}</span>
        <span class="benefit-text">${b.detalle ? escaparHtml(b.detalle) : 'Beneficio El Legado'}</span>
        <span class="benefit-cta">
          <span class="spinner" aria-hidden="true"></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>
          <span class="label">Usar</span>
        </span>
      </button>
    </li>`).join('');

  const total = d.beneficios.length;
  result.innerHTML = `
    <div class="benefits-head">
      <p class="hello">${d.nombre ? `¡Hola, ${escaparHtml(d.nombre)}!` : '¡Hola!'}</p>
      <h3>Tienes ${total} ${total === 1 ? 'beneficio disponible' : 'beneficios disponibles'}</h3>
      <p>Elige uno para generar tu código QR. Es válido por 5 minutos: muéstralo al mesero al pagar.</p>
    </div>
    <ul class="benefits">${lista}</ul>`;
  result.hidden = false;
};

const mostrarSinBeneficio = () => {
  result.innerHTML = `
    <div class="result-empty">
      <h3>No encontramos beneficios</h3>
      <p>Este RUT no tiene descuentos asociados por ahora. Síguenos en <a href="https://www.instagram.com/el.legadorest/" target="_blank" rel="noopener">@el.legadorest</a> para enterarte de nuevas promociones.</p>
    </div>`;
  result.hidden = false;
};

// ---------- Búsqueda ----------
form.addEventListener('submit', async e => {
  e.preventDefault();
  result.hidden = true;
  const rut = limpiarRut(input.value);

  if (!rut) { input.setAttribute('aria-invalid', 'true'); return mostrarError('Introduce tu RUT para continuar.'); }
  if (!rutValido(rut)) { input.setAttribute('aria-invalid', 'true'); return mostrarError('El RUT no es válido. Revisa los números y el dígito verificador.'); }
  if (!BENEFICIOS_API) return mostrarError('El buscador aún no está conectado a la planilla de beneficios.');

  help.textContent = '';
  help.classList.remove('error');
  setCargando(true);
  try {
    const data = await consultarApi({ accion: 'buscar', rut });
    rutActual = rut;
    data.encontrado ? mostrarBeneficios(data) : mostrarSinBeneficio();
  } catch (err) {
    mostrarError('No pudimos consultar tus beneficios. Inténtalo de nuevo en unos minutos.');
  } finally {
    setCargando(false);
  }
});

// ---------- QR de 5 minutos ----------
result.addEventListener('click', e => {
  const boton = e.target.closest('.benefit');
  if (boton) generarQr({
    id: boton.dataset.id,
    descuento: boton.querySelector('.benefit-amount').textContent,
    detalle: boton.querySelector('.benefit-text').textContent
  }, boton);
});

async function generarQr(beneficio, boton) {
  if (boton.classList.contains('loading')) return;
  boton.classList.add('loading');
  const label = boton.querySelector('.label');
  const textoOriginal = label.textContent;
  label.textContent = 'Generando…';
  try {
    const data = await consultarApi({ accion: 'generar', rut: rutActual, id: beneficio.id });
    beneficioActual = beneficio;
    abrirQr(data);
  } catch (err) {
    mostrarError('No pudimos generar el código. Inténtalo de nuevo.');
  } finally {
    boton.classList.remove('loading');
    label.textContent = textoOriginal;
  }
}

function abrirQr({ token, segundos }) {
  // El QR abre la página del mesero con el código; solo el Apps Script sabe si es real
  const url = new URL(`validar.html?t=${token}`, location.href).href;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();

  qrDialog.querySelector('.qr-amount').textContent = beneficioActual.descuento;
  qrDialog.querySelector('.qr-amount').classList.toggle('long', beneficioActual.descuento.length > 5);
  qrDialog.querySelector('.qr-detail').textContent = beneficioActual.detalle;
  qrDialog.querySelector('.qr-code').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  qrDialog.classList.remove('expired');
  if (!qrDialog.open) qrDialog.showModal();

  const fin = Date.now() + segundos * 1000;
  const reloj = qrDialog.querySelector('.qr-time');
  const barra = qrDialog.querySelector('.qr-bar span');
  clearInterval(cuentaRegresiva);
  const tick = () => {
    const resto = Math.max(0, Math.round((fin - Date.now()) / 1000));
    reloj.textContent = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, '0')}`;
    barra.style.transform = `scaleX(${resto / segundos})`;
    if (resto === 0) {
      clearInterval(cuentaRegresiva);
      qrDialog.classList.add('expired');
    }
  };
  tick();
  cuentaRegresiva = setInterval(tick, 1000);
}

qrDialog.querySelector('.qr-close').addEventListener('click', () => qrDialog.close());
qrDialog.addEventListener('close', () => clearInterval(cuentaRegresiva));
qrDialog.addEventListener('click', e => { if (e.target === qrDialog) qrDialog.close(); });

// "Generar uno nuevo" cuando el código expira
const renovar = qrDialog.querySelector('.qr-renew');
renovar.addEventListener('click', () => { if (beneficioActual) generarQr(beneficioActual, renovar); });
