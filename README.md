# Demografia Demagoga

Site estático sobre demografia e comportamento (DF). Sem build: HTML, CSS e JS puros, com Chart.js em `assets/vendor/`.

## Rodar local

```sh
python3 -m http.server 8000
```

Abrir `http://localhost:8000/`. Alternativa: `index.html` também abre direto via `file://`.

## Testar

```sh
node scripts/test-dados.mjs
node scripts/test-engine.mjs
```

## Publicar (GitHub Pages)

```sh
git init
git add .gitignore .github index.html PLAN.md README.md assets old scripts
git commit -m "Site inicial"
git branch -M main
# criar repo no GitHub e:
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: GitHub Actions**. O workflow `.github/workflows/pages.yml` faz deploy automático no push em `main` (ou via `workflow_dispatch`).

Site publicado em: `https://<user>.github.io/<repo>/`
