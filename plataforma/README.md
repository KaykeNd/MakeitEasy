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

O catálogo atual apresenta assuntos em preparação. Aulas, progresso, avaliações, Firestore, Storage e painel administrativo serão desenvolvidos nas próximas etapas.
