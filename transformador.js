/**
 * transformador.js — Pipeline de Transformação de Dados
 * Camaçari na Mão | Simulação de Integração SISSEDUR → Visualização
 *
 * Este módulo simula o processo ETL (Extract, Transform, Load):
 *   - Extract:   dados chegam do SISSEDUR em formato bruto (sem coordenadas)
 *   - Transform: endereço → bairro → lat/lng + normalização de campos
 *   - Load:      objeto pronto para plotagem no mapa Leaflet
 *
 * Em produção real, a geocodificação seria feita via API (ex: Google Maps,
 * Nominatim/OSM) ou tabela de logradouros municipais. Aqui usamos um
 * dicionário local para fins de demonstração da PoC.
 */

// =============================================================
// DICIONÁRIO DE BAIRROS → COORDENADAS CENTRAIS
// Fonte: levantamento manual (PoC) — seria substituído por API real
// =============================================================
const COORDENADAS_BAIRRO = {
  "Centro":          { lat: -12.6985, lng: -38.3239 },
  "Phoc II":         { lat: -12.7050, lng: -38.3180 },
  "Gleba C":         { lat: -12.6920, lng: -38.3350 },
  "Polo Industrial": { lat: -12.6740, lng: -38.3600 },
  "Arembepe":        { lat: -12.7600, lng: -38.1800 },
  "Miragem":         { lat: -12.7010, lng: -38.3300 },
  "Abrantes":        { lat: -12.6875, lng: -38.3100 },
  "Nova Camaçari":   { lat: -12.7100, lng: -38.3400 },
  "Monte Gordo":     { lat: -12.6790, lng: -38.2940 },
  "Portão":          { lat: -12.7210, lng: -38.3510 },
};

// Coordenada de fallback (centro de Camaçari) para bairros não mapeados
const COORD_FALLBACK = { lat: -12.6985, lng: -38.3239 };

// =============================================================
// MAPEAMENTO DE CATEGORIAS DO SISSEDUR → TIPOS DO SISTEMA LOCAL
// Garante compatibilidade entre nomenclaturas de sistemas distintos
// =============================================================
const MAPA_CATEGORIAS = {
  "Obra irregular":              "Obra irregular",
  "Poluição sonora":             "Poluição sonora",
  "Terreno abandonado":          "Terreno abandonado",
  "Descarte irregular de lixo":  "Descarte irregular de lixo",
  "Ocupação irregular":          "Ocupação irregular",
};

// =============================================================
// FUNÇÃO 1: Extrai o nome do bairro a partir de uma string de endereço
//
// Estratégia: procura qualquer bairro conhecido dentro do endereço.
// Exemplo: "Rua Sete de Setembro, 142 - Centro, Camaçari" → "Centro"
// =============================================================
function extrairBairro(endereco) {
  if (!endereco) return null;

  const enderecoUpper = endereco.toUpperCase();

  for (const bairro of Object.keys(COORDENADAS_BAIRRO)) {
    if (enderecoUpper.includes(bairro.toUpperCase())) {
      return bairro;
    }
  }

  // Tenta extrair o segmento entre " - " e "," como bairro genérico
  const match = endereco.match(/-\s*([^,]+),/);
  if (match) return match[1].trim();

  return "Desconhecido";
}

// =============================================================
// FUNÇÃO 2: Busca as coordenadas geográficas de um bairro
// Retorna coordenadas do dicionário ou o fallback central
// =============================================================
function geocodificarBairro(nomeBairro) {
  return COORDENADAS_BAIRRO[nomeBairro] || COORD_FALLBACK;
}

// =============================================================
// FUNÇÃO 3: Adiciona variação aleatória pequena às coordenadas
// Evita que múltiplos pontos do mesmo bairro se sobreponham exatamente
// Simula endereços distintos dentro de um mesmo bairro
// =============================================================
function aplicarJitter(lat, lng) {
  const fator = 0.003; // ~300 metros de variação máxima
  return {
    lat: lat + (Math.random() - 0.5) * fator * 2,
    lng: lng + (Math.random() - 0.5) * fator * 2,
  };
}

// =============================================================
// FUNÇÃO 4: Transforma UM registro bruto do SISSEDUR
// em um objeto padronizado para o mapa
//
// Entrada (dado bruto):
//   { id_sissedur, descricao, endereco, categoria, data_registro, status }
//
// Saída (dado transformado):
//   { id, tipo, bairro, descricao, latitude, longitude, data, status, fonte }
// =============================================================
function transformarRegistro(registroBruto) {
  // 1. Extrai o bairro do endereço textual
  const bairro = extrairBairro(registroBruto.endereco);

  // 2. Obtém as coordenadas centrais do bairro
  const coordBase = geocodificarBairro(bairro);

  // 3. Aplica variação para distribuir pontos visualmente
  const coord = aplicarJitter(coordBase.lat, coordBase.lng);

  // 4. Mapeia a categoria SISSEDUR para o tipo do sistema local
  const tipo = MAPA_CATEGORIAS[registroBruto.categoria] || registroBruto.categoria;

  // 5. Retorna o objeto transformado e compatível com o mapa
  return {
    id:        registroBruto.id_sissedur,
    tipo:      tipo,
    bairro:    bairro,
    descricao: registroBruto.descricao,
    latitude:  parseFloat(coord.lat.toFixed(6)),
    longitude: parseFloat(coord.lng.toFixed(6)),
    data:      registroBruto.data_registro,
    status:    registroBruto.status,
    fonte:     "SISSEDUR",          // marca a origem dos dados
    endereco:  registroBruto.endereco  // preserva o endereço original para exibição
  };
}

// =============================================================
// FUNÇÃO 5: Transforma um ARRAY de registros brutos
// Ponto de entrada principal do módulo
// =============================================================
function transformarDados(dadosBrutos) {
  if (!Array.isArray(dadosBrutos) || dadosBrutos.length === 0) {
    console.warn("[Transformador] Nenhum dado bruto recebido.");
    return [];
  }

  const transformados = dadosBrutos.map(transformarRegistro);

  console.log(
    `[Transformador] ✅ ${transformados.length} registros transformados com sucesso.`
  );

  return transformados;
}

// =============================================================
// EXPORTA o exemplo de ANTES/DEPOIS para o bloco visual da interface
// Seleciona o primeiro registro como exemplo didático
// =============================================================
function getExemploTransformacao(dadosBrutos) {
  if (!dadosBrutos || dadosBrutos.length === 0) return null;

  const bruto = dadosBrutos[0];
  const transformado = transformarRegistro(bruto);

  return { bruto, transformado };
}