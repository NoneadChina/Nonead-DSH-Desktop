@echo off
rem ============================================================================
rem  DSH Desktop launcher for Windows
rem
rem  Thin wrapper around the repository-root Yarn scripts. It never invents a
rem  second build path: every mode forwards to the exact script documented in
rem  AGENTS.md / README, through the pinned Yarn release (corepack yarn 4.18.0).
rem
rem  Usage:  start.bat [mode]
rem
rem    dev          default: build dsh-plugin-desktop, then launch the app
rem    beta         same as dev, for dsh-plugin-desktop-beta
rem    start        launch the already-built stable package, no rebuild
rem    start-beta   launch the already-built beta package, no rebuild
rem    install      install or refresh workspace dependencies
rem    init         initialize the pinned deepseek-harness submodule
rem    check        preflight checks only; installs nothing and launches nothing
rem    help         print this text
rem
rem  Extra environment knobs:
rem    DSH_LAUNCH_SKIP_INSTALL=1   never auto-install missing dependencies
rem    DSH_AA_SOURCE_REF=main      rebuild the Agents Anywhere bridge from its
rem                                upstream branch instead of the vendored
rem                                artifact (see the AA note below)
rem ============================================================================

setlocal EnableExtensions
cd /d "%~dp0"

set "MODE=%~1"
if not defined MODE set "MODE=dev"
set "LAUNCH=0"

if /i "%MODE%"=="help"     goto :usage
if /i "%MODE%"=="-h"       goto :usage
if /i "%MODE%"=="--help"   goto :usage
if /i "%MODE%"=="/?"       goto :usage
if /i "%MODE%"=="check"    goto :preflight_only
if /i "%MODE%"=="install"  goto :install_only
if /i "%MODE%"=="init"     goto :init_only
if /i "%MODE%"=="dev"        goto :mode_dev
if /i "%MODE%"=="beta"       goto :mode_beta
if /i "%MODE%"=="start"      goto :mode_start
if /i "%MODE%"=="start-beta" goto :mode_start_beta

echo [ERROR] Unknown mode: %MODE%
echo.
set "BAD_MODE=1"
goto :usage

:mode_dev
set "TARGET=dev"
set "LAUNCH=1"
goto :preflight

:mode_beta
set "TARGET=dev:beta"
set "LAUNCH=1"
goto :preflight

:mode_start
set "TARGET=start"
set "LAUNCH=1"
goto :preflight

:mode_start_beta
set "TARGET=start:beta"
set "LAUNCH=1"
goto :preflight

rem ============================================================================
rem  Preflight: toolchain, package manager, dependencies
rem ============================================================================

:preflight_only
set "CHECK_ONLY=1"

:preflight
echo.
echo ============================================================
echo  DSH Desktop - %MODE%
echo  repo: %CD%
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :err_no_node

for /f "delims=" %%v in ('node -v') do echo [OK]   Node %%v
node -e "const m=process.versions.node.split('.').map(Number);process.exit(((m[0]===22&&m[1]>=19)||m[0]>=24)?0:1)"
if errorlevel 1 goto :err_bad_node

rem Resolve the package-manager command. Plain "goto" only: cmd.exe can fail to
rem resolve a "call :label" when this file is started inside a compound command
rem line, which would break the launch for no good reason.
where corepack >nul 2>nul
if not errorlevel 1 goto :yarn_corepack
where yarn >nul 2>nul
if errorlevel 1 goto :err_no_yarn
echo [WARN] corepack not found on PATH; using the yarn executable instead.
set "YARN=yarn"
goto :yarn_ready

:yarn_corepack
set "YARN=corepack yarn"

:yarn_ready

rem The root "dev" script starts with "aa:prepare-release", which refreshes the
rem Agents Anywhere bridge from the upstream AA main branch. That refresh only
rem succeeds while upstream main still typechecks against the vendored
rem 0.1.7-rc.2 runtime, so starting the app must not depend on it: reuse the
rem checksum-verified vendored artifact, which is what DSH_AA_SOURCE_REF=pinned
rem selects. Set DSH_AA_SOURCE_REF=main (or a commit) before running this file
rem to refresh the bridge from upstream on purpose.
if not defined DSH_AA_SOURCE_REF set "DSH_AA_SOURCE_REF=pinned"
echo [OK]   Agents Anywhere source: %DSH_AA_SOURCE_REF%

rem Yarn keeps this workspace tree unhoisted (nmHoistingLimits: workspaces), so
rem the root node_modules holds no package links: dependencies live in each
rem workspace. The install state plus the desktop workspace tree are the
rem reliable markers of a finished install.
if not exist "node_modules\.yarn-state.yml" goto :deps_missing
if not exist "dsh-plugin-desktop\node_modules" goto :deps_missing
echo [OK]   Workspace dependencies present
goto :deps_ok

:deps_missing
echo [WARN] Workspace dependencies are not installed
if "%DSH_LAUNCH_SKIP_INSTALL%"=="1" goto :err_deps_skipped
if defined CHECK_ONLY (
  set "MISSING_DEPS=1"
  goto :deps_ok
)

echo [SETUP] Installing workspace dependencies with the immutable lockfile.
rem corepack and yarn are .cmd shims. They must be started with "call": a plain
rem invocation hands control to the shim and never returns to this file.
call %YARN% install --immutable
if errorlevel 1 goto :err_install
goto :deps_ok

:deps_ok
if exist "deepseek-harness\package.json" goto :submodule_ok
echo [WARN] deepseek-harness submodule is not initialized
echo        The from-source setup in the README starts with this step, and every
echo        upstream:* script needs it. Run "start.bat init" when you need it.
goto :after_submodule

:submodule_ok
echo [OK]   Upstream submodule initialized

:after_submodule
if defined CHECK_ONLY goto :report_check
if not "%LAUNCH%"=="1" goto :run_target

if not "%TARGET%"=="start" if not "%TARGET%"=="start:beta" goto :run_target
if "%TARGET%"=="start"     if not exist "dsh-plugin-desktop\lib\bin.js"      goto :fallback_build
if "%TARGET%"=="start:beta" if not exist "dsh-plugin-desktop-beta\lib\bin.js" goto :fallback_build
goto :run_target

:fallback_build
echo [WARN] %TARGET% needs a previous build; falling back to the dev mode that builds first.
if "%TARGET%"=="start" set "TARGET=dev"
if "%TARGET%"=="start:beta" set "TARGET=dev:beta"

:run_target
echo.
echo [RUN]  %YARN% %TARGET%
echo.
call %YARN% %TARGET%
if errorlevel 1 goto :err_target
if not "%LAUNCH%"=="1" echo [OK]   Finished successfully.
goto :done

:check_incomplete
echo.
echo [FAIL] Preflight found missing pieces. Run "start.bat install" first.
goto :fail

:report_check
if defined MISSING_DEPS goto :check_incomplete
echo.
echo [OK]   Preflight finished. Everything required for "%MODE%" is in place.
goto :done

rem ============================================================================
rem  Standalone modes
rem ============================================================================

:install_only
where corepack >nul 2>nul
if not errorlevel 1 goto :install_corepack
where yarn >nul 2>nul
if errorlevel 1 goto :err_no_yarn
set "YARN=yarn"
goto :install_ready

:install_corepack
set "YARN=corepack yarn"

:install_ready
echo [RUN]  %YARN% install --immutable
call %YARN% install --immutable
if errorlevel 1 goto :err_install
echo [OK]   Dependencies installed.
goto :done

:init_only
where git >nul 2>nul
if errorlevel 1 goto :err_no_git
echo [RUN]  git submodule update --init --recursive
git submodule update --init --recursive
if errorlevel 1 goto :err_init
echo [OK]   Upstream submodule initialized.
goto :done

rem ============================================================================
rem  Errors
rem ============================================================================

:err_no_node
echo [ERROR] Node.js is not on PATH.
echo         Install Node.js 22.19 or newer - 22.19+ or 24+ - then rerun this file.
goto :fail

:err_bad_node
echo [ERROR] Unsupported Node.js version.
echo         This workspace requires ^>= 22.19.0 or ^>= 24.0.0.
goto :fail

:err_no_yarn
echo [ERROR] Neither corepack nor yarn is available.
echo         Node.js ships corepack; otherwise run: npm install -g corepack
goto :fail

:err_no_git
echo [ERROR] git is not on PATH.
goto :fail

:err_deps_skipped
echo [ERROR] Dependencies are missing and DSH_LAUNCH_SKIP_INSTALL is set.
echo         Run "start.bat install" yourself, then rerun this file.
goto :fail

:err_install
echo [ERROR] Dependency installation failed.
echo         Check the network or the working copy, then run "start.bat install".
goto :fail

:err_init
echo [ERROR] Submodule initialization failed.
echo         Check the network and the .gitmodules remotes.
goto :fail

:err_target
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [ERROR] "%YARN% %TARGET%" failed with exit code %EXIT_CODE%.
goto :fail

:usage
echo.
echo DSH Desktop launcher
echo.
echo   start.bat              build and launch the stable app   [dev]
echo   start.bat dev          build and launch the stable app
echo   start.bat beta         build and launch the beta app
echo   start.bat start        launch the built stable app
echo   start.bat start-beta   launch the built beta app
echo   start.bat install      install workspace dependencies
echo   start.bat init         initialize the deepseek-harness submodule
echo   start.bat check        preflight checks only
echo   start.bat help         this text
echo.
if defined BAD_MODE goto :fail
endlocal & exit /b 0

:fail
echo.
echo Press any key to close this window.
pause >nul
endlocal & exit /b 1

:done
echo.
endlocal & exit /b 0
