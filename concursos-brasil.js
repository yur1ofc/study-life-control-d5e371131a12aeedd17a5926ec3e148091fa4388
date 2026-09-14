/* ============================================================
   concursos-brasil.js
   Catálogo curado de concursos públicos brasileiros mais comuns,
   agrupados por área, com as matérias básicas de edital que
   costumam se repetir entre bancas (a pessoa pode editar depois).

   IMPORTANTE: cada edital real varia por órgão/ano/banca. Isso é
   um ponto de partida para pré-preencher o cadastro — não
   substitui a leitura do edital oficial. O campo de busca sempre
   aceita digitar um concurso que não está na lista (fluxo "criar
   do zero").

   Cada entrada: { nome, sigla, categoria, materias: [...] }
   ============================================================ */
(function (global) {
  'use strict';

  const BASICAS_COMUNS = ['Língua Portuguesa', 'Raciocínio Lógico', 'Informática', 'Atualidades'];

  const CONCURSOS = [
    // ── Segurança pública ──
    { nome: 'Polícia Rodoviária Federal', sigla: 'PRF', categoria: 'Segurança Pública',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Legislação de Trânsito', 'Física'] },
    { nome: 'Polícia Federal (Agente)', sigla: 'PF', categoria: 'Segurança Pública',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Direito Processual Penal', 'Contabilidade Geral'] },
    { nome: 'Polícia Militar (Soldado)', sigla: 'PM', categoria: 'Segurança Pública',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Penal', 'História e Geografia do Estado', 'Educação Física'] },
    { nome: 'Polícia Civil (Investigador/Escrivão)', sigla: 'PC', categoria: 'Segurança Pública',
      materias: [...BASICAS_COMUNS, 'Direito Penal', 'Direito Processual Penal', 'Direito Constitucional', 'Criminologia'] },
    { nome: 'Corpo de Bombeiros Militar', sigla: 'CBM', categoria: 'Segurança Pública',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Física', 'Educação Física', 'Noções de Primeiros Socorros'] },
    { nome: 'Guarda Civil Municipal', sigla: 'GCM', categoria: 'Segurança Pública',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Legislação Municipal'] },
    { nome: 'Perito Criminal', sigla: 'Perito', categoria: 'Segurança Pública',
      materias: [...BASICAS_COMUNS, 'Direito Penal', 'Criminalística', 'Medicina Legal', 'Área Específica (Química/Física/Biologia)'] },

    // ── Jurídico / Tribunais ──
    { nome: 'Tribunal de Justiça (Técnico/Analista)', sigla: 'TJ', categoria: 'Tribunais e Jurídico',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Direito Civil', 'Direito Processual Civil'] },
    { nome: 'Tribunal Regional Federal', sigla: 'TRF', categoria: 'Tribunais e Jurídico',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Direito Processual Civil', 'Direito Previdenciário'] },
    { nome: 'Tribunal Regional do Trabalho', sigla: 'TRT', categoria: 'Tribunais e Jurídico',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito do Trabalho', 'Direito Processual do Trabalho', 'Direito Administrativo'] },
    { nome: 'Tribunal Regional Eleitoral', sigla: 'TRE', categoria: 'Tribunais e Jurídico',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Eleitoral', 'Direito Administrativo'] },
    { nome: 'Ministério Público (Analista/Técnico)', sigla: 'MP', categoria: 'Tribunais e Jurídico',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Direito Civil'] },
    { nome: 'OAB (Exame de Ordem)', sigla: 'OAB', categoria: 'Tribunais e Jurídico',
      materias: ['Ética Profissional', 'Direito Constitucional', 'Direito Civil', 'Direito Penal', 'Direito Processual Civil', 'Direito do Trabalho', 'Direito Administrativo', 'Direito Tributário'] },
    { nome: 'Defensoria Pública (Técnico/Analista)', sigla: 'DP', categoria: 'Tribunais e Jurídico',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direitos Humanos', 'Direito Administrativo', 'Direito Civil'] },
    { nome: 'Cartório (Escrevente/Outorga)', sigla: 'Cartório', categoria: 'Tribunais e Jurídico',
      materias: [...BASICAS_COMUNS, 'Direito Civil', 'Direito Registral e Notarial', 'Direito Constitucional'] },

    // ── Fiscal / Tributário ──
    { nome: 'Receita Federal (Auditor Fiscal)', sigla: 'RFB', categoria: 'Fiscal e Tributário',
      materias: [...BASICAS_COMUNS, 'Direito Tributário', 'Contabilidade Geral e Avançada', 'Direito Constitucional', 'Economia', 'Comércio Exterior'] },
    { nome: 'Auditor Fiscal Estadual/Municipal (ICMS/ISS)', sigla: 'Fisco', categoria: 'Fiscal e Tributário',
      materias: [...BASICAS_COMUNS, 'Direito Tributário', 'Contabilidade', 'Legislação Tributária Estadual/Municipal', 'Direito Administrativo'] },
    { nome: 'Tribunal de Contas (TCU/TCE)', sigla: 'TCU/TCE', categoria: 'Fiscal e Tributário',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Controle Externo', 'Contabilidade Pública', 'Economia'] },

    // ── Bancário / Financeiro ──
    { nome: 'Banco do Brasil (Escriturário)', sigla: 'BB', categoria: 'Bancário e Financeiro',
      materias: [...BASICAS_COMUNS, 'Matemática Financeira', 'Conhecimentos Bancários', 'Atendimento e Vendas', 'Ética'] },
    { nome: 'Caixa Econômica Federal', sigla: 'CEF', categoria: 'Bancário e Financeiro',
      materias: [...BASICAS_COMUNS, 'Matemática Financeira', 'Conhecimentos Bancários', 'Direito Administrativo', 'Atendimento'] },
    { nome: 'Banco Central do Brasil', sigla: 'BACEN', categoria: 'Bancário e Financeiro',
      materias: [...BASICAS_COMUNS, 'Economia', 'Finanças Públicas', 'Direito Administrativo', 'Estatística'] },

    // ── Administrativo geral ──
    { nome: 'Concurso Público Municipal (Geral)', sigla: 'Prefeitura', categoria: 'Administrativo Geral',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Legislação Municipal'] },
    { nome: 'Concurso Público Estadual (Geral)', sigla: 'Estado', categoria: 'Administrativo Geral',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Legislação Estadual'] },
    { nome: 'INSS (Técnico do Seguro Social)', sigla: 'INSS', categoria: 'Administrativo Geral',
      materias: [...BASICAS_COMUNS, 'Direito Previdenciário', 'Direito Constitucional', 'Direito Administrativo'] },
    { nome: 'Correios', sigla: 'ECT', categoria: 'Administrativo Geral',
      materias: [...BASICAS_COMUNS, 'Direito Administrativo', 'Noções de Logística', 'Atendimento ao Público'] },
    { nome: 'IBGE (Recenseador/Agente)', sigla: 'IBGE', categoria: 'Administrativo Geral',
      materias: [...BASICAS_COMUNS, 'Estatística Básica', 'Noções de Geografia e Demografia'] },
    { nome: 'Tribunal de Contas / Câmara Legislativa (Geral)', sigla: 'Legislativo', categoria: 'Administrativo Geral',
      materias: [...BASICAS_COMUNS, 'Direito Constitucional', 'Direito Administrativo', 'Processo Legislativo'] },

    // ── Educação / Magistério ──
    { nome: 'Professor da Educação Básica (Prefeitura/Estado)', sigla: 'Professor', categoria: 'Educação',
      materias: ['Língua Portuguesa', 'Didática e Pedagogia', 'Legislação Educacional (LDB)', 'Conhecimentos Específicos da Disciplina', 'Atualidades em Educação'] },
    { nome: 'Pedagogo / Coordenador Pedagógico', sigla: 'Pedagogo', categoria: 'Educação',
      materias: ['Língua Portuguesa', 'Psicologia da Educação', 'Didática', 'Legislação Educacional (LDB, BNCC)', 'Gestão Escolar'] },

    // ── Saúde ──
    { nome: 'Concurso da Área da Saúde (Enfermagem/Técnico)', sigla: 'Saúde', categoria: 'Saúde',
      materias: [...BASICAS_COMUNS, 'Sistema Único de Saúde (SUS)', 'Ética Profissional', 'Conhecimentos Específicos da Área'] },
    { nome: 'Residência Médica', sigla: 'Residência', categoria: 'Saúde',
      materias: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Medicina Preventiva e Saúde Coletiva'] },

    // ── Tecnologia ──
    { nome: 'Analista de TI / Tecnologia da Informação', sigla: 'TI', categoria: 'Tecnologia',
      materias: [...BASICAS_COMUNS, 'Banco de Dados', 'Redes de Computadores', 'Engenharia de Software', 'Segurança da Informação'] },

    // ── Militares ──
    { nome: 'Forças Armadas (Exército/Marinha/Aeronáutica)', sigla: 'FFAA', categoria: 'Militar',
      materias: ['Língua Portuguesa', 'Matemática', 'História', 'Geografia', 'Educação Física'] },
    { nome: 'Escola Preparatória de Cadetes / EsPCEx', sigla: 'EsPCEx', categoria: 'Militar',
      materias: ['Língua Portuguesa', 'Matemática', 'Física', 'Química', 'História', 'Geografia', 'Inglês'] },

    // ── Vestibular / Enem (fronteira com "vida acadêmica") ──
    { nome: 'ENEM / Vestibular', sigla: 'ENEM', categoria: 'Vestibular',
      materias: ['Língua Portuguesa', 'Redação', 'Matemática', 'Física', 'Química', 'Biologia', 'História', 'Geografia', 'Sociologia', 'Filosofia', 'Inglês'] },
  ];

  function normalizar(str) {
    return (str || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Busca concursos por nome, sigla ou categoria.
   * @param {string} termo
   * @param {number} limite
   * @returns {Array<{nome:string, sigla:string, categoria:string, materias:string[]}>}
   */
  function buscarConcursos(termo, limite = 8) {
    const t = normalizar(termo);
    if (!t || t.length < 2) return [];

    const resultados = [];
    for (const c of CONCURSOS) {
      const nomeNorm = normalizar(c.nome);
      const siglaNorm = normalizar(c.sigla);
      const catNorm = normalizar(c.categoria);

      let score = -1;
      if (siglaNorm === t) score = 0;
      else if (siglaNorm.startsWith(t)) score = 1;
      else if (nomeNorm.startsWith(t)) score = 2;
      else if (nomeNorm.includes(t)) score = 3;
      else if (catNorm.includes(t)) score = 4;

      if (score >= 0) resultados.push({ ...c, score });
    }

    resultados.sort((a, b) => a.score - b.score || a.nome.localeCompare(b.nome, 'pt-BR'));
    return resultados.slice(0, limite);
  }

  function listarCategorias() {
    return [...new Set(CONCURSOS.map(c => c.categoria))];
  }

  function getMateriasDoConcurso(nome) {
    const alvo = normalizar(nome);
    const item = CONCURSOS.find(c => normalizar(c.nome) === alvo || normalizar(c.sigla) === alvo);
    return item ? item.materias : [];
  }

  global.SLC_Concursos = { buscarConcursos, listarCategorias, getMateriasDoConcurso, CONCURSOS };
})(typeof window !== 'undefined' ? window : this);
