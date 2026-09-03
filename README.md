# Painel de Sistemas e Relatórios

PWA administrativo para acompanhar sistemas, mensalidades, custos internos, ampliações de escopo e relatórios mensais para clientes.

## O que já está funcionando

- Login administrativo com Firebase Authentication.
- Cadastro e edição de sistemas.
- Mensalidade base + acréscimos mensais por novas funcionalidades/módulos.
- Custo interno, margem bruta e percentual de uso da infraestrutura.
- Disponibilidade, atendimentos e atualizações mensais.
- Cálculo automático do percentual do ciclo mensal.
- Relatório público sanitizado, sem custo interno, margem ou observações administrativas.
- Link individual por token para envio ao cliente.
- Compartilhamento por WhatsApp.
- Impressão / salvar como PDF pelo navegador.
- PWA instalável e com atualização de cache.

## Firebase usado no projeto

O código está configurado com o projeto informado:

`pontoonline-89b2c`

> ATENÇÃO: pelo nome do projeto, ele pode ser um Firebase já utilizado pelo sistema Ponto Online. Se for compartilhado com outro sistema, NÃO substitua as regras atuais do Firestore pelo arquivo `firestore.rules` deste repositório sem antes mesclar as regras. Substituir as regras inteiras pode bloquear coleções usadas pelo outro sistema.

## 1. Ativar Authentication

No Firebase Console:

1. Abra **Authentication**.
2. Clique em **Começar**.
3. Em **Sign-in method**, habilite **E-mail/senha**.
4. Em **Users**, clique em **Add user**.
5. Crie o usuário que será o administrador do painel.
6. Copie o **UID** desse usuário.

## 2. Criar o primeiro administrador

No Firestore, crie a coleção:

`admins`

Crie um documento cujo **ID seja exatamente o UID** copiado do Authentication.

Exemplo:

```text
admins
  └── UID_DO_USUARIO
        nome: "Eliel"
        role: "admin"
        ativo: true
```

O conteúdo dos campos pode variar. Para liberar o acesso, o importante nesta primeira versão é existir um documento em `admins` com o mesmo ID do UID autenticado.

## 3. Firestore

Se este Firebase for exclusivo para este projeto, as regras sugeridas estão no arquivo:

`firestore.rules`

Elas deixam:

- `systems`: somente administrador.
- `reports`: somente administrador.
- `admins`: usuário autenticado só consulta o próprio registro.
- `publicReports`: leitura de um relatório específico permitida por token; listagem bloqueada.

Se o Firebase for compartilhado com outro sistema, copie somente os blocos necessários e preserve as regras das coleções já existentes.

## 4. Coleções criadas automaticamente

Após o primeiro uso, o sistema passa a trabalhar com:

```text
admins/
systems/
reports/
publicReports/
```

### systems

Guarda os dados internos completos, incluindo:

- cliente;
- sistema;
- mensalidade base;
- custo interno;
- margem calculada;
- uso da infraestrutura/banco;
- disponibilidade;
- suporte;
- atualizações;
- evoluções de escopo;
- observações internas.

### publicReports

Recebe somente um snapshot seguro para o cliente. O custo interno e a margem não são gravados nessa coleção.

## 5. Como funciona o aumento da mensalidade

Cada sistema possui uma `mensalidade base`.

Quando uma nova funcionalidade passa a integrar permanentemente o sistema, é cadastrada como uma evolução com um `acréscimo mensal`.

Exemplo:

```text
Mensalidade base                         R$ 500
Relatório gerencial                    + R$ 50
Integração adicional                   + R$ 80
------------------------------------------------
Mensalidade atual                        R$ 630
```

O relatório do cliente apresenta essas alterações como ampliações permanentes de escopo mantido, não como cobrança de hora de desenvolvimento.

## 6. Relatório do cliente

Ao clicar em **Gerar relatório**, o sistema cria um snapshot daquele momento e gera um link como:

```text
https://seu-endereco/?relatorio=TOKEN_ALEATORIO
```

Nesse endereço o cliente vê:

- mensalidade atual;
- percentual do ciclo mensal;
- uso da infraestrutura/banco;
- disponibilidade;
- atendimentos;
- atualizações;
- evoluções incorporadas;
- serviços mantidos na mensalidade.

Ele não vê:

- custo real do Firebase;
- custo interno;
- margem;
- lucro;
- observações administrativas.

## 7. Publicar no GitHub Pages

No GitHub:

1. Abra **Settings** do repositório.
2. Entre em **Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha a branch `main` e a pasta `/ (root)`.
5. Salve.

Depois da publicação, o PWA poderá ser instalado pelo navegador compatível.

## Próximas evoluções recomendadas

- Fechamento mensal por competência.
- Histórico de valores e reajustes.
- Pagamentos: pago, pendente e vencido.
- Reajuste anual por índice ou valor manual.
- Relatórios personalizados com logo do cliente.
- Revogação de links públicos.
- Vencimento automático dos links.
- Painel de custos por categoria.
- Exportação PDF com layout próprio.
- Dashboard anual de receita e lucro.
