; Scriare — NSIS customisations (v0.63.0)
;
; electron-builder looks for this file by name in buildResources (build/)
; and folds it into the generated installer script; the macros below are
; hooks it checks for with !ifmacrodef.

; ── THE INSTALL-SCOPE PAGE IS NOT ASKED ──────────────────────────────────
;
; Scriare installs per-user and cannot do anything else: package.json sets
; perMachine false and allowElevation false, so the wizard's "who is this
; for?" page showed a greyed "all users" option beside the only real one.
; A page whose every control is already decided is a page that costs a
; click to agree with itself.
;
; It also carried a wart nothing else could fix. electron-builder appends
; the words "(must run as admin)" to the disabled option in
; templates/nsis/multiUserUi.nsh with a literal SendMessage, not through a
; LangString — so on a Turkish Windows that page read as Turkish with one
; English fragment inside it, and no translation file could reach it.
; Skipping the page removes the fragment along with the page.
;
; $isForceCurrentInstall is read by that same PRE function immediately
; after this macro runs: set, it selects per-user and Aborts the page. This
; is electron-builder's own supported hook, not a patch of its template.
;
; The uninstaller inserts the same macro. That is correct here rather than
; merely harmless: since no machine-wide install can exist, the only
; installation there could ever be is this user's.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
