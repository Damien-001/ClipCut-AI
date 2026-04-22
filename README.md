# ClipCut AI

Divisez vos vidéos en segments parfaits pour vos réseaux sociaux en un clic.

## Prérequis

- Node.js

## Installation

```bash
npm install
```

## Lancer le projet

```bash
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000).

## Fonctionnalités

- Upload de vidéos MP4, MOV, AVI (max 500 Mo)
- Découpage automatique en clips de durée configurable
- Téléchargement individuel ou en ZIP
- Nettoyage automatique des fichiers après reset

## Stack

- React + TypeScript + Vite
- Express + FFmpeg (via ffmpeg-static)
- Tailwind CSS
