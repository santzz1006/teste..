/**
 * Camaçari na Mão — Painel de Monitoramento Territorial
 * script.js — Lógica principal do mapa e painel de insights
 *
 * v3:
 * - Abas de filtro por status (Todos / Aberta / Em análise / Encerrada)
 * - Toggle Mapa de Calor (Leaflet.heat)
 * - Remoção do bloco ETL Antes/Depois
 * - Filtros de tipo e status combinados
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
          font-family: 'Montserrat', sans-serif;
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

  // Inicializa a camada de heatmap (vazia) mas não adiciona ao mapa ainda
  heatLayer = L.heatLayer([], {
    radius: 30,
    blur: 22,
    maxZoom: 17,
    gradient: {
      0.2: '#3498db',
      0.4: '#2ecc71',
      0.6: '#f1c40f',
      0.8: '#e67e22',
      1.0: '#e74c3c'
    }
  });
}

// =============================================================
// 4. CRIA ÍCONE PERSONALIZADO POR COR
// =============================================================
function criarIcone(cor) {
  return L.divIcon({
    className: 'marcador-custom',
    html: `<div style="
      background: ${cor};
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
}

// =============================================================
// 5. RETORNA OS DADOS FILTRADOS PELOS FILTROS ATIVOS
// =============================================================
function getDadosFiltrados() {
  return todosDados.filter(function(d) {
    const passaTipo   = filtroTipoAtivo   === "" || d.tipo   === filtroTipoAtivo;
    const passaStatus = filtroStatusAtivo === "" || d.status === filtroStatusAtivo;
    return passaTipo && passaStatus;
  });
}

// =============================================================
// 6. PLOTA OS MARCADORES NO MAPA
// =============================================================
function plotarMarcadores(dados) {
  clusterGroup.clearLayers();

  dados.forEach(function(item) {
    const cor = CORES_TIPO[item.tipo] || COR_PADRAO;

    const statusClasse = {
      "Aberta":     "status-aberta",
      "Em análise": "status-analise",
      "Encerrada":  "status-encerrada"
    }[item.status] || "status-aberta";

    const marcador = L.marker([item.latitude, item.longitude], {
      icon: criarIcone(cor)
    });

    const linhaEndereco = item.endereco
      ? `<div class="popup-linha"><strong>Endereço:</strong> ${item.endereco}</div>`
      : '';

    const badgeFonte = item.fonte
      ? `<div style="margin-top:6px; font-size:10px; color:#888; text-align:right;">
           📡 Fonte: ${item.fonte}
         </div>`
      : '';

    const popupHTML = `
      <div class="popup-denuncia">
        <div class="popup-tipo" style="background: ${cor}">
          ${item.tipo}
        </div>
        <div class="popup-linha">
          <strong>Bairro:</strong> ${item.bairro}
        </div>
        <div class="popup-linha">
          <strong>Data:</strong> ${formatarData(item.data)}
        </div>
        ${linhaEndereco}
        <div class="popup-linha">
          <strong>Ocorrência:</strong> ${item.descricao}
        </div>
        <div>
          <span class="popup-status ${statusClasse}">${item.status}</span>
        </div>
        ${badgeFonte}
      </div>
    `;

    marcador.bindPopup(popupHTML, { maxWidth: 260 });
    marcador.bindTooltip(`<b>${item.tipo}</b><br>${item.bairro}`, {
      direction: 'top',
      offset: [0, -10]
    });

    clusterGroup.addLayer(marcador);
  });

  document.getElementById('contador-resultados').textContent =
    `${dados.length} ocorrência${dados.length !== 1 ? 's' : ''} exibida${dados.length !== 1 ? 's' : ''}`;
}

// =============================================================
// 7. ATUALIZA O HEATMAP COM OS DADOS FILTRADOS
// =============================================================
function atualizarHeatmap(dados) {
  // 1. Remove a camada antiga do mapa para matar o bug do _animating
  if (heatLayer) {
    mapa.removeLayer(heatLayer);
  }

  // 2. Só cria uma nova se o botão de calor estiver ativado
  const heatAtivo = document.getElementById('toggle-heat').checked;
  if (!heatAtivo) return;

  const pontos = dados.map(function(item) {
    return [item.latitude, item.longitude, 1];
  });

  // 3. Cria a camada do ZERO toda vez e já adiciona ao mapa
  heatLayer = L.heatLayer(pontos, {
    radius: 30,
    blur: 22,
    maxZoom: 17,
    gradient: {
      0.2: '#3498db',
      0.4: '#2ecc71',
      0.6: '#f1c40f',
      0.8: '#e67e22',
      1.0: '#e74c3c'
    }
  }).addTo(mapa);
}

// =============================================================
// 8. ALTERNA ENTRE MARCADORES E HEATMAP
// =============================================================
function configurarToggleHeatmap() {
  const toggleInput = document.getElementById('toggle-heat');

  toggleInput.addEventListener('change', function() {
    if (this.checked) {
      // Liga heatmap, desliga marcadores
      mapa.removeLayer(clusterGroup);
      atualizarHeatmap(getDadosFiltrados());
    } else {
      // Liga marcadores, desliga heatmap
      if (heatLayer) mapa.removeLayer(heatLayer);
      mapa.addLayer(clusterGroup);
    }
  });
}
// =============================================================
// 9. ATUALIZA TUDO COM BASE NOS FILTROS ATIVOS
// =============================================================
function atualizarVisualizacao() {
  const dados = getDadosFiltrados();

  plotarMarcadores(dados);
  atualizarPainel(dados);
  atualizarInsights(dados);

  // Atualiza o heatmap se estiver ativo
  const heatAtivo = document.getElementById('toggle-heat').checked;
  if (heatAtivo) {
    atualizarHeatmap(dados);
  }
}

// =============================================================
// 10. PREENCHE O DROPDOWN DE FILTRO POR TIPO
// =============================================================
function preencherFiltro(dados) {
  const select = document.getElementById('filtro-tipo');

  while (select.options.length > 1) select.remove(1);

  const tipos = [...new Set(dados.map(d => d.tipo))].sort();

  tipos.forEach(function(tipo) {
    const option = document.createElement('option');
    option.value = tipo;
    option.textContent = tipo;
    select.appendChild(option);
  });

  const novoSelect = select.cloneNode(true);
  select.parentNode.replaceChild(novoSelect, select);

  novoSelect.addEventListener('change', function() {
    filtroTipoAtivo = this.value;
    atualizarVisualizacao();
  });
}

// =============================================================
// 11. CONFIGURA AS ABAS DE STATUS
// =============================================================
function configurarAbas() {
  const botoes = document.querySelectorAll('.aba-btn');

  // Preenche os badges com contagens absolutas (do total sem filtro de status)
  function atualizarBadgesAbas() {
    const dadosComTipo = todosDados.filter(function(d) {
      return filtroTipoAtivo === "" || d.tipo === filtroTipoAtivo;
    });

    const contagens = { "": 0, "Aberta": 0, "Em análise": 0, "Encerrada": 0 };
    dadosComTipo.forEach(function(d) {
      contagens[""]++;
      if (contagens[d.status] !== undefined) contagens[d.status]++;
    });

    document.getElementById('badge-todos').textContent     = contagens[""];
    document.getElementById('badge-aberta').textContent    = contagens["Aberta"];
    document.getElementById('badge-analise').textContent   = contagens["Em análise"];
    document.getElementById('badge-encerrada').textContent = contagens["Encerrada"];
  }

  botoes.forEach(function(btn) {
    btn.addEventListener('click', function() {
      botoes.forEach(function(b) { b.classList.remove('ativa'); });
      this.classList.add('ativa');

      filtroStatusAtivo = this.dataset.status;
      atualizarVisualizacao();
    });
  });

  // Expõe a função para ser chamada quando o filtro de tipo mudar
  window._atualizarBadgesAbas = atualizarBadgesAbas;
}

// =============================================================
// 12. PAINEL ESQUERDO: RESUMO GERAL POR TIPO E BAIRRO
// =============================================================
function atualizarPainel(dados) {
  document.getElementById('total-ocorrencias').textContent = dados.length;

  // Contagem por tipo
  const contagemTipo = {};
  dados.forEach(function(d) {
    contagemTipo[d.tipo] = (contagemTipo[d.tipo] || 0) + 1;
  });

  const tiposOrdenados = Object.entries(contagemTipo).sort((a, b) => b[1] - a[1]);
  const maxQtd = tiposOrdenados.length > 0 ? tiposOrdenados[0][1] : 1;

  const insightContainer = document.getElementById('insight-tipos');
  insightContainer.innerHTML = '';

  tiposOrdenados.forEach(function([tipo, qtd]) {
    const cor = CORES_TIPO[tipo] || COR_PADRAO;
    const percentBarra = Math.round((qtd / maxQtd) * 100);

    insightContainer.innerHTML += `
      <div class="insight-item" style="border-left-color: ${cor}">
        <div class="cor-dot" style="background: ${cor}"></div>
        <div class="info">
          <div class="nome" title="${tipo}">${tipo}</div>
          <div class="barra-wrap">
            <div class="barra-fill" style="width: ${percentBarra}%; background: ${cor}"></div>
          </div>
        </div>
        <div class="qtd">${qtd}</div>
      </div>
    `;
  });

  if (tiposOrdenados.length === 0) {
    insightContainer.innerHTML = '<p style="font-size:12px; color:#999; text-align:center; padding:10px 0;">Nenhuma ocorrência</p>';
  }

  // Contagem por bairro
  const contagemBairro = {};
  dados.forEach(function(d) {
    contagemBairro[d.bairro] = (contagemBairro[d.bairro] || 0) + 1;
  });

  const bairrosOrdenados = Object.entries(contagemBairro).sort((a, b) => b[1] - a[1]);

  const bairroContainer = document.getElementById('insight-bairros');
  bairroContainer.innerHTML = '';

  bairrosOrdenados.forEach(function([bairro, qtd]) {
    bairroContainer.innerHTML += `
      <div class="bairro-item">
        <span class="bairro-nome">${bairro}</span>
        <span class="bairro-qtd">${qtd}</span>
      </div>
    `;
  });

  if (bairrosOrdenados.length === 0) {
    bairroContainer.innerHTML = '<p style="font-size:12px; color:#999; text-align:center; padding:10px 0;">Nenhuma ocorrência</p>';
  }

  // Atualiza badges das abas sempre que o painel atualiza
  if (window._atualizarBadgesAbas) {
    window._atualizarBadgesAbas();
  }
}

// =============================================================
// 13. PAINEL DIREITO: INSIGHTS POR TIPO (bloco #insights)
// =============================================================
function atualizarInsights(dados) {
  const container = document.getElementById('insights');
  if (!container) return;

  const contagemTipo = {};
  dados.forEach(function(d) {
    contagemTipo[d.tipo] = (contagemTipo[d.tipo] || 0) + 1;
  });

  const total = dados.length;

  let html = `
    <div class="insights-titulo">Ocorrências por Tipo</div>
    <div class="insights-subtitulo">${total} registro${total !== 1 ? 's' : ''} no filtro atual</div>
  `;

  const ordenados = Object.entries(contagemTipo).sort((a, b) => b[1] - a[1]);

  ordenados.forEach(function([tipo, qtd]) {
    const cor = CORES_TIPO[tipo] || COR_PADRAO;
    const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;

    html += `
      <div class="insights-linha">
        <span class="insights-dot" style="background:${cor}"></span>
        <span class="insights-nome">${tipo}</span>
        <span class="insights-pct">${pct}%</span>
        <span class="insights-num">${qtd}</span>
      </div>
    `;
  });

  if (ordenados.length === 0) {
    html += `<div style="color:#999; font-size:12px; text-align:center; padding:8px 0;">Sem dados para o filtro</div>`;
  }

  container.innerHTML = html;
}

// =============================================================
// 14. PREENCHE A LEGENDA DE CORES
// =============================================================
function preencherLegenda() {
  const legendaContainer = document.getElementById('legenda-cores');
  legendaContainer.innerHTML = '';

  Object.entries(CORES_TIPO).forEach(function([tipo, cor]) {
    legendaContainer.innerHTML += `
      <div class="legenda-item">
        <div class="legenda-dot" style="background: ${cor}"></div>
        <span>${tipo}</span>
      </div>
    `;
  });
}

// =============================================================
// 15. HELPER: FORMATA DATA (ISO → DD/MM/AAAA)
// =============================================================
function formatarData(dataISO) {
  if (!dataISO) return '—';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// =============================================================
// 16. PONTO DE ENTRADA PRINCIPAL
// =============================================================
fetch('dados_brutos.json')
  .then(function(response) {
    if (!response.ok) throw new Error('Erro ao carregar dados_brutos.json');
    return response.json();
  })
  .then(function(dadosBrutos) {

    // Transformação via transformador.js
    todosDados = transformarDados(dadosBrutos);

    // Inicializa o mapa
    inicializarMapa();

    // Configura interações
    configurarToggleHeatmap();
    configurarAbas();

    // Renderização inicial (sem filtros)
    plotarMarcadores(todosDados);
    preencherFiltro(todosDados);
    atualizarPainel(todosDados);
    atualizarInsights(todosDados);
    preencherLegenda();

  })
  .catch(function(erro) {
    console.error('Falha ao carregar dados:', erro);
    document.getElementById('map').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:12px; color:#c0392b; font-family:'Roboto',Arial;">
        <div style="font-size:40px;">⚠️</div>
        <div><strong>Erro ao carregar dados_brutos.json</strong></div>
        <div style="font-size:13px; color:#666;">Abra via servidor HTTP (ex: <code>python -m http.server</code>)<br>ou acesse diretamente pelo navegador com o arquivo local.</div>
      </div>
    `;
  });