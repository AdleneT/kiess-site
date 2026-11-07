<?php
/**
 * Identifiants de la base Hostinger pour le formulaire de préinscription.
 *
 * 1. Copier ce fichier sous le nom « kiess-config.php ».
 * 2. Le placer dans le dossier du domaine, À CÔTÉ de public_html (pas dedans) :
 *      domains/kiess.fr/kiess-config.php
 * 3. Remplacer les valeurs ci-dessous (hPanel → Bases de données → Gestion).
 *
 * Ne jamais publier ce fichier rempli (ni dans git, ni dans public_html).
 */
return [
    'db_host' => 'localhost',
    'db_name' => 'u000000000_kiess',      // nom complet de la base, avec le préfixe u…_
    'db_user' => 'u000000000_kiess',      // utilisateur de la base
    'db_pass' => 'MOT-DE-PASSE-DE-LA-BASE',
    // Longue chaîne aléatoire (40 caractères ou plus) : sert à chiffrer l'empreinte des IP.
    'secret'  => 'REMPLACER-PAR-UNE-LONGUE-CHAINE-ALEATOIRE',
];
