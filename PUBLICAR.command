#!/bin/bash
cd "$(dirname "$0")" || exit 1
FB="firebase"; command -v firebase >/dev/null 2>&1 || FB="npx --yes firebase-tools"
$FB projects:list >/dev/null 2>&1 || $FB login
$FB deploy --only firestore:rules,hosting
echo; echo "Se apareceu 'Hosting URL: https://seu-app.web.app', deu certo."
read -n1 -r -p "Pressione qualquer tecla para fechar..."
