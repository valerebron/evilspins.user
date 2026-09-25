# EvilSpins - Architecture Documentation

## Structure du Projet

EvilSpins est composé de deux repositories distincts :

### evilspins.user
- Application web Nuxt 4
- Vue 3
- Pinia (state management)
- Tailwind CSS
- Frontend

### evilspins.data
- API Node.js
- Express
- PostgreSQL
- Backend/data layer

## Relation entre les composants

```
evilspins.user
       │
       │ HTTP
       ▼
evilspins.data
       │
       ▼
   PostgreSQL
```

## Architecture détaillée

### Frontend (evilspins.user)

#### Technologies
- Nuxt 4 (Vue 3 framework)
- Pinia pour la gestion d'état
- Tailwind CSS pour le style
- Composants Vue modulaires

#### Structure des dossiers
```
app/
├── app.vue
├── components/     # Composants Vue réutilisables
├── composables/    # Fonctions de logique réutilisables
├── layouts/        # Mises en page de l'application
├── pages/          # Pages de l'application
├── plugins/        # Plugins Nuxt
├── stores/         # Stores Pinia
└── utils/          # Fonctions utilitaires
```

#### Composants principaux
- **BoxBlurhashCard.vue** : Carte avec blurhash pour les images
- **Crossfader.vue** : Contrôleur de crossfader audio
- **MixDeckCard.vue** : Carte de mixage
- **TurntablePlayer.vue** : Lecteur de vinyle
- **Platine.vue** : Interface de platine
- **CardElement.vue** : Élément de carte réutilisable

#### Fonctionnalités
- Gestion des cartes musicales
- Interface utilisateur interactive
- Système de navigation
- Gestion du state global

### Backend (evilspins.data)

#### Technologies
- Node.js
- Express
- PostgreSQL
- TypeScript

#### Structure des dossiers
```
src/
├── index.ts                # Point d'entrée de l'API
├── types.ts                # Types TypeScript
├── api/                    # Routes API
├── db/                     # Gestion de la base de données
├── middleware/             # Middleware Express
├── scanner/                # Scanner de fichiers musicaux
├── utils/                  # Fonctions utilitaires
└── watcher/                # Surveillance des fichiers
```

#### API Endpoints
- `/api/cards` - Gestion des cartes musicales
- `/api/boxes` - Gestion des boîtes
- `/api/scan` - Scanner de fichiers

#### Base de données
- PostgreSQL
- Système de gestion des relations entre cartes et boîtes
- Indexation et recherche optimisée

## Flux de données

1. **Frontend** → **API Backend** (HTTP/HTTPS)
   - Requêtes GET/POST/PUT/DELETE
   - Authentification via token JWT
   - Gestion des erreurs et codes HTTP

2. **Backend** → **Base de données**
   - Opérations CRUD sur les cartes et boîtes
   - Transactions sécurisées
   - Indexation pour les recherches rapides

## Conventions de développement

### Frontend (evilspins.user)
- Utilisation de composants Vue 3 avec Composition API
- Structure de dossiers modulaire
- Nommage des composants en PascalCase
- Utilisation de Pinia pour la gestion d'état
- Tailwind CSS pour les styles
- Composants réutilisables dans le dossier `components/`

### Backend (evilspins.data)
- API RESTful avec Express
- Typescript pour la sécurité de type
- Structure modulaire de fichiers
- Middleware pour l'authentification et la validation
- Utilisation de PostgreSQL avec gestion des connexions

## Commandes de développement

### evilspins.user (Frontend)
```bash
# Installation des dépendances
npm install
# ou
pnpm install

# Démarrage en mode développement
npm run dev
# ou
pnpm dev

# Build pour la production
npm run build
# ou
pnpm build

# Linting
npm run lint
# ou
pnpm lint

# Test
npm run test
# ou
pnpm test
```

### evilspins.data (Backend)
```bash
# Installation des dépendances
npm install
# ou
pnpm install

# Démarrage en mode développement
npm run dev
# ou
pnpm dev

# Build pour la production
npm run build
# ou
pnpm build

# Linting
npm run lint
# ou
pnpm lint

# Test
npm run test
# ou
pnpm test
```

## Configuration Docker

### evilspins.user
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
```

### evilspins.data
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@db:5432/evilspins
    depends_on:
      - db
  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=evilspins
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Variables d'environnement

### evilspins.user
- `NUXT_PUBLIC_API_URL` : URL de l'API backend
- `NUXT_PUBLIC_APP_NAME` : Nom de l'application

### evilspins.data
- `DATABASE_URL` : URL de connexion à PostgreSQL
- `JWT_SECRET` : Clé secrète pour les tokens JWT
- `NODE_ENV` : Environnement d'exécution (development/production)

## Evidence and uncertainty

The source code is the authoritative source of truth.

Never claim that two files, types, APIs, database entities, or concepts are identical, copied,
equivalent, or synchronized without directly comparing their actual definitions.

For important claims:

- Identify the repository.
- Identify the exact file path.
- Identify the relevant symbol.
- Quote or summarize only what is actually present in the source.
- Distinguish:
  - VERIFIED: directly confirmed by the source code.
  - INFERRED: a reasonable conclusion based on multiple sources.
  - UNKNOWN: cannot be established from the workspace.

When two files have similar names, treat them as independent until their relationship has
been verified.

Never infer a relationship merely from:
- identical filenames
- similar type names
- similar field names
- directory structure
- framework conventions

Never invent:
- API endpoints
- environment variables
- database relationships
- authentication systems
- tests
- scripts
- configuration
- synchronization mechanisms

## Critical rule: never fill missing evidence

If the requested behavior cannot be located in the workspace, STOP the trace at
the last verified point.

Do NOT invent a likely implementation.

For example, if a backend field `ext_audio` exists but the frontend field
`url_audio` cannot be traced to a specific function or file:

- state that the transformation could not be located;
- identify the last verified representation;
- identify the missing link;
- do not propose a hypothetical file, function, or implementation as if it existed.

Words such as "probably", "likely", "presumably", or "for example" must NOT
be used to fill an implementation gap when answering a code investigation
question.

If useful, hypotheses may be listed separately under an explicit `HYPOTHESIS`
heading, but they must never be presented as part of the verified architecture.

### Evidence-first code analysis

When investigating the codebase:

1. Search the actual source code.
2. Trace definitions and references.
3. Distinguish facts from hypotheses.
4. Never invent missing files, functions, transformations, or data flows.
5. If a relationship cannot be established from the workspace, say:
   `NON DÉMONTRÉ` or `ORIGINE NON TROUVÉE`.
6. Do not replace missing evidence with framework conventions or likely architecture.

## Efficient repository exploration

Minimize file reads and tool calls.

Do NOT read entire files by default.

When investigating a symbol or feature:

1. Search for the exact symbol, route, type, or string first.
2. Read only the surrounding lines needed to understand the result.
3. Follow imports/callers only when necessary.
4. Do not read an entire file unless the requested task genuinely requires it.
5. Do not inspect unrelated components, routes, or repositories.
6. Do not recursively explore directories without a specific reason.

Prefer targeted searches such as:
- symbol search
- text/reference search
- import search
- route search
- package.json scripts

over broad directory exploration.

Before opening a large file, determine whether a targeted search can answer
the question first.

## Files and directories to ignore

Never inspect generated or dependency directories unless explicitly requested:

- node_modules/
- .nuxt/
- .output/
- dist/
- coverage/
- .git/
- Docker build artifacts
- generated files
- lockfiles unless dependency/version information is relevant

Prefer source files and configuration files.
