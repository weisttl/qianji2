!ifndef QIANJI_INSTALLER_UPDATE_VERIFY_NSH
!define QIANJI_INSTALLER_UPDATE_VERIFY_NSH

Var /GLOBAL QianjiUninstallHadErrors
Var /GLOBAL QianjiUninstallLogResult
Var /GLOBAL QianjiVerifyResourceResult
Var /GLOBAL QianjiUpdatedAppExitWaitResult
Var /GLOBAL QianjiActiveMarkerExecResult
Var /GLOBAL QianjiActiveMarkerResult

!define QIANJI_ACTIVE_INSTALLER_MARKER "qianji-installer-active.marker"

!macro QIANJI_BRING_UPDATED_INSTALLER_TO_FRONT
  ${If} ${isUpdated}
    BringToFront
    !insertmacro QIANJI_SLOG "event=updated-installer-foreground action=bring-to-front"
  ${EndIf}
!macroend

!macro QIANJI_WAIT_FOR_UPDATED_APP_EXIT
  ${If} ${isUpdated}
    !insertmacro QIANJI_SLOG "event=updated-app-exit-wait phase=start"
    StrCpy $QianjiUpdatedAppExitWaitResult "0"

    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
      $$ErrorActionPreference = 'SilentlyContinue'; \
      $$deadline = (Get-Date).AddSeconds(10); \
      $$target = [System.IO.Path]::GetFullPath((Join-Path '$INSTDIR' '${QIANJI_APP_EXECUTABLE_FILENAME}')); \
      do { \
        $$hits = @(Get-CimInstance -ClassName Win32_Process | Where-Object { \
          $$path = $$_.ExecutablePath; \
          if (-not $$path) { $$path = $$_.Path } \
          $$_.Name -ieq '${QIANJI_APP_EXECUTABLE_FILENAME}' -and $$path -and \
          [string]::Equals([System.IO.Path]::GetFullPath($$path), $$target, [System.StringComparison]::CurrentCultureIgnoreCase) \
        }); \
        if ($$hits.Count -eq 0) { exit 0 }; \
        Start-Sleep -Milliseconds 500; \
      } while ((Get-Date) -lt $$deadline); \
      exit 1 \
    }"`
    Pop $QianjiUpdatedAppExitWaitResult

    ${If} $QianjiUpdatedAppExitWaitResult != 0
      !insertmacro QIANJI_SLOG "event=updated-app-exit-wait phase=timeout action=stop"
      !insertmacro QIANJI_STOP_APP_PROCESSES
    ${EndIf}

    !insertmacro QIANJI_SLOG "event=updated-app-exit-wait phase=done result=$QianjiUpdatedAppExitWaitResult"
  ${EndIf}
!macroend

!macro QIANJI_RECORD_ACTIVE_INSTALLER_MARKER
  nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$marker = Join-Path $$env:TEMP '${QIANJI_ACTIVE_INSTALLER_MARKER}'; \
    if (-not (Test-Path -LiteralPath $$marker)) { Write-Output 'missing'; exit 0 }; \
    $$item = Get-Item -LiteralPath $$marker; \
    if ($$item.LastWriteTime -lt (Get-Date).AddHours(-2)) { Write-Output 'stale'; exit 0 }; \
    Write-Output 'active' \
  }"`
  Pop $QianjiActiveMarkerExecResult
  Pop $QianjiActiveMarkerResult
  ${If} $QianjiActiveMarkerResult == "active"
    !insertmacro QIANJI_SLOG "event=installer-active-marker state=active"
  ${ElseIf} $QianjiActiveMarkerResult == "stale"
    !insertmacro QIANJI_SLOG "event=installer-active-marker state=stale"
  ${Else}
    !insertmacro QIANJI_SLOG "event=installer-active-marker state=missing"
  ${EndIf}
!macroend

!macro QIANJI_WRITE_ACTIVE_INSTALLER_MARKER
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$marker = Join-Path $$env:TEMP '${QIANJI_ACTIVE_INSTALLER_MARKER}'; \
    Set-Content -LiteralPath $$marker -Encoding UTF8 -Value ('pid=' + $$PID + ';session=$QianjiSessionId;started=' + (Get-Date -Format o)) \
  }"`
  Pop $QianjiActiveMarkerResult
!macroend

!macro QIANJI_CLEAR_ACTIVE_INSTALLER_MARKER
  !ifndef BUILD_UNINSTALLER
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
      $$ErrorActionPreference = 'SilentlyContinue'; \
      Remove-Item -LiteralPath (Join-Path $$env:TEMP '${QIANJI_ACTIVE_INSTALLER_MARKER}') -Force \
    }"`
    Pop $QianjiActiveMarkerResult
  !endif
!macroend

!macro QIANJI_OVERRIDE_SINGLE_INSTANCE
!macroend

!macro QIANJI_OVERRIDE_APP_CANNOT_BE_CLOSED_MESSAGE
  !pragma warning disable 6030
  LangString appCannotBeClosed 1033 "${QIANJI_MSG_APP_CANNOT_BE_CLOSED_ZH}$\r$\n$\r$\n${QIANJI_MSG_BLOCK_SEPARATOR}$\r$\n$\r$\n${QIANJI_MSG_APP_CANNOT_BE_CLOSED_EN}"
  LangString appCannotBeClosed 2052 "${QIANJI_MSG_APP_CANNOT_BE_CLOSED_ZH}$\r$\n$\r$\n${QIANJI_MSG_BLOCK_SEPARATOR}$\r$\n$\r$\n${QIANJI_MSG_APP_CANNOT_BE_CLOSED_EN}"
  !pragma warning default 6030
!macroend

!macro QIANJI_INSTALLER_CUSTOM_HEADER
  !insertmacro QIANJI_OVERRIDE_SINGLE_INSTANCE
  !insertmacro QIANJI_OVERRIDE_APP_CANNOT_BE_CLOSED_MESSAGE
!macroend

!macro QIANJI_RELEASE_INSTALL_DIR_OUTDIR
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  StrCpy $QianjiCurrentOutDir "$PLUGINSDIR"
!macroend

; Resolve the machine's real native architecture (arm64 / x64 / x86) for diagnostics.
; Backed by IsWow64Process2 (via x64.nsh), so it reports the true hardware arch even when
; the installer runs under x86/x64 emulation. Replaces the old hardcoded "non-arm64" detail.
!macro QIANJI_DETECT_NATIVE_ARCH _OUT
  ${If} ${IsNativeARM64}
    StrCpy ${_OUT} "arm64"
  ${ElseIf} ${RunningX64}
    StrCpy ${_OUT} "x64"
  ${Else}
    StrCpy ${_OUT} "x86"
  ${EndIf}
!macroend

!macro QIANJI_INSTALLER_PREINIT
  !ifdef BUILD_UNINSTALLER
    StrCpy $QianjiSessionId ""
    StrCpy $QianjiIsUpdated "0"
    StrCpy $QianjiSessionLogResult ""
    StrCpy $QianjiSessionLogPath "$TEMP\${QIANJI_FALLBACK_LOG}"
    StrCpy $QianjiUninstallHadErrors "0"
    StrCpy $QianjiUninstallLogResult ""
    StrCpy $QianjiVerifyResourceResult ""
    StrCpy $QianjiUpdatedAppExitWaitResult ""
    StrCpy $QianjiActiveMarkerExecResult ""
    StrCpy $QianjiActiveMarkerResult ""
    StrCpy $QianjiStopResult ""
    StrCpy $QianjiLockerListZh ""
    StrCpy $QianjiLockerListEn ""
  !else
    !insertmacro QIANJI_RELEASE_INSTALL_DIR_OUTDIR
    !insertmacro QIANJI_SESSION_BEGIN
    !insertmacro QIANJI_SLOG "event=installer-outdir-release outDir=$QianjiCurrentOutDir instDir=$INSTDIR"
    ; Guard target/machine architecture as early as possible: this runs before customInit's
    ; registry heal/clear/repair, so a wrong-arch installer aborts without mutating an existing
    ; correct-arch install's registry or uninstaller state. (Sentry ELECTRON-3BX / code E1040)
    !insertmacro QIANJI_ASSERT_TARGET_ARCH
    !insertmacro QIANJI_BRING_UPDATED_INSTALLER_TO_FRONT
    !insertmacro QIANJI_RECORD_ACTIVE_INSTALLER_MARKER
    !insertmacro QIANJI_WRITE_ACTIVE_INSTALLER_MARKER
  !endif
!macroend

!macro QIANJI_VERIFY_REQUIRED_FILE _PATH _LABEL
  ${IfNot} ${FileExists} "${_PATH}"
    !insertmacro QIANJI_LOG_EVENT "verify-required-file missing label=${_LABEL} path=${_PATH}"
    !insertmacro QIANJI_FAIL_UX \
      "${QIANJI_E_CORE_APP_FILES_INCOMPLETE}" \
      "verify-required-file missing label=${_LABEL} path=${_PATH}" \
      "${QIANJI_MSG_VERIFY_REQUIRED_FILE_ZH} ${_LABEL}" \
      "${QIANJI_MSG_VERIFY_REQUIRED_FILE_EN} ${_LABEL}" \
      "${QIANJI_MSG_VERIFY_REQUIRED_FILE_ACTION_ZH}" \
      "${QIANJI_MSG_VERIFY_REQUIRED_FILE_ACTION_EN}" \
      "verify-required-file missing label=${_LABEL} path=${_PATH}" \
      "verify-required-file missing label=${_LABEL} path=${_PATH}"
  ${Else}
    !insertmacro QIANJI_LOG_EVENT "verify-required-file ok label=${_LABEL} path=${_PATH}"
  ${EndIf}
!macroend

!macro QIANJI_VERIFY_CORE_APP_FILES
  !insertmacro QIANJI_LOG_EVENT "verify-install start instDir=$INSTDIR"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\Qianji.exe" "Qianji.exe"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\ffmpeg.dll" "ffmpeg.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\libEGL.dll" "libEGL.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\libGLESv2.dll" "libGLESv2.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\d3dcompiler_47.dll" "d3dcompiler_47.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\dxcompiler.dll" "dxcompiler.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\dxil.dll" "dxil.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\vk_swiftshader.dll" "vk_swiftshader.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\vulkan-1.dll" "vulkan-1.dll"
  !insertmacro QIANJI_VERIFY_REQUIRED_FILE "$INSTDIR\resources\app.asar" "resources\app.asar"
!macroend

!macro QIANJI_VERIFY_BUNDLED_QIANJICORE_RESOURCES _RUNTIME_KEY
  InitPluginsDir
  File "/oname=$PLUGINSDIR\verify-bundled-qianjicore-install.ps1" "${PROJECT_DIR}\resources\windows\support\verify-bundled-qianjicore-install.ps1"
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-bundled-qianjicore-install.ps1" -InstallDir "$INSTDIR" -RuntimeKey "${_RUNTIME_KEY}" -LogPath "$QianjiSessionLogPath"`
  Pop $QianjiVerifyResourceResult

  ${If} $QianjiVerifyResourceResult != 0
    !insertmacro QIANJI_FAIL_UX \
      "${QIANJI_E_BUNDLED_QIANJICORE_INCOMPLETE}" \
      "event=session-end result=fail code=${QIANJI_E_BUNDLED_QIANJICORE_INCOMPLETE} detail=bundled-qianjicore-incomplete runtime=${_RUNTIME_KEY} result=$QianjiVerifyResourceResult" \
      "${QIANJI_MSG_BUNDLED_QIANJICORE_INCOMPLETE_ZH}" \
      "${QIANJI_MSG_BUNDLED_QIANJICORE_INCOMPLETE_EN}" \
      "${QIANJI_MSG_BUNDLED_QIANJICORE_INCOMPLETE_ACTION_ZH}" \
      "${QIANJI_MSG_BUNDLED_QIANJICORE_INCOMPLETE_ACTION_EN}" \
      "bundled-qianjicore-incomplete runtime=${_RUNTIME_KEY} result=$QianjiVerifyResourceResult instDir=$INSTDIR" \
      "bundled-qianjicore-incomplete runtime=${_RUNTIME_KEY} result=$QianjiVerifyResourceResult instDir=$INSTDIR"
  ${EndIf}
!macroend

!macro customInstall
  !insertmacro QIANJI_VERIFY_CORE_APP_FILES
  !insertmacro QIANJI_VERIFY_BUNDLED_QIANJICORE_RESOURCES "${QIANJI_RUNTIME_KEY}"
  !insertmacro QIANJI_LOG_EVENT "verify-install ok instDir=$INSTDIR"
  !insertmacro QIANJI_CLEAR_ACTIVE_INSTALLER_MARKER
  !insertmacro QIANJI_SESSION_SUCCESS
!macroend

!endif
