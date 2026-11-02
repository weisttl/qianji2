!ifndef QIANJI_INSTALLER_REPAIR_HEAL_NSH
!define QIANJI_INSTALLER_REPAIR_HEAL_NSH

Var /GLOBAL QianjiRegistryInstallIsValid
Var /GLOBAL QianjiInnerFailureSummary
Var /GLOBAL QianjiInnerRootCode
Var /GLOBAL QianjiInnerFailureReadResult

!macro QIANJI_READ_LAST_INNER_FAILURE
  InitPluginsDir
  StrCpy $QianjiInnerRootCode ""
  StrCpy $QianjiInnerFailureSummary "No specific locking process was identified. Close Qianji, terminals, editors, and file managers opened in the install folder."
  nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$logPath = '$QianjiSessionLogPath'; \
    $$summary = 'No specific locking process was identified. Close Qianji, terminals, editors, and file managers opened in the install folder.'; \
    $$code = ''; \
    if ($$logPath -and (Test-Path -LiteralPath $$logPath)) { \
      $$events = @(Get-Content -LiteralPath $$logPath -ErrorAction SilentlyContinue | ForEach-Object { try { $$_ | ConvertFrom-Json } catch { $$null } } | Where-Object { $$_ }); \
      $$failure = @($$events | Where-Object { $$_.event -eq 'failure' -and $$_.updated -eq $$true } | Select-Object -Last 1)[0]; \
      if (-not $$failure) { $$failure = @($$events | Where-Object { $$_.event -eq 'failure' } | Select-Object -Last 1)[0] }; \
      if ($$failure) { \
        $$code = ([string]$$failure.code).Trim(); \
        $$phase = ([string]$$failure.phase).Trim(); \
        $$path = ([string]$$failure.failedPath).Trim(); \
        $$blocking = ''; \
        $$processes = @($$failure.blockingProcesses); \
        if ($$processes.Count -gt 0) { $$blocking = (@($$processes | ForEach-Object { if ($$_.pid) { [string]$$_.name + '(' + [string]$$_.pid + ')' } else { [string]$$_.name } }) -join ', ') }; \
        if (-not $$blocking) { $$blocking = ([string]$$failure.message).Trim() }; \
        if (-not $$blocking) { $$blocking = 'Windows did not identify a specific locking process. Close terminals, editors, and file managers opened in the install folder.' }; \
        $$parts = @('- Outer installer: previous uninstaller exited with code $R0', ('- Inner failure: ' + $$code + ' phase ' + $$phase)); \
        if ($$path) { $$parts += ('- File or folder: ' + $$path) }; \
        $$parts += ('- Blocking process: ' + $$blocking); \
        $$summary = $$parts -join [Environment]::NewLine; \
      } \
    }; \
    if (-not $$code) { $$code = '-----' }; \
    [Console]::Out.Write($$code + '|' + $$summary) \
  }"`
  Pop $QianjiInnerFailureReadResult
  Pop $QianjiInnerFailureReadResult
  StrCpy $QianjiInnerRootCode $QianjiInnerFailureReadResult 5
  ${If} $QianjiInnerRootCode == "-----"
    StrCpy $QianjiInnerRootCode ""
  ${EndIf}
  StrCpy $QianjiInnerFailureSummary $QianjiInnerFailureReadResult 4096 6
!macroend

!macro QIANJI_LOG_UNINSTALLER_REPAIR _PHASE
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$QianjiSessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${QIANJI_FALLBACK_LOG}' }; \
    $$path = '$INSTDIR\${UNINSTALL_FILENAME}'; \
    $$item = Get-Item -LiteralPath $$path -ErrorAction SilentlyContinue; \
    $$version = if ($$item) { $$item.VersionInfo.ProductVersion } else { '' }; \
    $$length = if ($$item) { $$item.Length } else { '' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$QianjiSessionId'; version = '${VERSION}'; arch = '${QIANJI_TARGET_ARCH}'; updated = ('$QianjiIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'uninstaller-repair'; phase = '${_PHASE}'; path = $$path; exists = [bool]$$item; productVersion = $$version; length = $$length }; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) \
  }"`
  Pop $QianjiRepairLogResult
!macroend

!macro QIANJI_REPAIR_INSTALLED_UNINSTALLER
  Var /GLOBAL QianjiInstalledUninstaller
  Var /GLOBAL QianjiBundledUninstaller
  Var /GLOBAL QianjiRepairLogResult

  !insertmacro QIANJI_LOG_UNINSTALLER_REPAIR "before"
  StrCpy $QianjiInstalledUninstaller "$INSTDIR\${UNINSTALL_FILENAME}"

  InitPluginsDir
  StrCpy $QianjiBundledUninstaller "$PLUGINSDIR\Qianji-fixed-uninstaller.exe"
  SetOverwrite on
  File "/oname=$PLUGINSDIR\Qianji-fixed-uninstaller.exe" "${UNINSTALLER_OUT_FILE}"

  ${If} ${FileExists} "$QianjiInstalledUninstaller"
    ClearErrors
    CopyFiles /SILENT "$QianjiBundledUninstaller" "$QianjiInstalledUninstaller"
    ${If} ${Errors}
      !insertmacro QIANJI_LOG_UNINSTALLER_REPAIR "copy-failed-retry"
      !insertmacro QIANJI_STOP_APP_PROCESSES
      Sleep 1000

      ClearErrors
      CopyFiles /SILENT "$QianjiBundledUninstaller" "$QianjiInstalledUninstaller"
      ${If} ${Errors}
        ${If} ${FileExists} "$QianjiBundledUninstaller"
          !insertmacro QIANJI_LOG_UNINSTALLER_REPAIR "copy-failed-using-bundled"
          !insertmacro QIANJI_LOG_EVENT "event=uninstaller-repair phase=copy-failed-using-bundled"
        ${Else}
          !insertmacro QIANJI_FAIL_REPORTABLE_BILINGUAL ${QIANJI_E_UNINSTALLER_COPY_OR_REBUILD_FAILED} "uninstaller-repair copy-failed-retry-bundled-missing" "${QIANJI_MSG_UNINSTALLER_COPY_LOCKED_EN}" "${QIANJI_MSG_UNINSTALLER_COPY_LOCKED_ZH}" "${QIANJI_MSG_UNINSTALLER_REPAIR_ACTION_EN}" "${QIANJI_MSG_UNINSTALLER_REPAIR_ACTION_ZH}"
        ${EndIf}
      ${Else}
        !insertmacro QIANJI_LOG_UNINSTALLER_REPAIR "after-copy-retry"
      ${EndIf}
    ${Else}
      !insertmacro QIANJI_LOG_UNINSTALLER_REPAIR "after-copy"
    ${EndIf}
  ${Else}
    ClearErrors
    CopyFiles /SILENT "$QianjiBundledUninstaller" "$QianjiInstalledUninstaller"
    ${If} ${Errors}
      !insertmacro QIANJI_FAIL_REPORTABLE_BILINGUAL ${QIANJI_E_UNINSTALLER_COPY_OR_REBUILD_FAILED} "uninstaller-repair rebuild-failed" "${QIANJI_MSG_UNINSTALLER_REBUILD_FAILED_EN}" "${QIANJI_MSG_UNINSTALLER_REBUILD_FAILED_ZH}" "${QIANJI_MSG_UNINSTALLER_REPAIR_ACTION_EN}" "${QIANJI_MSG_UNINSTALLER_REPAIR_ACTION_ZH}"
    ${EndIf}

    ${IfNot} ${FileExists} "$QianjiInstalledUninstaller"
      !insertmacro QIANJI_FAIL_REPORTABLE_BILINGUAL ${QIANJI_E_UNINSTALLER_COPY_OR_REBUILD_FAILED} "uninstaller-repair rebuild-missing-after-copy" "${QIANJI_MSG_UNINSTALLER_REBUILD_MISSING_EN}" "${QIANJI_MSG_UNINSTALLER_REBUILD_MISSING_ZH}" "${QIANJI_MSG_UNINSTALLER_REPAIR_ACTION_EN}" "${QIANJI_MSG_UNINSTALLER_REPAIR_ACTION_ZH}"
    ${EndIf}

    !insertmacro QIANJI_LOG_UNINSTALLER_REPAIR "rebuilt"
    !insertmacro QIANJI_LOG_EVENT "event=uninstaller-repair phase=rebuilt"
  ${EndIf}
!macroend

!macro QIANJI_HEAL_INSTALL_REGISTRY
  Var /GLOBAL QianjiRegInstallLocation
  Var /GLOBAL QianjiRegUninstallString
  Var /GLOBAL QianjiRegInstallExe

  StrCpy $QianjiRegistryInstallIsValid "0"

  ReadRegStr $QianjiRegInstallLocation SHCTX "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $QianjiRegUninstallString SHCTX "${UNINSTALL_REGISTRY_KEY}" "UninstallString"

  ${If} $QianjiRegInstallLocation == ""
    !insertmacro QIANJI_LOG_EVENT "event=registry-heal phase=missing-install-location uninstallString=$QianjiRegUninstallString"
    !insertmacro QIANJI_CLEAR_INSTALL_REGISTRY "missing-install-location"
  ${Else}
    StrCpy $QianjiRegInstallExe "$QianjiRegInstallLocation\${QIANJI_APP_EXECUTABLE_FILENAME}"
    ${If} ${FileExists} "$QianjiRegInstallExe"
      StrCpy $INSTDIR "$QianjiRegInstallLocation"
      StrCpy $QianjiRegistryInstallIsValid "1"
      !insertmacro QIANJI_LOG_EVENT "event=registry-heal phase=valid-install-location instDir=$INSTDIR uninstallString=$QianjiRegUninstallString"
    ${Else}
      !insertmacro QIANJI_LOG_EVENT "event=registry-heal phase=stale-install-location installLocation=$QianjiRegInstallLocation uninstallString=$QianjiRegUninstallString"
      !insertmacro QIANJI_CLEAR_INSTALL_REGISTRY "stale-install-location"
    ${EndIf}
  ${EndIf}
!macroend

!macro QIANJI_LOG_UNINSTALL_RESULT _ROOT_KEY _HAD_ERRORS
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$QianjiSessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${QIANJI_FALLBACK_LOG}' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$QianjiSessionId'; version = '${VERSION}'; arch = '${QIANJI_TARGET_ARCH}'; updated = ('$QianjiIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'uninstall-result'; root = '${_ROOT_KEY}'; launchErrors = '${_HAD_ERRORS}'; exitCode = '$R0' }; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) \
  }"`
  Pop $QianjiUninstallLogResult
!macroend

!macro QIANJI_HANDLE_UNINSTALL_RESULT _ROOT_KEY _LABEL_PREFIX
  ${If} ${Errors}
    StrCpy $QianjiUninstallHadErrors "1"
  ${Else}
    StrCpy $QianjiUninstallHadErrors "0"
  ${EndIf}

  !insertmacro QIANJI_LOG_UNINSTALL_RESULT "${_ROOT_KEY}" "$QianjiUninstallHadErrors"

  ${If} $QianjiUninstallHadErrors == "1"
    DetailPrint `Uninstall was not successful. Not able to launch uninstaller!`
    Return
  ${EndIf}

  ${If} $R0 != 0
      DetailPrint `Uninstall was not successful. Uninstaller error code: $R0.`
      !insertmacro QIANJI_READ_LAST_INNER_FAILURE
      ${If} $QianjiLockerList != ""
        StrCpy $QianjiInnerFailureSummary "- Failure: previous uninstaller failed with exit code $R0$\r$\n- File or folder: $INSTDIR$\r$\n- Blocking process: $QianjiLockerList"
      ${EndIf}
      !insertmacro QIANJI_LOG_EVENT "event=old-uninstaller-failed action=report exitCode=$R0 lockers=$QianjiLockerList uninstallerDetail=$QianjiInnerFailureSummary"
      ${If} $QianjiInnerRootCode != ""
        !insertmacro QIANJI_FAIL_REPORTABLE_ROOTED_BILINGUAL_DIAGNOSTICS "$QianjiInnerRootCode" ${QIANJI_E_OLD_UNINSTALL_FAILED} "old-uninstaller exitCode=$R0 lockers=$QianjiLockerList uninstallerDetail=$QianjiInnerFailureSummary" "${QIANJI_MSG_OLD_UNINSTALL_FAILED_EN}" "${QIANJI_MSG_OLD_UNINSTALL_FAILED_ZH}" "${QIANJI_MSG_OLD_UNINSTALL_ACTION_EN}" "${QIANJI_MSG_OLD_UNINSTALL_ACTION_ZH}" "$QianjiInnerFailureSummary" "$QianjiInnerFailureSummary"
      ${Else}
        !insertmacro QIANJI_FAIL_REPORTABLE_BILINGUAL_DIAGNOSTICS ${QIANJI_E_OLD_UNINSTALL_FAILED} "old-uninstaller exitCode=$R0 lockers=$QianjiLockerList uninstallerDetail=$QianjiInnerFailureSummary" "${QIANJI_MSG_OLD_UNINSTALL_FAILED_EN}" "${QIANJI_MSG_OLD_UNINSTALL_FAILED_ZH}" "${QIANJI_MSG_OLD_UNINSTALL_ACTION_EN}" "${QIANJI_MSG_OLD_UNINSTALL_ACTION_ZH}" "$QianjiInnerFailureSummary" "$QianjiInnerFailureSummary"
      ${EndIf}
  ${EndIf}
!macroend

!macro customInit
  !insertmacro QIANJI_HEAL_INSTALL_REGISTRY
  ${If} $QianjiRegistryInstallIsValid == "1"
    !insertmacro QIANJI_REPAIR_INSTALLED_UNINSTALLER
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro QIANJI_HANDLE_UNINSTALL_RESULT "SHELL_CONTEXT" "shctx"
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro QIANJI_HANDLE_UNINSTALL_RESULT "HKEY_CURRENT_USER" "hkcu"
!macroend

!endif
