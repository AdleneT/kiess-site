/**
 * Textes légaux servis publiquement par l'API (CGU + Politique de
 * confidentialité) — les stores exigent une URL publique.
 *
 * ⚠️ COPIE du dépôt de l’app (kiess-app/Kiess) : api/src/legal/legal-content.ts,
 * elle-même synchronisée avec mobile/legal/index.ts. Le site affiche les mêmes
 * CGU et la même politique que l’app (un compte du site est un compte de l’app) :
 * toute modification doit être faite d’abord dans le dépôt Kiess, puis
 * recopiée ici, à l’identique.
 *
 * ⚠️ DRAFT — Ces textes sont des modèles génériques pour passer la review
 * des stores et permettre une bêta privée. Avant tout lancement public,
 * faire relire par un avocat.
 *
 * Les placeholders {{...}} sont remplacés à la volée par les env vars
 * LEGAL_* (voir legal.controller.ts).
 */

export const LEGAL_LAST_UPDATE = '2026-11-07';

export const CGU_TITLE = "Conditions générales d'utilisation";
export const CGU_TEXT = `Dernière mise à jour : ${LEGAL_LAST_UPDATE}

Bienvenue sur Kiess. En utilisant l'application, tu acceptes les présentes conditions.

1. OBJET
Kiess est une application mobile permettant à des adultes consentants de faire des rencontres autour d'affinités déclarées (valeurs, intentions, profils audio). Elle est éditée par {{COMPANY}}, {{ADDRESS}}.

2. ACCÈS AU SERVICE
2.1 Tu dois être majeur·e (18 ans révolus) pour créer un compte. Toute fausse déclaration entraîne la fermeture immédiate du compte.
2.2 Tu garantis que les informations fournies (identité, photos, audio) sont exactes et t'appartiennent.
2.3 L'inscription se fait dans l'application ou sur le site kiess.fr, avec le même compte. Elle nécessite un numéro de téléphone vérifié par code OTP ou un compte Apple, Google, Facebook ou Discord.

3. COMPTE ET SÉCURITÉ
3.1 Tu es responsable de la confidentialité de tes accès. Tout usage de ton compte est présumé fait par toi.
3.2 Kiess se réserve le droit de suspendre un compte en cas de violation des présentes ou de signalement justifié.

4. RÈGLES DE COMMUNAUTÉ
Sont interdits, sans que cette liste soit exhaustive :
 • Le harcèlement, les insultes, la haine, le racisme, la transphobie, l'homophobie ;
 • La pornographie et les contenus à caractère sexuel non sollicités ;
 • La sollicitation commerciale, le démarchage, le spam ;
 • L'usurpation d'identité, les faux profils, l'utilisation de photos qui ne sont pas les tiennes ;
 • Toute incitation à des activités illégales.
Le non-respect entraîne la suppression immédiate du compte sans préavis.

5. CONTENU UTILISATEUR
5.1 Tu restes propriétaire des contenus que tu publies (photos, audio, texte).
5.2 Tu accordes à Kiess une licence non-exclusive, gratuite, mondiale, limitée à l'exploitation du service (affichage, stockage, sauvegarde, modération).
5.3 Tu garantis disposer des droits sur ces contenus.

6. ABONNEMENT PREMIUM
6.1 Certaines fonctionnalités peuvent être réservées à un abonnement payant souscrit via les stores Apple ou Google.
6.2 Le renouvellement, le prix et les conditions d'annulation sont affichés avant l'achat. Tu peux résilier à tout moment depuis ton compte du store concerné.
6.3 Les achats sont fermes et définitifs sauf droit de rétractation prévu par la loi.

7. RESPONSABILITÉ
7.1 Kiess est tenue d'une obligation de moyens, pas de résultat. Aucune garantie n'est donnée sur la disponibilité ininterrompue du service.
7.2 Kiess n'est pas responsable du comportement des autres utilisateurs ; tu utilises le service à tes risques.
7.3 La responsabilité de Kiess est limitée au montant payé par l'utilisateur sur les 12 derniers mois, dans la limite autorisée par la loi.

8. SUPPRESSION DU COMPTE
8.1 Tu peux supprimer ton compte à tout moment depuis Réglages → Supprimer mon compte. La suppression est définitive.
8.2 Kiess peut résilier ton accès en cas de manquement aux présentes après notification (sauf urgence).

9. DROIT APPLICABLE
Le présent contrat est soumis au droit français. Tout litige sera soumis aux tribunaux compétents de {{COUNTRY}}.

10. CONTACT
Pour toute question : {{CONTACT_EMAIL}}.`;

export const PRIVACY_TITLE = 'Politique de confidentialité';
export const PRIVACY_TEXT = `Dernière mise à jour : ${LEGAL_LAST_UPDATE}

Cette politique explique comment Kiess collecte, utilise et protège tes données personnelles, conformément au RGPD.

1. RESPONSABLE DU TRAITEMENT
{{COMPANY}}, {{ADDRESS}}.
DPO : {{DPO_EMAIL}}.

2. DONNÉES COLLECTÉES
Nous collectons uniquement les données nécessaires au service :
 • Identité : prénom, nom (optionnel), date de naissance, genre, ville.
 • Contact : numéro de téléphone OU adresse mail (un seul au choix lors de l'inscription).
 • Profil : photos, message audio, valeurs, préférences, biographie.
 • Activité : matchs, messages, achats, badges.
 • Technique : token push, identifiant d'appareil, logs anonymes (adresse IP tronquée pour 30 jours).

3. FINALITÉS ET BASES LÉGALES
 • Création et gestion du compte : exécution du contrat (art. 6.1.b RGPD).
 • Mise en relation entre utilisateurs : exécution du contrat.
 • Notifications push : consentement (art. 6.1.a) — révocable à tout moment dans les réglages de l'OS.
 • Sécurité, anti-fraude, modération : intérêt légitime (art. 6.1.f).
 • Statistiques anonymes : intérêt légitime, sans identification individuelle.
 • Marketing (newsletters) : consentement explicite, case à cocher à l'inscription.

4. DESTINATAIRES / SOUS-TRAITANTS
Tes données peuvent être transmises à :
 • Twilio (envoi des SMS de vérification) — données : numéro de téléphone uniquement.
 • Resend (envoi des emails) — données : adresse mail uniquement.
 • Stripe / RevenueCat (paiement de l'abonnement, le cas échéant) — données : identifiant de transaction.
 • Apple, Google, Facebook (Meta), Discord (authentification sociale) et Apple, Google (livraison push) — selon ton choix d'inscription.
 • Hébergement : {{HOST_PROVIDER}} (UE).
Tous nos sous-traitants ont signé un DPA et présentent des garanties RGPD adaptées.

5. DURÉE DE CONSERVATION
 • Compte actif : tant que tu utilises l'application.
 • Compte inactif (sans connexion 24 mois) : suppression automatique après notification.
 • Suppression à ta demande : exécutée sous 30 jours, sauf obligations légales (facturation : 10 ans, journalisation sécurité : 1 an).
 • Logs de connexion : 30 jours.

6. TES DROITS RGPD
Tu as le droit de :
 • Accéder à tes données : Réglages → Exporter mes données.
 • Rectifier les informations inexactes : Profil → Modifier.
 • Supprimer ton compte : Réglages → Supprimer mon compte (effet immédiat côté app).
 • Limiter ou t'opposer au traitement : écris à {{DPO_EMAIL}}.
 • Portabilité : l'export est fourni au format JSON.
 • Réclamation auprès de la CNIL : https://www.cnil.fr/.

7. SÉCURITÉ
Les mots de passe sont stockés en empreintes cryptographiques (argon2id). Les jetons d'accès sont stockés dans le Keychain (iOS) / Keystore (Android). Toutes les communications passent par HTTPS.
Aucune mesure n'étant infaillible, en cas de violation tu seras informé·e dans les 72 h conformément au RGPD.

8. COOKIES / TRACEURS
L'application mobile n'utilise pas de cookies tiers. Aucun traceur publicitaire n'est intégré.

9. MINEURS
Le service est interdit aux moins de 18 ans. Tout compte détecté comme appartenant à un mineur est immédiatement supprimé.

10. CONTACT
Question relative à tes données : {{DPO_EMAIL}}.`;
