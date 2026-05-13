/**
 * Camaçari na Mão — Painel de Monitoramento Territorial
 * script.js v6.0 — Layout 3 Colunas + Painel Inferior + Fullscreen
 */

// =============================================================
// 1. PALETA DE CORES POR TIPO DE DENÚNCIA
// =============================================================
const CORES_TIPO = {
  "Obra irregular":              "#e74c3c",
  "Poluição sonora":             "#f39c12",
  "Terreno abandonado":          "#8e44ad",
  "Descarte irregular de lixo":  "#16a085",
  "Ocupação irregular":          "#2980b9",
};

const COR_PADRAO = "#7f8c8d";

// =============================================================
// 2. VARIÁVEIS GLOBAIS
// =============================================================
let mapa;
let clusterGroup;
let heatLayer;
let todosDados          = [];
let filtroTipoAtivo     = "";
let filtroStatusAtivo   = "";
let painelInferiorAberto = false;
let isFullScreen        = false;   // controla o modo de exibição dos cliques

// =============================================================
// 3. INICIALIZAÇÃO DO MAPA
// =============================================================
function inicializarMapa() {
  const CAMACARI_LAT = -12.6985;
  const CAMACARI_LNG = -38.3239;
  const mapboxToken = 'pk.eyJ1Ijoic2FudHp6ZnIiLCJhIjoiY21wNGI2YWVmMG5jOTJyb2FodXl5NDRjMCJ9.bRCptuAHqCWV79PPnkGUBw';

  mapa = L.map('map').setView([CAMACARI_LAT, CAMACARI_LNG], 13);

  L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
    {
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1
    }
  ).addTo(mapa);

  clusterGroup = L.markerClusterGroup({
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div style="
          background: linear-gradient(135deg, #1a5c2a, #2e7d46);
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">${count}</div>`,
        className: 'cluster-custom',
        iconSize: [38, 38]
      });
    }
  });

  mapa.addLayer(clusterGroup);

  heatLayer = L.heatLayer([], {
    radius: 30, blur: 22, maxZoom: 17,
    gradient: { 0.2: '#3498db', 0.4: '#2ecc71', 0.6: '#f1c40f', 0.8: '#e67e22', 1.0: '#e74c3c' }
  });

  // Clicar no fundo do mapa não fecha mais o painel (ele é sempre visível)
  mapa.on('click', function() {
    // reservado para uso futuro
  });
}

// =============================================================
// 4. SPLASH SCREEN
// =============================================================
function atualizarProgressoSplash(porcentagem, passoId) {
  const bar     = document.getElementById('splash-bar');
  const pctText = document.getElementById('splash-pct');

  if (bar)     bar.style.width = porcentagem + '%';
  if (pctText) pctText.textContent = porcentagem + '%';

  if (passoId) {
    document.querySelectorAll('.splash-step').forEach(el => el.classList.remove('active'));
    const step = document.getElementById(passoId);
    if (step) step.classList.add('active');
  }
}

function finalizarSplash() {
  const splash = document.getElementById('splash-screen');
  const app    = document.getElementById('app');

  setTimeout(() => {
    if (splash) splash.style.opacity = '0';
    if (app)    app.classList.remove('app-hidden');

    setTimeout(() => {
      if (splash) splash.style.display = 'none';
      if (mapa)   mapa.invalidateSize();
    }, 500);
  }, 600);
}

// =============================================================
// 5. ÍCONE DE MARCADOR
// =============================================================
function criarIcone(cor) {
  return L.divIcon({
    className: 'marcador-custom',
    html: `<div style="background:${cor}; width:16px; height:16px; border-radius:50%; border:2.5px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize:   [16, 16],
    iconAnchor: [8, 8],
    popupAnchor:[0, -10]
  });
}

// =============================================================
// 6. FILTRAGEM
// =============================================================
function getDadosFiltrados() {
  return todosDados.filter(d => {
    const passaTipo   = filtroTipoAtivo   === "" || d.tipo   === filtroTipoAtivo;
    const passaStatus = filtroStatusAtivo === "" || d.status === filtroStatusAtivo;
    return passaTipo && passaStatus;
  });
}

// =============================================================
// 7. PAINEL INFERIOR — PROXIMIDADE
// =============================================================

/**
 * Encontra as N ocorrências mais próximas de um item,
 * usando L.LatLng.distanceTo() (resultado em metros).
 */
function encontrarMaisProximas(item, todos, n = 2) {
  const origem = L.latLng(item.latitude, item.longitude);
  return todos
    .filter(d => d !== item)
    .map(d => ({
      ...d,
      _distanciaM: origem.distanceTo(L.latLng(d.latitude, d.longitude))
    }))
    .sort((a, b) => a._distanciaM - b._distanciaM)
    .slice(0, n);
}

/** Formata metros em "120 m" ou "1,4 km" */
function formatarDistancia(metros) {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Gera o bloco de campos internos de um card */
function renderCardContent(item) {
  const cor          = CORES_TIPO[item.tipo] || COR_PADRAO;
  const statusClasse = { "Aberta": "status-aberta", "Em análise": "status-analise", "Encerrada": "status-encerrada" }[item.status] || "status-aberta";

  return `
    <span class="pi-tipo-pill" style="background:${cor}">${item.tipo}</span>
    <div class="pi-field">
      <span class="pi-field-key">Bairro</span>
      <span class="pi-field-val">${item.bairro}</span>
    </div>
    <div class="pi-field">
      <span class="pi-field-key">Data</span>
      <span class="pi-field-val">${formatarData(item.data)}</span>
    </div>
    <div class="pi-field" style="align-items:flex-start; white-space:normal;">
      <span class="pi-field-key" style="padding-top:1px">Ocorr.</span>
      <span class="pi-field-val" style="white-space:normal; overflow:visible; text-overflow:unset; font-size:10px; color:var(--text-2); line-height:1.4">${item.descricao}</span>
    </div>
    <div style="margin-top:2px">
      <span class="popup-status-badge ${statusClasse}">${item.status}</span>
    </div>`;
}

function mostrarEmptyState() {
  const emptyState   = document.getElementById('pi-empty-state');
  const cardsWrapper = document.getElementById('pi-cards-container');
  if (emptyState)   emptyState.style.display   = '';
  if (cardsWrapper) cardsWrapper.style.display  = 'none';
  painelInferiorAberto = false;
}

function abrirPainelInferior(item) {
  const emptyState   = document.getElementById('pi-empty-state');
  const cardsWrapper = document.getElementById('pi-cards-container');
  if (!cardsWrapper) return;

  // Preencher card 0 — ocorrência principal
  document.getElementById('pi-card-0-content').innerHTML = renderCardContent(item);
  document.getElementById('pi-card-1-dist').textContent  = '—';
  document.getElementById('pi-card-2-dist').textContent  = '—';
  document.getElementById('pi-card-1-content').innerHTML = '<span style="font-size:11px;color:var(--text-3)">Calculando...</span>';
  document.getElementById('pi-card-2-content').innerHTML = '<span style="font-size:11px;color:var(--text-3)">Calculando...</span>';

  // Trocar empty state pelos cards (sem animação de abrir/fechar painel)
  if (emptyState)   emptyState.style.display   = 'none';
  if (cardsWrapper) cardsWrapper.style.display  = 'grid';
  painelInferiorAberto = true;

  // Calcular as 2 mais próximas
  const proximas = encontrarMaisProximas(item, todosDados, 2);

  proximas.forEach((prox, idx) => {
    const cardIdx = idx + 1;
    document.getElementById(`pi-card-${cardIdx}-dist`).textContent    = formatarDistancia(prox._distanciaM);
    document.getElementById(`pi-card-${cardIdx}-content`).innerHTML   = renderCardContent(prox);
  });

  // Se não houver ocorrências suficientes
  for (let i = proximas.length; i < 2; i++) {
    const cardIdx = i + 1;
    document.getElementById(`pi-card-${cardIdx}-dist`).textContent  = '—';
    document.getElementById(`pi-card-${cardIdx}-content`).innerHTML = '<span style="font-size:11px;color:var(--text-3);font-style:italic">Sem dados suficientes</span>';
  }
}

function fecharPainelInferior() {
  mostrarEmptyState();
}

function configurarBotaoFecharPainel() {
  const btn = document.getElementById('btn-fechar-painel');
  if (btn) btn.addEventListener('click', mostrarEmptyState);
}

// =============================================================
// 8. MARCADORES
// =============================================================
function plotarMarcadores(dados) {
  clusterGroup.clearLayers();

  dados.forEach(item => {
    const cor = CORES_TIPO[item.tipo] || COR_PADRAO;
    const statusClasse = {
      "Aberta":     "status-aberta",
      "Em análise": "status-analise",
      "Encerrada":  "status-encerrada"
    }[item.status] || "status-aberta";

    const marcador = L.marker([item.latitude, item.longitude], { icon: criarIcone(cor) });

    // Evento de clique: comportamento muda conforme o modo ativo
    marcador.on('click', function(e) {
      L.DomEvent.stopPropagation(e);

      if (isFullScreen) {
        // ── MODO TELA CHEIA: abre popup minimalista sobre o pino ──
        L.popup({ className: 'popup-fs', closeButton: true, autoClose: true, offset: [0, -10], maxWidth: 240 })
          .setLatLng([item.latitude, item.longitude])
          .setContent(`
            <div class="popup-fs-content">
              <span class="popup-fs-dot" style="background:${cor}"></span>
              <div class="popup-fs-info">
                <div class="popup-fs-tipo">${item.tipo}</div>
                <div class="popup-fs-bairro">${item.bairro}</div>
                <span class="popup-fs-badge ${statusClasse}">${item.status}</span>
              </div>
            </div>`)
          .openOn(mapa);
      } else {
        // ── MODO NORMAL: preenche o painel inferior, fecha popup se aberto ──
        mapa.closePopup();
        abrirPainelInferior(item);
      }
    });

    // Tooltip leve para identificação rápida (presente em ambos os modos)
    marcador.bindTooltip(`<strong>${item.tipo}</strong><br>${item.bairro}`, {
      direction: 'top',
      offset: [0, -10]
    });

    clusterGroup.addLayer(marcador);
  });

  const contador = document.getElementById('contador-resultados');
  if (contador) contador.innerHTML = `<div class="counter-dot"></div><span>${dados.length} ocorrências</span>`;
}

// =============================================================
// 9. HEATMAP
// =============================================================
function atualizarHeatmap(dados) {
  if (heatLayer) mapa.removeLayer(heatLayer);
  const heatAtivo = document.getElementById('toggle-heat').checked;
  if (!heatAtivo) return;

  const pontos = dados.map(d => [d.latitude, d.longitude, 1]);
  heatLayer = L.heatLayer(pontos, {
    radius: 30, blur: 22, maxZoom: 17,
    gradient: { 0.2: '#3498db', 0.4: '#2ecc71', 0.6: '#f1c40f', 0.8: '#e67e22', 1.0: '#e74c3c' }
  }).addTo(mapa);
}

function configurarToggleHeatmap() {
  document.getElementById('toggle-heat').addEventListener('change', function() {
    if (this.checked) {
      mapa.removeLayer(clusterGroup);
      atualizarHeatmap(getDadosFiltrados());
    } else {
      if (heatLayer) mapa.removeLayer(heatLayer);
      mapa.addLayer(clusterGroup);
    }
  });
}

// =============================================================
// 10. FULLSCREEN
// =============================================================
function configurarFullscreen() {
  const btn          = document.getElementById('btn-fullscreen');
  const app          = document.getElementById('app');
  const painelInf    = document.getElementById('painel-inferior');
  const iconExpand   = document.getElementById('icon-expand');
  const iconCompr    = document.getElementById('icon-compress');
  const labelFS      = document.getElementById('label-fullscreen');
  if (!btn) return;

  btn.addEventListener('click', () => {
    isFullScreen = !isFullScreen;
    app.classList.toggle('fullscreen', isFullScreen);

    // Ícone e label do botão
    iconExpand.style.display = isFullScreen ? 'none'  : 'block';
    iconCompr.style.display  = isFullScreen ? 'block' : 'none';
    labelFS.textContent      = isFullScreen ? 'Sair'  : 'Tela Cheia';

    if (isFullScreen) {
      // Ocultar painel inferior → mapa ocupa 100% da área central
      if (painelInf) painelInf.style.display = 'none';
      // Fechar qualquer popup do modo normal que porventura esteja aberto
      mapa.closePopup();
      // Retornar painel ao empty state para quando sair do fullscreen
      mostrarEmptyState();
    } else {
      // Restaurar painel inferior
      if (painelInf) painelInf.style.display = '';
      // Fechar popup do modo fullscreen se ainda estiver aberto
      mapa.closePopup();
    }

    // Aguardar o reflow antes de corrigir o tamanho do mapa
    setTimeout(() => { if (mapa) mapa.invalidateSize(); }, 340);
  });
}

// =============================================================
// 11. ATUALIZAÇÃO CONJUNTA
// =============================================================
function atualizarVisualizacao() {
  const dados = getDadosFiltrados();
  plotarMarcadores(dados);
  atualizarPainel(dados);
  if (document.getElementById('toggle-heat').checked) atualizarHeatmap(dados);
  mostrarEmptyState(); // retorna ao empty state ao refiltrar
}

// =============================================================
// 12. FILTROS E ABAS
// =============================================================
function preencherFiltro(dados) {
  const select = document.getElementById('filtro-tipo');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  const tipos = [...new Set(dados.map(d => d.tipo))].sort();
  tipos.forEach(tipo => {
    const opt = document.createElement('option');
    opt.value = tipo; opt.textContent = tipo;
    select.appendChild(opt);
  });
  select.addEventListener('change', e => {
    filtroTipoAtivo = e.target.value;
    atualizarVisualizacao();
  });
}

function configurarAbas() {
  const botoes = document.querySelectorAll('.status-tab');

  function atualizarBadgesAbas() {
    const dadosTipo = todosDados.filter(d => filtroTipoAtivo === "" || d.tipo === filtroTipoAtivo);
    const cont = { "": 0, "Aberta": 0, "Em análise": 0, "Encerrada": 0 };
    dadosTipo.forEach(d => {
      cont[""]++;
      if (cont[d.status] !== undefined) cont[d.status]++;
    });
    const ids = { "": 'badge-todos', "Aberta": 'badge-aberta', "Em análise": 'badge-analise', "Encerrada": 'badge-encerrada' };
    Object.entries(ids).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = cont[key];
    });
  }

  botoes.forEach(btn => {
    btn.addEventListener('click', function() {
      botoes.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filtroStatusAtivo = this.dataset.status;
      atualizarVisualizacao();
    });
  });

  window._atualizarBadgesAbas = atualizarBadgesAbas;
}

// =============================================================
// 13. PAINEL DE INSIGHTS / DASHBOARD
// =============================================================
function atualizarPainel(dados) {
  // Total
  const totalEl = document.getElementById('total-ocorrencias');
  if (totalEl) totalEl.textContent = dados.length;

  // Por Tipo
  const contTipo = {};
  dados.forEach(d => contTipo[d.tipo] = (contTipo[d.tipo] || 0) + 1);
  const tiposOrd = Object.entries(contTipo).sort((a, b) => b[1] - a[1]);
  const max = tiposOrd.length > 0 ? tiposOrd[0][1] : 1;

  const containerTipo = document.getElementById('insight-tipos');
  if (containerTipo) {
    containerTipo.innerHTML = tiposOrd.map(([tipo, qtd]) => {
      const cor = CORES_TIPO[tipo] || COR_PADRAO;
      return `
        <div class="tipo-item" style="border-left:3px solid ${cor}">
          <div class="tipo-dot" style="background:${cor}"></div>
          <div class="tipo-info">
            <div class="tipo-nome">${tipo}</div>
            <div class="tipo-bar-wrap">
              <div class="tipo-bar-fill" style="width:${(qtd/max)*100}%; background:${cor}"></div>
            </div>
          </div>
          <div class="tipo-count">${qtd}</div>
        </div>`;
    }).join('') || '<div style="text-align:center;opacity:0.5;font-size:11px;padding:8px">Sem dados</div>';
  }

  // Por Bairro
  const contBairro = {};
  dados.forEach(d => contBairro[d.bairro] = (contBairro[d.bairro] || 0) + 1);
  const bairrosOrd = Object.entries(contBairro).sort((a, b) => b[1] - a[1]);

  const containerB = document.getElementById('insight-bairros');
  if (containerB) {
    containerB.innerHTML = bairrosOrd.map(([b, q]) => `
      <div class="bairro-item">
        <span class="bairro-nome">${b}</span>
        <span class="bairro-badge">${q}</span>
      </div>`).join('') || '<div style="text-align:center;opacity:0.5;font-size:11px;padding:8px">Sem dados</div>';
  }

  // Donut de status (canvas simples)
  desenharDonut(dados);

  if (window._atualizarBadgesAbas) window._atualizarBadgesAbas();
}

// =============================================================
// 14. MINI DONUT DE STATUS (sidebar direita)
// =============================================================
function desenharDonut(dados) {
  const canvas = document.getElementById('status-donut');
  const legend = document.getElementById('donut-legend');
  if (!canvas || !legend) return;

  const contStatus = { "Aberta": 0, "Em análise": 0, "Encerrada": 0 };
  dados.forEach(d => { if (contStatus[d.status] !== undefined) contStatus[d.status]++; });

  const cores = { "Aberta": "#ef4444", "Em análise": "#eab308", "Encerrada": "#059669" };
  const total = Object.values(contStatus).reduce((s, v) => s + v, 0);

  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r  = 38;
  const ri = 22;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
  } else {
    let startAngle = -Math.PI / 2;
    Object.entries(contStatus).forEach(([status, qtd]) => {
      if (qtd === 0) return;
      const angle = (qtd / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.fillStyle = cores[status];
      ctx.fill();
      startAngle += angle;
    });

    // Hole
    ctx.beginPath();
    ctx.arc(cx, cy, ri, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // Total no centro
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 14px 'Space Grotesk', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy);

  // Legenda
  legend.innerHTML = Object.entries(contStatus).map(([status, qtd]) => `
    <div class="donut-legend-item">
      <div class="donut-legend-dot" style="background:${cores[status]}"></div>
      <span class="donut-legend-label">${status}</span>
      <span class="donut-legend-val">${qtd}</span>
    </div>`).join('');
}

// =============================================================
// 15. LEGENDA
// =============================================================
function preencherLegenda() {
  const container = document.getElementById('legenda-cores');
  if (!container) return;
  container.innerHTML = Object.entries(CORES_TIPO).map(([tipo, cor]) => `
    <div class="legenda-item">
      <div class="legenda-dot" style="background:${cor}; box-shadow:0 0 6px ${cor}"></div>
      <span>${tipo}</span>
    </div>`).join('');
}

// =============================================================
// 16. UTILITÁRIOS
// =============================================================
function formatarData(dataISO) {
  if (!dataISO) return '—';
  const parts = dataISO.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// =============================================================
// 17. PONTO DE ENTRADA PRINCIPAL
// =============================================================
document.addEventListener('DOMContentLoaded', function() {

  atualizarProgressoSplash(20, 'step-1');

  fetch('dados_brutos.json')
    .then(response => {
      if (!response.ok) throw new Error('Erro ao carregar JSON');
      atualizarProgressoSplash(40, 'step-2');
      return response.json();
    })
    .then(dadosBrutos => {

      atualizarProgressoSplash(70, 'step-3');
      todosDados = transformarDados(dadosBrutos);

      atualizarProgressoSplash(90, 'step-4');

      inicializarMapa();
      configurarToggleHeatmap();
      configurarAbas();
      configurarBotaoFecharPainel();
      configurarFullscreen();

      plotarMarcadores(todosDados);
      preencherFiltro(todosDados);
      atualizarPainel(todosDados);
      preencherLegenda();

      atualizarProgressoSplash(100);
      finalizarSplash();
    })
    .catch(erro => {
      console.error('Falha:', erro);
      const splashInner = document.querySelector('.splash-inner');
      if (splashInner) {
        splashInner.innerHTML = `
          <div style="color:#ef4444;text-align:center;">
            <div style="font-size:40px;">⚠️</div>
            <div style="margin-top:15px;font-weight:bold;">Erro ao carregar sistema</div>
            <div style="font-size:12px;opacity:0.8;margin-top:10px;">Verifique o arquivo dados_brutos.json</div>
            <button onclick="location.reload()" style="margin-top:20px;background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Tentar novamente</button>
          </div>`;
      }
    });
});