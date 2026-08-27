/* ============================================================
   universidades-brasil.js
   Lista curada de instituições de ensino superior do Brasil
   (universidades federais, institutos federais, universidades
   estaduais e as principais universidades/faculdades privadas
   por número de alunos).

   IMPORTANTE: esta NÃO é a base completa do e-MEC (que tem
   ~2.600 instituições e não está acessível para scraping
   automatizado no momento). Cobre as instituições onde a
   grande maioria dos estudantes brasileiros está matriculada.
   O campo continua editável em texto livre — se a instituição
   do usuário não estiver na lista, ele digita normalmente.

   Cada entrada: [nome completo, sigla, UF]
   ============================================================ */
(function (global) {
  'use strict';

  const INSTITUICOES = [
  ['Centro Universitário Christus','UNICHRISTUS','CE'],
  ['Centro Universitário Curitiba','UNICURITIBA','PR'],
  ['Centro Universitário FEI','FEI','SP'],
  ['Centro Universitário Facex','UNIFACEX','RN'],
  ['Centro Universitário IBMEC','IBMEC','RJ'],
  ['Centro Universitário Jorge Amado','UNIJORGE','BA'],
  ['Centro Universitário UNA','UNA','MG'],
  ['Centro Universitário Uniamérica','UNIAMÉRICA','PR'],
  ['Centro Universitário Unifacs','UNIFACS','BA'],
  ['Centro Universitário de Brasília','CEUB','DF'],
  ['Escola Bahiana de Medicina e Saúde Pública','Bahiana','BA'],
  ['Escola Superior de Propaganda e Marketing','ESPM','SP'],
  ['Faculdade Boa Viagem (Devry)','FBV','PE'],
  ['Faculdade Descomplica','Descomplica','RJ'],
  ['Faculdade Independente do Nordeste','FAINOR','BA'],
  ['Faculdade Pitágoras','Pitágoras','MG'],
  ['Faculdade São Francisco de Barreiras','FASB','BA'],
  ['Faculdade de Tecnologia (Fatec)','FATEC','SP'],
  ['Faculdades Integradas do Brasil','UniBrasil','PR'],
  ['Faculdades Metropolitanas Unidas','FMU','SP'],
  ['Fundação Getulio Vargas','FGV','SP'],
  ['Fundação Universidade Federal de Ciências da Saúde de Porto Alegre','UFCSPA','RS'],
  ['Instituto Federal Baiano','IF Baiano','BA'],
  ['Instituto Federal Catarinense','IFC','SC'],
  ['Instituto Federal Farroupilha','IFFar','RS'],
  ['Instituto Federal Fluminense','IFF','RJ'],
  ['Instituto Federal Goiano','IF Goiano','GO'],
  ['Instituto Federal Sul-rio-grandense','IFSul','RS'],
  ['Instituto Federal da Bahia','IFBA','BA'],
  ['Instituto Federal da Paraíba','IFPB','PB'],
  ['Instituto Federal de Alagoas','IFAL','AL'],
  ['Instituto Federal de Brasília','IFB','DF'],
  ['Instituto Federal de Educação, Ciência e Tecnologia de Brasília','IFB','DF'],
  ['Instituto Federal de Goiás','IFG','GO'],
  ['Instituto Federal de Mato Grosso','IFMT','MT'],
  ['Instituto Federal de Mato Grosso do Sul','IFMS','MS'],
  ['Instituto Federal de Minas Gerais','IFMG','MG'],
  ['Instituto Federal de Pernambuco','IFPE','PE'],
  ['Instituto Federal de Rondônia','IFRO','RO'],
  ['Instituto Federal de Roraima','IFRR','RR'],
  ['Instituto Federal de Santa Catarina','IFSC','SC'],
  ['Instituto Federal de Sergipe','IFS','SE'],
  ['Instituto Federal de São Paulo','IFSP','SP'],
  ['Instituto Federal do Acre','IFAC','AC'],
  ['Instituto Federal do Amapá','IFAP','AP'],
  ['Instituto Federal do Amazonas','IFAM','AM'],
  ['Instituto Federal do Ceará','IFCE','CE'],
  ['Instituto Federal do Espírito Santo','IFES','ES'],
  ['Instituto Federal do Maranhão','IFMA','MA'],
  ['Instituto Federal do Norte de Minas Gerais','IFNMG','MG'],
  ['Instituto Federal do Paraná','IFPR','PR'],
  ['Instituto Federal do Pará','IFPA','PA'],
  ['Instituto Federal do Piauí','IFPI','PI'],
  ['Instituto Federal do Rio Grande do Norte','IFRN','RN'],
  ['Instituto Federal do Rio Grande do Sul','IFRS','RS'],
  ['Instituto Federal do Rio de Janeiro','IFRJ','RJ'],
  ['Instituto Federal do Sertão Pernambucano','IF Sertão-PE','PE'],
  ['Instituto Federal do Sudeste de Minas Gerais','IF Sudeste MG','MG'],
  ['Instituto Federal do Sul de Minas Gerais','IFSULDEMINAS','MG'],
  ['Instituto Federal do Tocantins','IFTO','TO'],
  ['Instituto Federal do Triângulo Mineiro','IFTM','MG'],
  ['Instituto de Ensino e Pesquisa','INSPER','SP'],
  ['Newton Paiva Faculdades','Newton Paiva','MG'],
  ['Pontifícia Universidade Católica de Campinas','PUC-Campinas','SP'],
  ['Pontifícia Universidade Católica de Goiás','PUC Goiás','GO'],
  ['Pontifícia Universidade Católica de Minas Gerais','PUC Minas','MG'],
  ['Pontifícia Universidade Católica de São Paulo','PUC-SP','SP'],
  ['Pontifícia Universidade Católica do Paraná','PUCPR','PR'],
  ['Pontifícia Universidade Católica do Rio Grande do Sul','PUCRS','RS'],
  ['Pontifícia Universidade Católica do Rio de Janeiro','PUC-Rio','RJ'],
  ['Universidade Anhanguera','Anhanguera','SP'],
  ['Universidade Anhembi Morumbi','UAM','SP'],
  ['Universidade Bandeirante de São Paulo','UNIBAN','SP'],
  ['Universidade Braz Cubas','UBC','SP'],
  ['Universidade Católica de Brasília','UCB','DF'],
  ['Universidade Católica de Goiás (PUC Goiás)','PUC Goiás','GO'],
  ['Universidade Católica de Pernambuco','UNICAP','PE'],
  ['Universidade Católica do Salvador','UCSAL','BA'],
  ['Universidade Cesumar','UNICESUMAR','PR'],
  ['Universidade Ceuma','CEUMA','MA'],
  ['Universidade Comunitária da Região de Chapecó','UNOCHAPECÓ','SC'],
  ['Universidade Cruzeiro do Sul','UNICSUL','SP'],
  ['Universidade Cândido Mendes','UCAM','RJ'],
  ['Universidade Estadual Paulista Júlio de Mesquita Filho','UNESP','SP'],
  ['Universidade Estadual Vale do Acaraú','UVA','CE'],
  ['Universidade Estadual da Bahia','UNEB','BA'],
  ['Universidade Estadual da Paraíba','UEPB','PB'],
  ['Universidade Estadual de Campinas','UNICAMP','SP'],
  ['Universidade Estadual de Feira de Santana','UEFS','BA'],
  ['Universidade Estadual de Goiás','UEG','GO'],
  ['Universidade Estadual de Londrina','UEL','PR'],
  ['Universidade Estadual de Maringá','UEM','PR'],
  ['Universidade Estadual de Maringá (privadas assoc.)','','PR'],
  ['Universidade Estadual de Mato Grosso do Sul','UEMS','MS'],
  ['Universidade Estadual de Montes Claros','UNIMONTES','MG'],
  ['Universidade Estadual de Pernambuco','UPE','PE'],
  ['Universidade Estadual de Ponta Grossa','UEPG','PR'],
  ['Universidade Estadual de Roraima','UERR','RR'],
  ['Universidade Estadual de Santa Cruz','UESC','BA'],
  ['Universidade Estadual do Amazonas','UEA','AM'],
  ['Universidade Estadual do Ceará','UECE','CE'],
  ['Universidade Estadual do Centro-Oeste','UNICENTRO','PR'],
  ['Universidade Estadual do Maranhão','UEMA','MA'],
  ['Universidade Estadual do Norte Fluminense','UENF','RJ'],
  ['Universidade Estadual do Norte do Paraná','UENP','PR'],
  ['Universidade Estadual do Oeste do Paraná','UNIOESTE','PR'],
  ['Universidade Estadual do Piauí','UESPI','PI'],
  ['Universidade Estadual do Rio Grande do Sul','UERGS','RS'],
  ['Universidade Estadual do Sudoeste da Bahia','UESB','BA'],
  ['Universidade Estácio de Sá','Estácio','RJ'],
  ['Universidade FUMEC','FUMEC','MG'],
  ['Universidade Federal Fluminense','UFF','RJ'],
  ['Universidade Federal Fluminense (privadas conveniadas)','','RJ'],
  ['Universidade Federal Latino-Americana','UNILA','PR'],
  ['Universidade Federal Rural de Pernambuco','UFRPE','PE'],
  ['Universidade Federal Rural do Rio de Janeiro','UFRRJ','RJ'],
  ['Universidade Federal Rural do Semi-Árido','UFERSA','RN'],
  ['Universidade Federal da Bahia','UFBA','BA'],
  ['Universidade Federal da Fronteira Sul','UFFS','RS'],
  ['Universidade Federal da Integração Latino-Americana','UNILA','PR'],
  ['Universidade Federal da Paraíba','UFPB','PB'],
  ['Universidade Federal de Alagoas','UFAL','AL'],
  ['Universidade Federal de Alfenas','UNIFAL-MG','MG'],
  ['Universidade Federal de Campina Grande','UFCG','PB'],
  ['Universidade Federal de Catalão','UFCAT','GO'],
  ['Universidade Federal de Ciências da Saúde de Porto Alegre','UFCSPA','RS'],
  ['Universidade Federal de Goiás','UFG','GO'],
  ['Universidade Federal de Goiás (privadas assoc.)','','GO'],
  ['Universidade Federal de Itajubá','UNIFEI','MG'],
  ['Universidade Federal de Jataí','UFJ','GO'],
  ['Universidade Federal de Juiz de Fora','UFJF','MG'],
  ['Universidade Federal de Lavras','UFLA','MG'],
  ['Universidade Federal de Mato Grosso','UFMT','MT'],
  ['Universidade Federal de Mato Grosso do Sul','UFMS','MS'],
  ['Universidade Federal de Minas Gerais','UFMG','MG'],
  ['Universidade Federal de Ouro Preto','UFOP','MG'],
  ['Universidade Federal de Pelotas','UFPel','RS'],
  ['Universidade Federal de Pernambuco','UFPE','PE'],
  ['Universidade Federal de Rondonópolis','UFR','MT'],
  ['Universidade Federal de Rondônia','UNIR','RO'],
  ['Universidade Federal de Roraima','UFRR','RR'],
  ['Universidade Federal de Santa Catarina','UFSC','SC'],
  ['Universidade Federal de Santa Maria','UFSM','RS'],
  ['Universidade Federal de Sergipe','UFS','SE'],
  ['Universidade Federal de São Carlos','UFSCar','SP'],
  ['Universidade Federal de São João del-Rei','UFSJ','MG'],
  ['Universidade Federal de São Paulo','UNIFESP','SP'],
  ['Universidade Federal de São Paulo (Escola Paulista de Medicina)','UNIFESP-EPM','SP'],
  ['Universidade Federal de Uberlândia','UFU','MG'],
  ['Universidade Federal de Viçosa','UFV','MG'],
  ['Universidade Federal do ABC','UFABC','SP'],
  ['Universidade Federal do Acre','UFAC','AC'],
  ['Universidade Federal do Amapá','UNIFAP','AP'],
  ['Universidade Federal do Amazonas','UFAM','AM'],
  ['Universidade Federal do Cariri','UFCA','CE'],
  ['Universidade Federal do Ceará','UFC','CE'],
  ['Universidade Federal do Espírito Santo','UFES','ES'],
  ['Universidade Federal do Estado do Rio de Janeiro','UNIRIO','RJ'],
  ['Universidade Federal do Maranhão','UFMA','MA'],
  ['Universidade Federal do Oeste da Bahia','UFOB','BA'],
  ['Universidade Federal do Oeste do Pará','UFOPA','PA'],
  ['Universidade Federal do Pampa','UNIPAMPA','RS'],
  ['Universidade Federal do Paraná','UFPR','PR'],
  ['Universidade Federal do Pará','UFPA','PA'],
  ['Universidade Federal do Piauí','UFPI','PI'],
  ['Universidade Federal do Recôncavo da Bahia','UFRB','BA'],
  ['Universidade Federal do Rio Grande','FURG','RS'],
  ['Universidade Federal do Rio Grande do Norte','UFRN','RN'],
  ['Universidade Federal do Rio Grande do Sul','UFRGS','RS'],
  ['Universidade Federal do Rio de Janeiro','UFRJ','RJ'],
  ['Universidade Federal do Sul da Bahia','UFSB','BA'],
  ['Universidade Federal do Sul e Sudeste do Maranhão','UFSSMA','MA'],
  ['Universidade Federal do Sul e Sudeste do Pará','UNIFESSPA','PA'],
  ['Universidade Federal do Tocantins','UFT','TO'],
  ['Universidade Federal do Triângulo Mineiro','UFTM','MG'],
  ['Universidade Federal do Vale do São Francisco','UNIVASF','PE'],
  ['Universidade Federal dos Vales do Jequitinhonha e Mucuri','UFVJM','MG'],
  ['Universidade Feevale','FEEVALE','RS'],
  ['Universidade Gama Filho','UGF','RJ'],
  ['Universidade Ibirapuera','UNIB','SP'],
  ['Universidade Iguaçu','UNIG','RJ'],
  ['Universidade José do Rosário Vellano','UNIFENAS','MG'],
  ['Universidade Luterana do Brasil','ULBRA','RS'],
  ['Universidade Metodista de Piracicaba','UNIMEP','SP'],
  ['Universidade Metodista de São Paulo','UMESP','SP'],
  ['Universidade Norte do Paraná','UNOPAR','PR'],
  ['Universidade Nove de Julho','UNINOVE','SP'],
  ['Universidade Paulista','UNIP','SP'],
  ['Universidade Positivo','UP','PR'],
  ['Universidade Potiguar','UnP','RN'],
  ['Universidade Presbiteriana Mackenzie','Mackenzie','SP'],
  ['Universidade Regional Integrada do Alto Uruguai e das Missões','URI','RS'],
  ['Universidade Regional de Blumenau','FURB','SC'],
  ['Universidade Regional do Noroeste do Estado do RS','UNIJUÍ','RS'],
  ['Universidade Salgado de Oliveira','UNIVERSO','RJ'],
  ['Universidade Salvador','UNIFACS','BA'],
  ['Universidade São Francisco','USF','SP'],
  ['Universidade São Judas Tadeu','USJT','SP'],
  ['Universidade Tecnológica Federal do Paraná','UTFPR','PR'],
  ['Universidade Tuiuti do Paraná','UTP','PR'],
  ['Universidade Uninter','UNINTER','PR'],
  ['Universidade Vale do Rio Doce','UNIVALE','MG'],
  ['Universidade Veiga de Almeida','UVA-RJ','RJ'],
  ['Universidade da Integração Internacional da Lusofonia Afro-Brasileira','UNILAB','CE'],
  ['Universidade da Região de Joinville','UNIVILLE','SC'],
  ['Universidade de Brasília','UnB','DF'],
  ['Universidade de Caxias do Sul','UCS','RS'],
  ['Universidade de Cuiabá','UNIC','MT'],
  ['Universidade de Fortaleza','UNIFOR','CE'],
  ['Universidade de Passo Fundo','UPF','RS'],
  ['Universidade de Pernambuco (privadas assoc.)','','PE'],
  ['Universidade de Ribeirão Preto','UNAERP','SP'],
  ['Universidade de Santa Cruz do Sul','UNISC','RS'],
  ['Universidade de Sorocaba','UNISO','SP'],
  ['Universidade de São Paulo','USP','SP'],
  ['Universidade de Taubaté','UNITAU','SP'],
  ['Universidade do Estado da Bahia','UNEB','BA'],
  ['Universidade do Estado de Mato Grosso','UNEMAT','MT'],
  ['Universidade do Estado de Minas Gerais','UEMG','MG'],
  ['Universidade do Estado de Santa Catarina','UDESC','SC'],
  ['Universidade do Estado do Amazonas','UEA','AM'],
  ['Universidade do Estado do Pará','UEPA','PA'],
  ['Universidade do Estado do Rio Grande do Norte','UERN','RN'],
  ['Universidade do Estado do Rio de Janeiro','UERJ','RJ'],
  ['Universidade do Extremo Sul Catarinense','UNESC','SC'],
  ['Universidade do Oeste de Santa Catarina','UNOESC','SC'],
  ['Universidade do Sul de Santa Catarina','UNISUL','SC'],
  ['Universidade do Vale do Itajaí','UNIVALI','SC'],
  ['Universidade do Vale do Paraíba','UNIVAP','SP'],
  ['Universidade do Vale do Rio dos Sinos','UNISINOS','RS']
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
   * Busca instituições por termo (nome ou sigla), ignorando acentos/caixa.
   * @param {string} termo
   * @param {number} limite
   * @returns {Array<{nome:string, sigla:string, uf:string}>}
   */
  function buscarInstituicoes(termo, limite = 8) {
    const t = normalizar(termo);
    if (!t || t.length < 2) return [];

    const palavras = t.split(/\s+/).filter(Boolean);

    const resultados = [];
    for (let i = 0; i < INSTITUICOES.length; i++) {
      const [nome, sigla, uf] = INSTITUICOES[i];
      const nomeNorm = normalizar(nome);
      const siglaNorm = normalizar(sigla);

      let score = -1;
      if (siglaNorm === t) score = 0;
      else if (siglaNorm.startsWith(t)) score = 1;
      else if (nomeNorm.startsWith(t)) score = 2;
      else if (nomeNorm.includes(' ' + t)) score = 3;
      else if (nomeNorm.includes(t) || siglaNorm.includes(t)) score = 4;
      else if (palavras.length > 1 && palavras.every(p => nomeNorm.includes(p))) score = 5;

      if (score >= 0) resultados.push({ nome, sigla, uf, score });
    }

    resultados.sort((a, b) => a.score - b.score || a.nome.localeCompare(b.nome, 'pt-BR'));
    return resultados.slice(0, limite);
  }

  global.SLC_Universidades = { buscarInstituicoes, INSTITUICOES };
})(typeof window !== 'undefined' ? window : this);
