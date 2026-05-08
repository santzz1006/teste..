/**
 * Camaçari na Mão — Painel de Monitoramento Territorial
 * script.js — Lógica principal do mapa e painel de insights
 * v4.0 — Sistema de Splash Screen e Dashboard Integrado
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
let todosDados = [];       // todos os registros transformados
let filtroTipoAtivo = "";  // tipo selecionado no dropdown
let filtroStatusAtivo = ""; // status selecionado nas abas

// =============================================================
// 3. INICIALIZAÇÃO DO MAPA
// =============================================================
function inicializarMapa() {
  const CAMACARI_LAT = -12.6985;
  const CAMACARI_LNG = -38.3239;

  mapa = L.map('map').setView([CAMACARI_LAT, CAMACARI_LNG], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapa);

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
}

// =============================================================
// 4. LÓGICA DO SPLASH SCREEN (CARREGAMENTO)
// =============================================================
function atualizarProgressoSplash(porcentagem, passoId) {
  const bar = document.getElementById('splash-bar');
  const pctText = document.getElementById('splash-pct');
  
  if (bar) bar.style.width = porcentagem + '%';
  if (pctText) pctText.textContent = porcentagem + '%';

  if (passoId) {
    document.querySelectorAll('.splash-step').forEach(el => el.classList.remove('active'));
    const step = document.getElementById(passoId);
    if (step) step.classList.add('active');
  }
}

function finalizarSplash() {
  const splash = document.getElementById('splash-screen');
  const app = document.getElementById('app');

  // Pequeno delay para o usuário ver o 100%
  setTimeout(() => {
    if (splash) splash.style.opacity = '0';
    if (app) app.classList.remove('app-hidden');
    
    setTimeout(() => {
      if (splash) splash.style.display = 'none';
      if (mapa) mapa.invalidateSize(); // Corrige bug de renderização do Leaflet em divs ocultas
    }, 500);
  }, 600);
}

// =============================================================
// 5. CRIAÇÃO DE COMPONENTES VISUAIS
// =============================================================
function criarIcone(cor) {
  return L.divIcon({
    className: 'marcador-custom',
    html: `<div style="background: ${cor}; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
}

// =============================================================
// 6. FILTRAGEM E RENDERIZAÇÃO
// =============================================================
function getDadosFiltrados() {
  return todosDados.filter(d => {
    const passaTipo = filtroTipoAtivo === "" || d.tipo === filtroTipoAtivo;
    const passaStatus = filtroStatusAtivo === "" || d.status === filtroStatusAtivo;
    return passaTipo && passaStatus;
  });
}

function plotarMarcadores(dados) {
  clusterGroup.clearLayers();

  dados.forEach(item => {
    const cor = CORES_TIPO[item.tipo] || COR_PADRAO;
    const statusClasse = { "Aberta": "status-aberta", "Em análise": "status-analise", "Encerrada": "status-encerrada" }[item.status] || "status-aberta";

    const marcador = L.marker([item.latitude, item.longitude], { icon: criarIcone(cor) });
    const popupHTML = `
      <div class="popup-denuncia">
        <div class="popup-tipo" style="background: ${cor}">${item.tipo}</div>
        <div class="popup-linha"><strong>Bairro:</strong> ${item.bairro}</div>
        <div class="popup-linha"><strong>Data:</strong> ${formatarData(item.data)}</div>
        <div class="popup-linha"><strong>Ocorrência:</strong> ${item.descricao}</div>
        <div><span class="popup-status-badge ${statusClasse}">${item.status}</span></div>
        <div class="popup-fonte">📡 Fonte: SISSEDUR</div>
      </div>`;

    marcador.bindPopup(popupHTML, { maxWidth: 260 });
    clusterGroup.addLayer(marcador);
  });

  const contador = document.getElementById('contador-resultados');
  if (contador) contador.innerHTML = `<div class="counter-dot"></div><span>${dados.length} ocorrências</span>`;
}

// =============================================================
// 7. HEATMAP E INTERAÇÕES
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

function atualizarVisualizacao() {
  const dados = getDadosFiltrados();
  plotarMarcadores(dados);
  atualizarPainel(dados);
  atualizarInsights(dados);
  if (document.getElementById('toggle-heat').checked) atualizarHeatmap(dados);
}

// =============================================================
// 8. INTERFACE E DASHBOARD
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
    dadosTipo.forEach(d => { cont[""]++; if (cont[d.status] !== undefined) cont[d.status]++; });

    if(document.getElementById('badge-todos')) document.getElementById('badge-todos').textContent = cont[""];
    if(document.getElementById('badge-aberta')) document.getElementById('badge-aberta').textContent = cont["Aberta"];
    if(document.getElementById('badge-analise')) document.getElementById('badge-analise').textContent = cont["Em análise"];
    if(document.getElementById('badge-encerrada')) document.getElementById('badge-encerrada').textContent = cont["Encerrada"];
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

function atualizarPainel(dados) {
  const totalEl = document.getElementById('total-ocorrencias');
  if (totalEl) totalEl.textContent = dados.length;

  // Painel por Tipo
  const contTipo = {};
  dados.forEach(d => contTipo[d.tipo] = (contTipo[d.tipo] || 0) + 1);
  const tiposOrd = Object.entries(contTipo).sort((a, b) => b[1] - a[1]);
  const max = tiposOrd.length > 0 ? tiposOrd[0][1] : 1;
  const container = document.getElementById('insight-tipos');
  if (container) {
    container.innerHTML = tiposOrd.map(([tipo, qtd]) => {
      const cor = CORES_TIPO[tipo] || COR_PADRAO;
      return `
        <div class="insight-item" style="border-left: 3px solid ${cor}; background: rgba(255,255,255,0.02); margin-bottom:6px; padding:8px; display:flex; align-items:center; justify-content:space-between;">
          <div style="flex:1">
            <div style="font-size:11px; font-weight:600; margin-bottom:4px;">${tipo}</div>
            <div style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
              <div style="width:${(qtd/max)*100}%; height:100%; background:${cor}"></div>
            </div>
          </div>
          <div style="font-family:var(--font-mono); font-weight:bold; font-size:14px; margin-left:12px;">${qtd}</div>
        </div>`;
    }).join('') || '<div style="text-align:center; opacity:0.5; font-size:11px;">Sem dados</div>';
  }

  // Painel por Bairro
  const contBairro = {};
  dados.forEach(d => contBairro[d.bairro] = (contBairro[d.bairro] || 0) + 1);
  const bairrosOrd = Object.entries(contBairro).sort((a, b) => b[1] - a[1]);
  const containerB = document.getElementById('insight-bairros');
  if (containerB) {
    containerB.innerHTML = bairrosOrd.map(([b, q]) => `
      <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03); font-size:12px;">
        <span>${b}</span><span style="font-weight:bold">${q}</span>
      </div>`).join('');
  }
  if (window._atualizarBadgesAbas) window._atualizarBadgesAbas();
}

function atualizarInsights(dados) {
  // Função mantida para compatibilidade, integrada ao atualizarPainel
}

function preencherLegenda() {
  const container = document.getElementById('legenda-cores');
  if (!container) return;
  container.innerHTML = Object.entries(CORES_TIPO).map(([tipo, cor]) => `
    <div style="display:flex; align-items:center; gap:8px; font-size:11px; margin-bottom:4px;">
      <div style="width:8px; height:8px; border-radius:50%; background:${cor}"></div>
      <span>${tipo}</span>
    </div>`).join('');
}

function formatarData(dataISO) {
  if (!dataISO) return '—';
  const parts = dataISO.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// =============================================================
// 9. PONTO DE ENTRADA PRINCIPAL (FLUXO DE CARREGAMENTO)
// =============================================================
document.addEventListener('DOMContentLoaded', function() {
  
  // 1. Início (20%)
  atualizarProgressoSplash(20, 'step-1');

  fetch('dados_brutos.json')
    .then(response => {
      if (!response.ok) throw new Error('Erro ao carregar JSON');
      // 2. Dados recebidos (40%)
      atualizarProgressoSplash(40, 'step-2');
      return response.json();
    })
    .then(dadosBrutos => {
      
      // 3. Processando e Geocodificando (70%)
      atualizarProgressoSplash(70, 'step-3');
      todosDados = transformarDados(dadosBrutos);

      // 4. Inicializando Mapa e Interface (90%)
      atualizarProgressoSplash(90, 'step-4');
      
      inicializarMapa();
      configurarToggleHeatmap();
      configurarAbas();
      
      // Renderização inicial
      plotarMarcadores(todosDados);
      preencherFiltro(todosDados);
      atualizarPainel(todosDados);
      preencherLegenda();

      // 5. Concluído (100%)
      atualizarProgressoSplash(100);
      finalizarSplash();

    })
    .catch(erro => {
      console.error('Falha:', erro);
      const splashInner = document.querySelector('.splash-inner');
      if (splashInner) {
        splashInner.innerHTML = `
          <div style="color:#ef4444; text-align:center;">
            <div style="font-size:40px;">⚠️</div>
            <div style="margin-top:15px; font-weight:bold;">Erro ao carregar sistema</div>
            <div style="font-size:12px; opacity:0.8; margin-top:10px;">Verifique o arquivo dados_brutos.json</div>
            <button onclick="location.reload()" style="margin-top:20px; background:#ef4444; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Tentar novamente</button>
          </div>`;
      }
    });
});