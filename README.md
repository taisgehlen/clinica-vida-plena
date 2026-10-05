# Clínica Vida Plena — faltas, indicadores e antecipação de consultas

<div align="justify">

A Clínica Vida Plena perde cerca de um terço das consultas para faltas. Este projeto faz duas coisas: organiza o histórico de agendamentos para entender **por que** os pacientes faltam (Parte 1) e usa essa resposta para **reduzir as faltas** com confirmação de presença e antecipação automática de consultas (Parte 2).

Feito com Node.js + TypeScript (Express, Mongoose e Zod), MongoDB e React + TypeScript (Vite, Tailwind e Axios), rodando com Docker.

## Sumário

1. [Como rodar, importar os dados e executar os testes](#1-como-rodar-importar-os-dados-e-executar-os-testes)
2. [O que os dados mostraram](#2-o-que-os-dados-mostraram)
3. [Decisões para os 5 pontos da Parte 1](#3-decisões-para-os-5-pontos-da-parte-1)
4. [O que construí na Parte 2](#4-o-que-construí-na-parte-2)
5. [Quantas faltas por mês a proposta deve evitar](#5-quantas-faltas-por-mês-a-proposta-deve-evitar)
6. [Como saber, em 3 meses, se funcionou](#6-como-saber-em-3-meses-se-funcionou)
7. [O que ficou de fora e riscos](#7-o-que-ficou-de-fora-e-riscos)
8. [Como usei IA e onde precisei corrigir](#8-como-usei-ia-e-onde-precisei-corrigir)

---

## 1. Como rodar, importar os dados e executar os testes

Com o Docker instalado, basta um comando na raiz do projeto:

```bash
docker compose up --build
```

Quando o log mostrar `API rodando em http://localhost:3000`, abra **http://localhost:5173**. Use `localhost`, e não `127.0.0.1`, porque a API só aceita pedidos vindos desse endereço.

A importação acontece sozinha na primeira subida: o backend lê `data/agendamentos.csv` e `data/medicos.json`, limpa os dados e grava no banco. Tudo o que foi descartado ou corrigido fica registrado, linha a linha e com o motivo, em `backend/reports/import-report.json`. Nas subidas seguintes a importação não roda de novo, para não apagar consultas criadas depois. Para começar do zero, use `docker compose down -v`.

Para rodar os testes:

```bash
cd backend && npm test -- --run     # 225 testes
cd frontend && npm test -- --run    # 65 testes
```

Sem Docker, é preciso Node.js 22 e um MongoDB em `localhost:27017`. No backend, `npm install`, `npm run import` e `npm start`; no frontend, `npm install` e `npm run dev`.

### Como testar a Parte 2

As consultas futuras do CSV vão até 18/11/2026, e o sistema usa o relógio real.

1. Abra **Confirmações e vagas**. Em até um minuto aparecem os primeiros pedidos de confirmação.
2. Em **Mensagens enviadas**, clique em **Simular paciente** para ver o WhatsApp do paciente e responder por ele.
3. Em **Todas as consultas**, cancele uma consulta como “Paciente cancelou”. O horário vira uma vaga e o convite vai para o primeiro da fila.
4. No convite, clique em **Ver horário e confirmar** e aceite. A consulta muda de data e o horário antigo é oferecido ao próximo.

Para ver um convite expirar sem esperar duas horas: `OFFER_TTL_MINUTES=2 docker compose up --build`.

Os indicadores da Parte 1 ficam na primeira tela, **Indicadores de falta**, com filtro de período.

O WhatsApp é simulado: as mensagens ficam guardadas no banco e aparecem na tela, porque o envio real tem custo e o avaliador não teria como testar.

---

## 2. O que os dados mostraram

O arquivo tem 7.359 linhas, das quais **7.223 foram importadas**. As consultas vão de setembro de 2025 a novembro de 2026, e usei o último agendamento registrado (24/09/2026) para separar passado e futuro.

A taxa de falta é de **cerca de 31%**, o que dá **cerca de 166 faltas por mês**. Contando os cancelamentos, fica perto dos 28% que a clínica citou.

O que mais chamou atenção foi a **antecedência**. Quem marca para os próximos 3 dias falta 14% das vezes; para daqui a 1 ou 2 semanas, 35%; para mais de 2 semanas, entre 40% e 45%. As consultas marcadas com 15 dias ou mais somam **metade de todas as faltas**.

Comparando com o que a equipe disse:

- A **Dra. Marta** tem razão: os pacientes esperam muito, e quanto maior a espera, maior a falta.
- O **Dr. Paulo** também: segunda de manhã ele tem 58% de falta. Mas o problema é da clínica toda nesse turno (46,6%), não só dele.
- Paciente novo falta mais, como ele disse, mas a diferença é moderada: 37% contra 30%.
- A **Juliana** não tem razão: convênio e particular faltam praticamente igual (32% e 31%).

Dois achados foram importantes para as decisões. Primeiro, quem já faltou muito não falta tanto mais que os outros (38% contra 30%). Segundo, a agenda não está lotada: 65% dos horários da grade estão ocupados, e só 54% dos horários cancelados voltam a ser usados.

---

## 3. Decisões para os 5 pontos da Parte 1

**1. Cancelamento em cima da hora conta como falta?**
Não. Falta é só quando o paciente não aparece. O que realmente prejudica a clínica é o horário ficar vazio, então em vez de escolher um prazo arbitrário, como 24h, eu meço isso diretamente: se ninguém ocupou o horário cancelado, ele conta como horário perdido. O CSV não diz quando o cancelamento foi feito, por isso essa foi a forma de usar o histórico. Daqui para frente, o sistema guarda a data do cancelamento.

**2. Consultas canceladas entram na taxa de falta?**
Não. Separei em duas taxas, porque elas respondem a perguntas diferentes:

```
taxa de falta           = faltas ÷ (realizadas + faltas)
taxa de horário perdido = (faltas + cancelamentos do paciente não reaproveitados)
                          ÷ (realizadas + faltas + cancelamentos do paciente)
```

A primeira diz quanto os pacientes deixam de vir; a segunda, quanto da agenda fica ociosa.

**3. “Primeira consulta” é na clínica ou com aquele médico?**
Na clínica. O efeito de ser novo vem do vínculo com a clínica (37% de falta contra 30%); com um médico específico a diferença é menor (33% contra 29%). Também é o que a recepção consegue identificar na hora de agendar. Uma limitação: quem já era paciente antes de setembro de 2025 aparece como novo.

**4. Registros duplicados ou conflitantes: qual vale?**
Quando duas linhas são idênticas, mantenho uma (40 casos). Quando o mesmo ID aparece com informações diferentes, descarto todas as versões (25 IDs). Se uma linha diz que o paciente veio e outra que faltou, escolher uma seria inventar um dado que vai direto para a taxa de falta.

**5. Pacientes que faltam com frequência.**
O sistema mostra quem tem 3 faltas ou mais, para a recepção dar atenção a eles, mas sem bloqueio nem multa. Como quem faltou muito não falta tanto mais que os outros, uma punição atingiria muita gente que viria. O que mais explica a falta é a antecedência, e foi nela que foquei a Parte 2.

Além desses pontos, a importação corrige grafias diferentes de status, tipo de atendimento e telefone, e descarta registros impossíveis, como consulta “realizada” no futuro. Conflitos antigos de horário foram mantidos com aviso, porque fazem parte do histórico.

---

## 4. O que construí na Parte 2

Se metade das faltas vem de quem marcou com muita antecedência, e quase metade dos horários cancelados fica vazia, a ideia foi atacar os dois lados: **lembrar quem marcou há muito tempo** e **trazer para mais perto quem está esperando**. A tela **Confirmações e vagas** junta as duas coisas.

**Confirmação de presença.** Quem marcou com 15 dias ou mais recebe uma mensagem no WhatsApp dois dias antes, pedindo para confirmar. Se não responder, recebe um segundo lembrete na véspera. Se ainda assim não responder, aparece na lista **“Sem resposta · ligar”** da recepção. O sistema nunca cancela sozinho: quando o paciente responde “Não poderei ir”, ele pergunta antes se pode cancelar.

**Antecipação de consultas.** Quando um paciente cancela, o horário vira uma vaga e o sistema convida automaticamente quem tem a consulta mais distante com o mesmo médico. O convite chega pelo WhatsApp com um link para uma página feita para o celular, onde o paciente vê o novo horário e aceita. Depois de aceitar, ele pode salvar a consulta na agenda pessoal (Google Agenda, Outlook ou a agenda do celular), já com lembretes, o que reforça o aviso e diminui a chance de esquecer a nova data. Ele tem duas horas para responder; se recusar ou não responder, o convite passa para o próximo. Quando aceita, o horário antigo dele vira uma nova vaga e o ciclo continua. Só entra na fila quem ganha pelo menos um dia, e cancelamentos feitos pela clínica não abrem vaga, porque normalmente o médico não vai atender.

Algumas escolhas que eu considero importantes: o link do paciente é único e difícil de adivinhar; se o paciente tocar duas vezes em “aceitar”, só a primeira vale; e as regras de tempo são testadas simulando o relógio, sem precisar esperar dias.

**O que eu espero:** menos faltas entre quem marca com antecedência, mais horários cancelados sendo usados e pacientes sendo atendidos mais cedo. Tudo isso sem aumentar o trabalho das duas recepcionistas, que só precisam agir nos casos de “ligar”.

---

## 5. Quantas faltas por mês a proposta deve evitar

Minha estimativa é de **cerca de 20 faltas a menos por mês**, o que levaria a taxa de 31% para perto de 28%.

A conta parte do grupo que recebe a confirmação. Consultas marcadas com 15 dias ou mais têm **82 faltas por mês** em média. Quase todos esses pacientes têm telefone cadastrado (98%). A minha hipótese é que **25% dessas faltas** deixem de acontecer, seja porque o paciente lembra e vem, seja porque avisa que não pode ir:

**82 × 0,98 × 0,25 ≈ 20 faltas a menos por mês**

Escolhi 25% por ser um número conservador. O lembrete chega dois dias antes, tem uma segunda tentativa e uma ligação no fim, mas parte dos pacientes vai ignorar as mensagens. A faixa que considero realista vai de 12 a 30 faltas por mês.

Tem um detalhe importante: quem avisa que não vem deixa de ser falta, mas o horário só deixa de ser perdido se alguém ocupar a vaga. Por isso a antecipação vem junto. Hoje, cerca de 16 horários cancelados por mês ficam vazios; somando os novos avisos, se metade for ocupada pela antecipação, são **cerca de 10 horários recuperados por mês**.

---

## 6. Como saber, em 3 meses, se funcionou

O painel de indicadores da Parte 1 já mostra a falta mês a mês e por antecedência, então a maior parte da comparação pode ser feita na própria ferramenta:

| O que olhar | Hoje | Funcionou se |
| --- | --- | --- |
| Falta de quem marca com 15 dias ou mais | 43% | cair para 35% ou menos |
| Falta geral | ~31% | chegar perto de 28% |
| Horário perdido (disponível na API de indicadores) | ~32% | cair |
| Pacientes que respondem à confirmação | — | a maioria responder |
| Vagas ocupadas por antecipação | — | pelo menos metade |

Para ter certeza de que a melhora vem da proposta, e não de uma época melhor do ano, dá para comparar com quem marca com menos de 15 dias, que não recebe a confirmação. Se só o grupo que recebeu a mensagem melhorar, o efeito é da proposta. Se nada mudar, a próxima hipótese a testar são as segundas de manhã.

---

## 7. O que ficou de fora e riscos

**O que ficou de fora**

O envio real pelo WhatsApp ficou de fora porque tem custo e exige uma conta comercial aprovada. O sistema já decide quem recebe, quando e o que acontece com a resposta; só a entrega no celular é simulada. Também não fiz login, que o desafio dispensou, nem uma lista só com as consultas confirmadas, que hoje aparecem junto com as outras.

**Riscos da proposta**

- **Pacientes que ignoram mensagens.** A estimativa depende de os pacientes responderem. Se a maioria ignorar, o efeito será menor que 20 faltas por mês, e a medição da seção 6 vai mostrar isso.
- **Cancelar fica fácil demais.** Facilitar o aviso pode aumentar os cancelamentos. Isso só é bom se o horário for reaproveitado, por isso a taxa de horário perdido precisa ser acompanhada junto com a de falta.
- **Excesso de mensagens.** Muitas mensagens podem incomodar. Por isso o pedido vai só para quem marcou com antecedência, com no máximo duas mensagens.
- **Recepção sobrecarregada.** Se muitos pacientes caírem em “ligar”, a recepção pode não dar conta. Vale acompanhar quantos casos aparecem por dia.
- **Privacidade.** O sistema lida com nome e telefone de pacientes. Em produção, seria preciso pedir o consentimento para as mensagens e cuidar do acesso aos dados.

---

## 8. Como usei IA e onde precisei corrigir

Usei o Claude como par de programação durante todo o projeto: para explorar o CSV, discutir as regras, gerar o código com testes, revisar e montar protótipos de tela em baixa fidelidade para eu escolher. Venho do front-end, então usei a IA também para aprender o backend, pedindo a explicação de cada escolha antes de aceitá-la. As decisões de negócio foram minhas, e todo arquivo foi lido e testado antes de entrar no projeto.

**Onde a IA errou.** Todos os erros abaixo foram corrigidos:

- **Datas invertidas:** na análise inicial, ela leu dia e mês trocados e apontou 1.655 agendamentos feitos depois da consulta; o número real era 10.
- **Conclusões apressadas:** sugeriu agir sobre pacientes reincidentes, mas uma análise mais cuidadosa mostrou que eles concentram faltas porque têm muitas consultas, não porque faltem mais. Também errou a ocupação da agenda (67% em vez de 65%).
- **Testes e ambiente:** garantiu que a proteção contra clique duplo estava provada, mas o teste tinha sido feito num banco que não servia para isso. Sugeriu um endereço de acesso que quebrava a conexão com a API. E o Docker só funcionava porque uma pasta já existia na minha máquina, o que apareceu quando recriei o ambiente do zero.
- **Situações de borda:** quando pedi esses testes, apareceram cinco falhas na Parte 2, como um lembrete sendo enviado para quem a recepção já tinha confirmado.

**Minhas contribuições**

A ideia central da Parte 2 foi minha: antecipar consultas de forma automática quando alguém cancela. Também sugeri que o paciente pudesse salvar a consulta confirmada na própria agenda (Google, Outlook ou celular), para que ela funcione como mais um lembrete e diminua as chances de esquecimento.

Antes de construir a Parte 2, quis validar se a ideia cumpria o que o desafio pedia e pedi uma revisão crítica do projeto. Com ela, percebi que só antecipar não reduzia a falta de quem marca com muita antecedência, que é metade das faltas. Por isso acrescentei a confirmação de presença e defini as regras dela.

Nas regras, defini o ganho mínimo de um dia para antecipar (a sugestão era de três), o segundo lembrete pelo WhatsApp antes de a recepção ligar e que só o cancelamento feito pelo paciente abre vaga. Também perguntei como aplicar a regra das 24h se o CSV não registra quando o cancelamento aconteceu, e essa pergunta mudou a abordagem para medir se o horário foi reaproveitado.

No código e na interface, escolhi organizar o backend por módulo, levei a validação para `utils/` para ser reaproveitada por todos os módulos e usei o Axios, mesmo com a IA recomendando o `fetch`. Também perguntei se a segurança estava sendo considerada, o que trouxe a validação de entrada com Zod, o CORS restrito e o container sem root, e escolhi o Recharts para os dois gráficos do painel. Validei e simplifiquei os textos da tela, escolhi os layouts entre opções de protótipo e verifiquei a acessibilidade da interface: navegação por teclado, nomes claros para leitores de tela e avisos de erro anunciados automaticamente.

O `docker compose`, os testes com banco real e um clone limpo do repositório foram validados por mim, na minha máquina.
