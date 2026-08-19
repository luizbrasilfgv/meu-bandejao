@echo off
cd /d "%~dp0"
title Publicar SEU APP
color 0B

echo ===============================================
echo   SEU APP - publicando no seu Firebase
echo ===============================================
echo.

rem procura o firebase.json aqui, ou numa subpasta
if exist "firebase.json" goto achou
for /d %%D in (*) do if exist "%%D\firebase.json" ( cd "%%D" & goto achou )
if exist "..\firebase.json" ( cd .. & goto achou )

echo NAO ENCONTREI o firebase.json.
echo.
echo Estou rodando a partir desta pasta:
echo    %CD%
echo.
echo Arquivos que existem aqui:
dir /b
echo.
echo ------------------------------------------------------------
echo CAUSA MAIS COMUM: voce clicou no PUBLICAR.bat de dentro do ZIP.
echo O Windows copia so esse arquivo pra uma pasta temporaria.
echo.
echo COMO RESOLVER:
echo   1. Clique com o botao direito no riw-app.zip
echo   2. Escolha "Extrair tudo..." e confirme
echo   3. Abra a pasta extraida e entre na pasta riw-app
echo   4. Confira que voce ve firebase.json E PUBLICAR.bat juntos
echo   5. So entao de duplo-clique no PUBLICAR.bat
echo ------------------------------------------------------------
echo.
pause
exit /b 1

:achou
echo Pasta do projeto: %CD%
echo.

where firebase >nul 2>&1
if %errorlevel% equ 0 goto temCli
where npx >nul 2>&1
if %errorlevel% equ 0 goto usaNpx

echo Nao encontrei o Firebase CLI nem o Node/npx nesta maquina.
echo Instale o Node.js em nodejs.org e rode este arquivo de novo.
echo.
pause
exit /b 1

:usaNpx
set "FB=npx --yes firebase-tools"
echo Usando o Firebase via npx.
goto executa

:temCli
set "FB=firebase"
echo Firebase CLI encontrado.
goto executa

:executa
echo.
echo -- Conferindo login...
call %FB% projects:list >nul 2>&1
if %errorlevel% neq 0 (
  echo Nao esta logado. Abrindo o navegador para voce entrar com o Google.
  echo.
  call %FB% login
)

echo.
echo -- Publicando regras do Firestore + site...
echo.
call %FB% deploy --only firestore:rules,hosting

echo.
echo ===============================================
echo  Deu certo se apareceu acima:
echo    Hosting URL: https://..web.app
echo ===============================================
echo.
pause
