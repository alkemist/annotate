# Annotate

## Description

Application pour annoter des images.

Pour le moment :

- compatible uniquement avec le format YOLO
- compatible uniquement avec les images (jpg/png)

Fonctionnalités :

- Gère les fichiers contenus dans des sous dossiers
- Récupère les labels dans le fichiers "classes.labels"
- Stock le dernier nom d'image traité dans un fichier "search.last"  
  (pour facilement savoir où l'on en été si on ferme et réouvre l'application)
- Gère des raccourcis clavier :
  - Ctrl + S : sauvegarde la modal ou le fichier en cours
  - Ctrl + Q : Passe à l'image précédente
  - Ctrl + D : Passe à l'image suivante
  - Ctrl + Z : Ferme la modal si elle est ouverte
- Permet de modifier la couleur des labels
- Impossible de changer de fichier s'il a été modifié (pour éviter les erreurs)
- Navigation des images avec décompte
- Bouton de "reset" pour remettre à l'état initial l'image modifié en cours

Evolutions :

- Gèrer le fichier "data.yaml" pour récupérer les labels

# Installation

`npm run package:linux`  
`npm run package:linux:deb`  
`cd packages`  
`sudo dpkg -i annotate_0.1.0_amd64.deb`  
