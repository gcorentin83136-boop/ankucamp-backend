# Politique de Confidentialité — ANKU

**Version 1.0 — En vigueur au 29 septembre 2026**

Conformément au **Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679)** et à la **loi Informatique et Libertés du 6 janvier 1978 modifiée**, ANKU vous informe sur la manière dont vos données personnelles sont collectées, traitées et protégées.

---

## 1. Responsable du traitement

**Nom** : ANKU FRANCE
**Forme juridique** : Auto-entrepreneur
**SIRET** : 90389546400027
**Adresse** : 180 Impasse des Chênes Verts, France
**Email** : contact@ankucamp.com
**Représentant légal** : Monsieur Giannarelli Corentin

---

## 2. Données collectées

### 2.1 — Données fournies directement par l'utilisateur

| Catégorie | Données | Caractère obligatoire |
|-----------|---------|----------------------|
| **Identification** | Prénom, nom, pseudonyme, email, année de naissance | Obligatoire |
| **Adresse postale** | Adresse, ville, code postal, pays | Obligatoire pour acheter/vendre |
| **Authentification** | Mot de passe (haché), tokens | Obligatoire (local) |
| **Profil public** | Bio, photo de profil, photo de couverture, site web, localisation | Facultatif |
| **Paiement** | Données de carte bancaire | **NON COLLECTÉES** (gérées par Stripe) |
| **Vendeur pro** | SIRET, IBAN (via Stripe Connect) | Obligatoire pour vendre |
| **Contenus** | Publications, commentaires, likes, messages, photos | Facultatif |

### 2.2 — Données collectées automatiquement

| Catégorie | Données | Finalité |
|-----------|---------|----------|
| **Technique** | Adresse IP, user-agent, type d'appareil, navigateur | Sécurité, détection de fraude |
| **Sessions** | Date de connexion, dernière activité | Gestion des sessions actives |
| **Cookies** | Session, préférences, analytics | Fonctionnement du site |
| **Logs** | Requêtes HTTP, erreurs | Debug, sécurité |

### 2.3 — Données issues de tiers

- **Google OAuth** : si connexion via Google, nous recevons votre ID Google, email, nom, photo
- **Stripe** : statut du compte Stripe Connect (KYC), transactions

---

## 3. Finalités du traitement

| Finalité | Base légale (RGPD) | Durée de conservation |
|----------|-------------------|----------------------|
| Création et gestion du compte | Exécution du contrat | Durée du compte + 30 jours |
| Fourniture du service | Exécution du contrat | Durée du compte + 3 ans |
| Traitement des paiements | Exécution du contrat | 10 ans (comptable) |
| Envoi d'emails transactionnels | Exécution du contrat | 3 ans |
| Envoi de newsletters marketing | Consentement | Jusqu'à retrait |
| Sécurité et prévention de la fraude | Intérêt légitime | 1 an |
| Statistiques anonymisées | Intérêt légitime | Durée du compte |
| Respect des obligations légales | Obligation légale | Selon obligation |

---

## 4. Destinataires des données

| Destinataire | Type | Pays | Garanties |
|-------------|------|------|-----------|
| **Stripe Payments Europe Ltd** | Paiements | Irlande (UE) | RGPD natif |
| **Brevo (Sendinblue SAS)** | Emails | France (UE) | RGPD natif |
| **Cloudinary Ltd** | Images | USA | Clauses contractuelles types |
| **Railway Corporation** | Hébergement | USA | Clauses contractuelles types |
| **Google LLC** | OAuth | USA | Clauses contractuelles types |

**Aucune donnée n'est vendue à des tiers.**

### 4.1 — Transferts hors UE

Encadrés par les **Clauses Contractuelles Types** (CCT) approuvées par la Commission européenne (décision 2021/914) et le **Data Privacy Framework** (DPF) UE-USA.

---

## 5. Vos droits (RGPD)

| Droit | Description | Comment l'exercer |
|-------|-------------|-------------------|
| **Droit d'accès** (art. 15) | Obtenir une copie de vos données | Paramètres ou email |
| **Droit de rectification** (art. 16) | Corriger vos données | Paramètres |
| **Droit à l'effacement** (art. 17) | Supprimer votre compte | Paramètres (délai 30 j) |
| **Droit à la limitation** (art. 18) | Limiter le traitement | Email |
| **Droit à la portabilité** (art. 20) | Recevoir vos données en JSON | Paramètres |
| **Droit d'opposition** (art. 21) | S'opposer au traitement | Email |
| **Droit de retirer le consentement** (art. 7) | Retirer un consentement | Paramètres |

**Délai de réponse** : 1 mois maximum.

**Autorité de contrôle** : CNIL — https://www.cnil.fr

---

## 6. Sécurité des données

- **Chiffrement** : HTTPS (TLS 1.2+)
- **Hachage** : bcrypt (coût 10)
- **Authentification** : JWT signés SHA-256
- **Sessions** : tokens hashés
- **Accès BDD** : restreint
- **Sauvegardes** : quotidiennes
- **Paiements** : Stripe (PCI-DSS 1)

**Violation de données** : notification CNIL sous 72h.

---

## 7. Cookies et traceurs

Voir notre Politique Cookies : https://ankucamp.com/cookies

---

## 8. Mineurs

Moins de 16 ans : consentement parental requis (article 45 LIL).

---

## 9. Modification de la Politique

Information par email **15 jours avant** l'entrée en vigueur.

---

## 10. Contact

**Email** : contact@ankucamp.com
**Courrier** : ANKU FRANCE — 180 Impasse des Chênes Verts, France

**Réclamation** : https://www.cnil.fr/fr/plaintes

---

*Version 1.0 — En vigueur au 29 septembre 2026*