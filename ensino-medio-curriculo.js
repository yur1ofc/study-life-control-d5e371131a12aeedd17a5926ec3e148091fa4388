/* ============================================================
   ensino-medio-curriculo.js
   Currículo-base do Ensino Médio brasileiro (referência BNCC),
   usado para pré-preencher as matérias no wizard de cadastro
   quando a pessoa escolhe o perfil "Ensino Médio". A lista é
   comum à maioria das escolas — cada matéria continua editável
   e removível depois, e escolas técnicas/EJA têm disciplinas a
   mais que a pessoa pode adicionar manualmente.
   ============================================================ */
(function (global) {
  'use strict';

  const MATERIAS_COMUNS = [
    'Língua Portuguesa',
    'Redação',
    'Matemática',
    'Física',
    'Química',
    'Biologia',
    'História',
    'Geografia',
    'Sociologia',
    'Filosofia',
    'Língua Inglesa',
    'Educação Física',
    'Artes'
  ];

  // Pequenas variações comuns por série (mantidas simples de propósito —
  // a base é a mesma, o que muda é ênfase, não listada aqui).
  const POR_SERIE = {
    '1': MATERIAS_COMUNS,
    '2': MATERIAS_COMUNS,
    '3': [...MATERIAS_COMUNS] // 3º ano costuma somar revisão para ENEM/vestibular, tratado à parte no perfil "Concurso/ENEM"
  };

  const TIPOS_ESCOLA = [
    { valor: 'regular', label: 'Ensino Médio Regular' },
    { valor: 'tecnico', label: 'Ensino Médio Técnico/Integrado' },
    { valor: 'eja', label: 'EJA (Educação de Jovens e Adultos)' }
  ];

  function getMateriasPorSerie(serie) {
    return POR_SERIE[String(serie)] || MATERIAS_COMUNS;
  }

  global.SLC_EnsinoMedio = { MATERIAS_COMUNS, POR_SERIE, TIPOS_ESCOLA, getMateriasPorSerie };
})(typeof window !== 'undefined' ? window : this);
