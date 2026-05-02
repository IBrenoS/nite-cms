# agents.md — Instruções operacionais para agentes do Portal NITE

> Este arquivo orienta agentes LLM, copilotos, automações e desenvolvedores assistidos por IA durante a execução do Portal NITE.
>
> O `agents.md` não substitui o `specs.md`. Ele define regras objetivas de comportamento, validação, consulta, execução e handoff para impedir desvios de escopo.

---

## 1. Regra principal

Antes de executar qualquer tarefa, todo agente deve:

1. Ler o `specs.md` do início ao fim.
2. Ler este `agents.md` do início ao fim.
3. Verificar `docs/decisions.md`, se existir.
4. Verificar `docs/content-inventory.md`, se existir.
5. Verificar `docs/reference-analysis.md`, se existir.
6. Identificar a milestone atual e suas tarefas, testes e gate de saída.
7. Confirmar que a tarefa solicitada pertence ao escopo definido no `specs.md`.

Nenhum agente deve iniciar implementação, refatoração, copy, motion, SEO, design system ou alteração de conteúdo sem antes consultar o `specs.md`.

---

## 2. Fonte da verdade

A ordem de prioridade das fontes do projeto é:

1. `agents.md` — regras operacionais para agentes.
2. `specs.md` — contrato de escopo, produto, UX, visual, milestones e critérios de validação.
3. `docs/decisions.md` — decisões humanas aprovadas após o spec.
4. `docs/content-inventory.md` — lacunas, placeholders e inventário de conteúdo.
5. `docs/reference-analysis.md` — leitura consolidada das referências visuais.
6. Código-fonte atual.
7. Deploy atual do Portal NITE.

Quando houver conflito entre arquivos:

- não improvisar;
- registrar o conflito em `docs/decisions.md` ou no handoff;
- marcar como `BLOCKED:` se a decisão impedir avanço seguro;
- seguir apenas decisão humana explícita.

---

## 3. Identidade obrigatória do projeto

Todo agente deve preservar estes pontos:

- Nome da marca/núcleo: **NITE**
- Expansão institucional: **Núcleo de Desenvolvimento, Inovação e Tecnologias da UniJorge**
- Produto: **Portal NITE**
- Idioma principal: **Português brasileiro (pt-BR)**
- Direção: **landing institucional com comportamento de produto digital premium**
- Estética: **tech institucional premium**
- Relação com a UniJorge: vínculo institucional, não cópia visual do site institucional da universidade.

O Portal NITE não deve tentar parecer uma página institucional comum da UniJorge. Ele deve ter identidade própria, tecnológica, moderna, sóbria e premium.

---

## 4. Objetivo operacional da v2

A v2 deve deixar a landing praticamente finalizada em:

- arquitetura;
- UX;
- estrutura de seções;
- design system;
- tokens visuais;
- responsividade;
- copy-base;
- SEO;
- motion;
- animação da logo;
- templates de projetos;
- placeholders substituíveis;
- handoff para conteúdo real futuro.

Fotos reais, mockups reais, prints, protótipos, datas históricas, projetos reais, indicadores, parceiros, equipe e evidências podem ficar como lacunas substituíveis, desde que marcadas corretamente.

---

## 5. Regra crítica sobre checkboxes

Agentes não podem marcar checkboxes de tasks, testes, milestones ou checklist final como concluídos sem validação humana explícita.

### O agente pode

- implementar a tarefa;
- executar testes;
- coletar evidências;
- criar relatório de validação;
- sugerir que um checkbox seja marcado;
- escrever `READY-FOR-HUMAN-VALIDATION`;
- listar checkboxes candidatos à aprovação.

### O agente não pode

- trocar `[ ]` por `[x]` por conta própria;
- concluir milestone apenas porque os testes passaram;
- assumir aprovação humana implícita;
- marcar milestone como finalizada sem aceite do gestor;
- avançar para a próxima milestone sem gate validado.

### Formato recomendado de solicitação de validação

```md
## READY-FOR-HUMAN-VALIDATION

Milestone: Mx — Nome da milestone

Tarefas implementadas:
- [ ] Item do spec que aparenta estar pronto
- [ ] Outro item do spec que aparenta estar pronto

Testes executados:
- `npm run lint` — passou/falhou/não executado
- `npm run typecheck` — passou/falhou/não executado
- `npm run test` — passou/falhou/não executado
- `npm run build` — passou/falhou/não executado
- `npm run test:e2e` — passou/falhou/não executado

Evidências:
- arquivos alterados;
- prints, logs ou resumo técnico;
- observações de QA.

Pendências:
- itens não resolvidos;
- blockers;
- decisões humanas necessárias.
```

Somente após resposta humana explícita, o agente pode atualizar checkboxes no `specs.md`.

---

## 6. Milestones e gates

A ordem das milestones deve seguir o `specs.md`.

Tracker v2 esperado:

- M0 — Alinhamento final, escopo e decisões base
- M1 — Auditoria do estado atual e plano de refatoração
- M2 — Copy, SEO e arquitetura narrativa
- M3 — Design system e tokens visuais
- M4 — Motion system e NITE Ignition
- M5 — Home v2 e seções principais
- M6 — Conteúdo estruturado e placeholders substituíveis
- M7 — Projetos, iniciativas e páginas internas
- M8 — Timeline flexível: processo agora, história depois
- M9 — SEO técnico, acessibilidade e performance
- M10 — QA final, validação e handoff

O agente deve sempre trabalhar na milestone atual, exceto quando o humano solicitar explicitamente outro recorte.

Antes de avançar:

1. tarefas obrigatórias da milestone atual devem estar implementadas;
2. testes da milestone devem ter sido executados ou justificados;
3. gate de saída deve ter sido satisfeito;
4. validação humana deve ter sido registrada;
5. handoff deve estar claro.

---

## 7. Referências obrigatórias

Os agentes devem consultar e considerar as referências abaixo antes de decisões visuais, hero, motion, cards, mockups, microinterações, blocos técnicos ou copy de produto.

### Sites de referência

- Anthropic: https://www.anthropic.com/
- Raycast: https://www.raycast.com/
- Linear: https://linear.app/
- Resend: https://resend.com/

### Como usar as referências

Usar as referências para aprender:

- ritmo visual;
- hierarquia;
- composição;
- motion premium discreto;
- hero escuro;
- mockups;
- interfaces de produto;
- cards;
- transições controladas;
- clareza de copy;
- snippets ou blocos técnicos;
- sensação de app/produto global.

### Como não usar as referências

Não copiar:

- layout exato;
- textos;
- assets;
- animações proprietárias;
- estrutura visual identificável;
- identidade de marca;
- componentes proprietários.

A referência deve inspirar qualidade e direção, não gerar clone.

### Se o agente não tiver acesso à internet

Se não houver acesso às URLs:

1. usar `docs/reference-analysis.md`, se existir;
2. se não existir, criar uma pendência:
   `BLOCKED: referência visual não consultada; criar docs/reference-analysis.md ou validar direção com humano`;
3. não implementar decisões visuais complexas baseadas em suposição.

---

## 8. Direção visual obrigatória

A interface deve seguir a estética **tech institucional premium**:

- fundo escuro;
- brilho azul controlado;
- contraste alto;
- cards com bordas sutis;
- grid/circuitos discretos;
- mockups e blocos visuais de produto;
- motion suave;
- sensação moderna, acadêmica e tecnológica.

Evitar:

- neon exagerado;
- estética gamer;
- excesso de robótica/futurismo genérico;
- efeitos gratuitos;
- 3D pesado sem necessidade;
- aparência governamental/institucional comum;
- imagens genéricas tratadas como evidência real.

---

## 9. Motion e NITE Ignition

A animação da logo é requisito central da v2.

Conceito: **NITE Ignition**

A logo deve funcionar como assinatura visual do Portal NITE, usando a lâmpada, o cérebro e o nome NITE como elemento de ativação.

### Direção da animação

A animação pode incluir:

- estado inicial em baixa intensidade;
- energia subindo pelo bocal da lâmpada;
- ativação do cérebro por pontos/nós luminosos;
- brilho controlado na lâmpada;
- revelação ou acendimento do nome NITE;
- idle loop discreto;
- interação sutil com mouse;
- parallax mínimo no hero;
- fallback estático;
- suporte a `prefers-reduced-motion`.

### Restrições

- não bloquear renderização do hero;
- não prejudicar legibilidade;
- não parecer loading infinito;
- não exigir WebGL na v2;
- não exagerar no brilho;
- não comprometer performance mobile.

---

## 10. Regras de copy

A copy deve ser humana, objetiva, específica e institucionalmente segura.

### Evitar

- frases genéricas de IA;
- promessas sem evidência;
- jargão excessivo;
- linguagem burocrática;
- claims como “maior”, “primeiro”, “líder”, “impacto comprovado” sem validação;
- números, datas ou resultados inventados.

### Priorizar

- clareza;
- contexto;
- ação;
- prática;
- experimentação;
- desenvolvimento;
- inovação;
- tecnologias;
- colaboração acadêmica;
- construção de soluções;
- evolução contínua.

### Descrição institucional base

Quando precisar explicar o NITE, usar como referência:

> O NITE é o Núcleo de Desenvolvimento, Inovação e Tecnologias da UniJorge. Um ambiente voltado à prática, experimentação e construção de soluções, onde tecnologia, colaboração acadêmica e desenvolvimento caminham juntos para transformar aprendizagem em experiência aplicada.

Essa copy pode ser refinada, mas não deve perder precisão institucional.

---

## 11. Regras de placeholders

Placeholders são permitidos porque a v2 deve avançar mesmo antes do inventário completo de projetos, fotos, evidências e datas.

### Placeholders permitidos

- imagens conceituais;
- mockups genéricos;
- prints demonstrativos;
- projetos conceituais;
- timeline processual;
- cards de frentes de atuação;
- blocos técnicos demonstrativos;
- textos não factuais.

### Placeholders proibidos

- datas falsas;
- números falsos;
- nomes de parceiros não confirmados;
- nomes de alunos/professores não validados;
- resultados inventados;
- projetos fictícios apresentados como reais;
- fotos genéricas apresentadas como registro real do NITE.

### Tags obrigatórias

Usar tags rastreáveis:

- `TODO(nite-content):` conteúdo textual oficial pendente;
- `TODO(nite-asset):` foto, mockup, print ou evidência real pendente;
- `TODO(nite-approval):` validação humana/institucional pendente;
- `BLOCKED:` item impedido por falta de decisão;
- `NOTE:` observação para próximo agente.

---

## 12. Projetos, frentes e iniciativas

Até que exista inventário real validado, não confundir frentes com projetos.

### Frentes de atuação

Podem ser usadas para estruturar a landing agora:

- desenvolvimento;
- inovação;
- tecnologias;
- dados e IA;
- robótica;
- prototipação;
- software aplicado;
- colaboração acadêmica.

### Projetos reais

Só devem ser tratados como projetos reais quando houver:

- nome validado;
- descrição validada;
- status validado;
- imagens ou placeholders rastreáveis;
- permissão de publicação;
- informações mínimas de contexto.

### Páginas internas

Podem existir como templates prontos, com dados demonstrativos marcados como substituíveis.

---

## 13. Timeline

Enquanto não houver datas históricas oficiais, usar timeline flexível/processual em vez de timeline histórica falsa.

### Permitido agora

- jornada de trabalho;
- processo do NITE;
- etapas: explorar, prototipar, desenvolver, testar, apresentar, evoluir;
- estrutura pronta para receber eventos reais depois.

### Somente após validação

- data de fundação;
- marcos históricos;
- eventos reais;
- chamadas públicas;
- entregas;
- parcerias;
- resultados.

---

## 14. Regras técnicas

Seguir a stack e os scripts definidos no `specs.md`.

Stack esperada:

- Next.js com App Router;
- TypeScript;
- Tailwind CSS;
- shadcn/ui ou base equivalente;
- Motion/Framer Motion quando agregar valor;
- conteúdo em MDX, JSON tipado ou estrutura equivalente;
- deploy na Vercel.

Scripts mínimos esperados:

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Se algum script não existir, o agente deve:

1. verificar se a milestone exige sua criação;
2. criar quando estiver dentro do escopo;
3. registrar ausência quando não puder criar;
4. nunca afirmar que executou teste que não executou.

---

## 15. Qualidade e testes

Todo agente deve registrar testes executados.

### Testes mínimos por implementação

- lint;
- typecheck;
- build;
- testes unitários quando existirem;
- smoke/e2e quando existirem;
- revisão visual manual quando a tarefa for UI;
- validação de responsividade quando a tarefa impactar layout;
- validação de acessibilidade básica quando houver interação.

### SEO, acessibilidade e performance

Em milestones de hardening, validar:

- `robots.txt`;
- `sitemap.xml`;
- metadata;
- Open Graph;
- canonical;
- JSON-LD quando aplicável;
- headings;
- alt texts;
- foco visível;
- navegação por teclado;
- `prefers-reduced-motion`;
- Lighthouse ou ferramenta equivalente quando disponível.

---

## 16. Handoff obrigatório

Ao finalizar qualquer etapa, o agente deve entregar um handoff com:

```md
## Handoff

### Escopo executado
- ...

### Arquivos criados/alterados
- ...

### Decisões tomadas
- ...

### Testes executados
- ...

### Evidências
- ...

### Checkboxes candidatos à validação humana
- [ ] ...

### Pendências
- ...

### Blockers
- ...

### Próximo passo recomendado
- ...
```

O handoff deve ser objetivo e permitir que outro agente continue sem reabrir discussões já resolvidas.

---

## 17. Proibições

Agentes não devem:

- ignorar o `specs.md`;
- começar pela implementação sem entender a milestone;
- avançar milestones sem gate;
- marcar checkboxes sem validação humana;
- inventar fatos institucionais;
- copiar referências externas;
- transformar a v2 em portal completo;
- adicionar autenticação, CMS, painel administrativo ou área logada sem solicitação explícita;
- adicionar dependências pesadas sem justificativa;
- criar abstrações desnecessárias;
- esconder falhas de teste;
- apagar placeholders sem substituir por conteúdo validado;
- publicar conteúdo institucional duvidoso como definitivo.

---

## 18. Conduta em caso de ambiguidade

Quando houver ambiguidade, o agente deve tentar resolver com base no `specs.md`.

Se ainda houver dúvida:

1. registrar a dúvida;
2. escolher a opção mais conservadora e reversível, se não bloquear o trabalho;
3. usar placeholder rastreável quando for conteúdo;
4. marcar `BLOCKED:` quando a decisão for essencial;
5. pedir validação humana no handoff.

O agente não deve expandir escopo para compensar ambiguidade.

---

## 19. Definition of Done operacional

Uma tarefa só pode ser sugerida como pronta quando:

- foi implementada;
- está alinhada ao `specs.md`;
- não inventa dados;
- não quebra responsividade;
- não quebra acessibilidade básica;
- passou nos testes aplicáveis;
- possui fallback quando necessário;
- usa placeholders rastreáveis quando faltam dados reais;
- foi documentada no handoff.

Uma milestone só pode ser marcada como concluída quando:

- todas as tarefas obrigatórias foram validadas por humano;
- todos os testes da milestone passaram ou foram formalmente aceitos;
- o gate de saída foi validado por humano;
- pendências e blockers foram registrados;
- próximo passo está claro.

---

## 20. Primeira ação de qualquer agente

Ao iniciar uma nova sessão no projeto, responder internamente a estas perguntas antes de editar arquivos:

1. Qual milestone está ativa?
2. Qual tarefa do `specs.md` estou executando?
3. Quais arquivos de referência já li?
4. Essa tarefa depende de validação humana?
5. Há placeholders envolvidos?
6. Há risco de inventar fato institucional?
7. Quais testes vou executar?
8. Qual será o handoff?

Se qualquer resposta estiver incerta, consultar o `specs.md` novamente antes de prosseguir.

---

## 21. Frase-guia do projeto

> Construir o Portal NITE como uma landing institucional premium, com identidade própria, motion controlado, copy humana e estrutura pronta para receber evidências reais depois — sem inventar fatos e sem depender do conteúdo final para evoluir a experiência agora.
