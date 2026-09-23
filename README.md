# ANKUCAMP — Backend API

API REST pour la plateforme ANKUCAMP (e-commerce / mise en relation).

## 🛠 Stack

- **Runtime** : Node.js (>= 18)
- **Langage** : TypeScript
- **Framework HTTP** : Express 4
- **ORM** : Drizzle ORM
- **Base de données** : PostgreSQL
- **Auth** : JWT + bcrypt
- **Validation** : Zod
- **Dev runner** : tsx

## 📦 Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Copier le fichier d'environnement
cp .env.example .env
# puis éditer .env avec tes vraies valeurs

# 3. Lancer en développement
npm run dev