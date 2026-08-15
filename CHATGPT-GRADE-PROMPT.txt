Leia o arquivo da grade curricular/fluxograma que vou anexar e devolva SOMENTE um JSON válido, sem texto antes ou depois.

Formato obrigatório:
{
  "faculdade": "Nome da faculdade",
  "curso": "Nome do curso",
  "versao": "Opcional",
  "disciplinas": [
    {
      "nome": "Nome da disciplina",
      "codigo": "Opcional",
      "semestre": 1,
      "cargaHoraria": 60,
      "creditos": 4,
      "prerequisitos": ["Disciplina anterior"],
      "tipo": "obrigatoria"
    }
  ]
}

Regras:
- Retorne apenas JSON puro.
- Use a chave "disciplinas".
- Em "semestre", use número quando estiver claro.
- Em "cargaHoraria" e "creditos", use número sem texto.
- Em "prerequisitos", use lista de nomes das disciplinas.
- Se algum dado não aparecer, use string vazia ou 0.
- Não invente disciplinas que não existirem no arquivo.
- Se houver disciplinas optativas/eletivas, em "tipo" use "optativa".

me entregue em arquivo .json
