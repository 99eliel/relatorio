# Painel de Sistemas e Relatórios

PWA administrativo para controlar mensalidades, custos internos, ampliações de escopo, indicadores técnicos e relatórios mensais para clientes.

## Funcionalidades atuais

- Login administrativo com Firebase Authentication.
- Cadastro e edição de sistemas.
- Mensalidade base + acréscimos mensais por novas funcionalidades.
- Custo interno e margem bruta somente na área administrativa.
- Uso da infraestrutura/banco, disponibilidade, atendimentos e atualizações.
- Percentual automático do ciclo mensal.
- Relatório do cliente sem custo interno, margem ou observações privadas.
- Link individual para compartilhamento.
- Compartilhamento por WhatsApp.
- Impressão / salvar em PDF pelo navegador.
- PWA instalável.

## Firebase

Este Firebase será usado exclusivamente pelo Painel de Sistemas e Relatórios.

Projeto configurado no app:

`pontoonline-89b2c`

### Coleções

```text
usuarios/
sistemas/
relatorios/
relatorios_publicos/
```

### usuarios

O usuário administrativo deve existir no Firebase Authentication e também possuir um documento em `usuarios`.

O ID do documento deve ser exatamente o UID do Authentication:

```text
usuarios
  └── UID_DO_AUTHENTICATION
        nome: "Eliel"
        role: "admin"
        ativo: true
```

O sistema considera o usuário autorizado quando existe um documento `usuarios/{UID}`. Nas regras do Firestore, um usuário com `ativo: false` perde acesso aos dados administrativos.

### sistemas

Guarda os dados internos do contrato:

- cliente;
- nome do sistema;
- mensalidade base;
- custo interno;
- uso da infraestrutura/banco;
- disponibilidade;
- atendimentos;
- atualizações;
- ampliações de escopo;
- acréscimos mensais;
- observações administrativas.

### relatorios

Guarda os snapshots administrativos dos relatórios gerados. Dessa forma, alterações futuras no contrato não modificam relatórios de competências antigas.

### relatorios_publicos

Guarda apenas os dados necessários para o relatório compartilhado com o cliente. Não recebe custo interno, lucro, margem ou observações privadas.

## Regras do Firestore

Como o Firebase agora é exclusivo deste projeto, o conteúdo do arquivo `firestore.rules` pode ser utilizado como conjunto completo de regras do banco.

No Firebase Console:

1. Abra **Firestore Database**.
2. Entre em **Rules**.
3. Substitua pelas regras do arquivo `firestore.rules` deste repositório.
4. Clique em **Publish**.

## Authentication

1. Abra **Authentication** no Firebase Console.
2. Ative **E-mail/senha**.
3. Crie o usuário administrador.
4. Copie o UID.
5. Use esse UID como ID do documento correspondente na coleção `usuarios`.

## Aumento de mensalidade por ampliação de escopo

Cada contrato possui uma mensalidade base. Quando uma nova função passa a integrar permanentemente o sistema, ela é cadastrada como uma evolução com acréscimo mensal.

```text
Mensalidade base                         R$ 500
Relatório gerencial                    + R$ 50
Integração adicional                   + R$ 80
------------------------------------------------
Mensalidade atual                        R$ 630
```

No relatório do cliente, essas alterações aparecem como ampliações permanentes do escopo mantido, e não como cobrança de horas de desenvolvimento.

## Relatório do cliente

Ao gerar um relatório, o sistema cria um snapshot e um endereço semelhante a:

```text
https://seu-endereco/?relatorio=TOKEN_ALEATORIO
```

O cliente pode visualizar:

- mensalidade atual;
- ciclo mensal;
- uso da infraestrutura;
- disponibilidade;
- atendimentos;
- atualizações;
- evoluções incorporadas;
- serviços mantidos no contrato.

Não são exibidos:

- custo real de infraestrutura;
- custo interno;
- margem;
- lucro;
- observações administrativas.

## Publicação no GitHub Pages

1. Abra **Settings** no repositório.
2. Entre em **Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione `main` e `/ (root)`.
5. Salve.

## Próximas evoluções

- fechamento mensal por competência;
- pagamentos pago / pendente / vencido;
- histórico de reajustes;
- custos por categoria;
- relatórios personalizados com logo;
- revogação e vencimento de links públicos;
- exportação PDF com layout próprio;
- dashboard anual de receita, custo e margem.
