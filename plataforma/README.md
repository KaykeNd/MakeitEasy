# Make it Easy

Base da plataforma de cursos de inglês, usando Next.js, TypeScript, Tailwind CSS e Firebase Authentication.

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse http://localhost:3000.

## Autenticação

1. Crie um projeto no Firebase e registre um aplicativo web.
2. No Firebase Authentication, habilite o provedor de e-mail e senha.
3. Crie `.env.local` a partir de `.env.example` e preencha as configurações do aplicativo web fornecidas pelo Firebase.
4. Reinicie o servidor de desenvolvimento.

As variáveis `NEXT_PUBLIC_` são configurações públicas do aplicativo web, não credenciais administrativas. A autenticação fica indisponível até que sejam configuradas. Regras de segurança do Firebase devem ser configuradas antes de usar banco de dados ou armazenamento.

## Login com Google

No Firebase Console, em Authentication > Sign-in method, ative o provedor Google e configure o e-mail de suporte. Em Authentication > Settings > Authorized domains, inclua os domínios usados pelo site, incluindo `localhost` para testes locais, se necessário. A conta Google é vinculada pelo Firebase Authentication; quando já existe uma conta com o mesmo e-mail usando outro provedor, entre primeiro com o método existente.

## Painel administrativo

O painel em `/admin` usa o Firebase Admin SDK no servidor e exige o atributo personalizado `admin: true` na conta do usuário. Cada operação verifica o token, a revogação e o privilégio atual diretamente no Firebase Authentication. O painel permite cadastrar, editar, publicar e excluir cursos, além de listar, desativar e reativar contas. Contas administradoras não podem ser desativadas pelo painel. A listagem mostra 100 contas por página e até 200 cursos.

A conta `kaykedeveliz@gmail.com` recebe o privilégio automaticamente depois de entrar com Google, desde que o e-mail esteja verificado e as credenciais do Admin SDK estejam configuradas no servidor. A verificação é feita no servidor, não pelo e-mail informado na interface. Se já estiver conectado antes de configurar as credenciais, saia e entre novamente com Google.

Para configurar localmente:

1. Crie um banco Cloud Firestore no mesmo projeto Firebase. Revise as regras de segurança antes de disponibilizar o banco: as rotas do servidor usam o Admin SDK e ignoram as regras; as regras devem impedir que clientes modifiquem diretamente `courses` ou acessem dados privados sem autorização. Não use regras abertas em produção.
2. Em Configurações do projeto > Contas de serviço, gere uma chave para o Admin SDK. Guarde o arquivo JSON fora do repositório, com acesso restrito; nunca coloque a chave em variáveis `NEXT_PUBLIC_` ou a envie pelo chat. Para produção, prefira credenciais gerenciadas do ambiente de hospedagem.
3. Configure `GOOGLE_APPLICATION_CREDENTIALS` no ambiente do servidor com o caminho absoluto do arquivo. A conta de serviço deve ter permissões para administrar usuários do Firebase Authentication e ler e gravar no Firestore.
4. Crie ou entre com a conta que será administradora e encontre seu UID em Authentication > Users. No terminal da pasta `plataforma`, execute:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\caminho\fora-do-projeto\conta-de-servico.json'
node scripts/set-admin.mjs UID_DO_USUARIO
npm run dev
```

O usuário precisa sair e entrar novamente após receber o privilégio. Use o mesmo ambiente com `GOOGLE_APPLICATION_CREDENTIALS` ao iniciar o servidor. Na Vercel ou outro serviço, configure as credenciais do servidor pelo mecanismo seguro do provedor, sem incluí-las no código ou no cliente.

## Área do professor e avaliações

Em `/admin`, crie e publique um curso. Em `/professor`, selecione o curso e crie módulos com blocos de texto, imagem, videoaula, material e até 25 questões de múltipla escolha. Segure o puxador do bloco por três segundos para arrastá-lo ou use as setas e o campo de posição para definir a sequência em que aparecem para o aluno; depois, salve o módulo. Imagens, vídeos e materiais usam links HTTPS. Marque uma alternativa correta e adicione uma explicação para cada questão. O professor pode editar e excluir módulos e consultar as últimas 200 avaliações na aba Resultados. Os módulos criados antes da edição por blocos são convertidos automaticamente ao abrir ou salvar.

O catálogo direciona os alunos à página do curso publicado. Os blocos aparecem na ordem definida pelo professor; as respostas das questões são enviadas juntas ao final do módulo. Após entrar na plataforma, o aluno pode enviar as respostas, receber nota e correção com explicações e consultar até 200 tentativas. O servidor valida e corrige as respostas; o gabarito não é enviado antes da submissão. Alterar um módulo durante uma tentativa exige recarregar a página. Excluir um curso também exclui seus módulos, mas mantém os resultados já registrados.

Os cursos publicados e seus links são públicos. Vídeos e materiais devem estar hospedados em URLs HTTPS; ainda não há upload para Firebase Storage. O servidor acessa o Firestore com o Admin SDK e ignora regras de segurança: mantenha as regras de acesso direto restritivas para `courseModules` (gabaritos), `quizAttempts` e as demais coleções. Nunca permita leitura ou escrita direta irrestrita nesses dados.

Para verificar localmente as regras de validação e correção:

```powershell
node --test --experimental-strip-types tests/learning.test.mjs
```
