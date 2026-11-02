!ifndef QIANJI_INSTALLER_REMOVE_REGISTRY_NSH
!define QIANJI_INSTALLER_REMOVE_REGISTRY_NSH

!macro QIANJI_CLEAR_INSTALL_REGISTRY _REASON
  DeleteRegKey SHCTX "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey SHCTX "${INSTALL_REGISTRY_KEY}"
  !insertmacro QIANJI_LOG_EVENT "event=registry-clear reason=${_REASON} uninstallKey=${UNINSTALL_REGISTRY_KEY} installKey=${INSTALL_REGISTRY_KEY}"
!macroend

!macro QIANJI_LOG_ATOMIC_REMOVE_FAILURE
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$QianjiSessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${QIANJI_FALLBACK_LOG}' }; \
    $$failed = '$QianjiAtomicFailedPath'; \
    $$instDir = '$INSTDIR'; \
    $$oldInstallDir = '$QianjiAtomicStagingDir'; \
    $$relative = $$failed; \
    if ($$failed.StartsWith($$instDir, [System.StringComparison]::CurrentCultureIgnoreCase)) { $$relative = $$failed.Substring($$instDir.Length).TrimStart('\') }; \
    $$tempCandidate = if ($$relative -and $$relative -ne $$failed) { Join-Path $$oldInstallDir $$relative } else { '' }; \
    $$kind = if ($$tempCandidate.Length -ge 260) { 'likely-long-path' } else { 'unknown' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$QianjiSessionId'; version = '${VERSION}'; arch = '${QIANJI_TARGET_ARCH}'; updated = ('$QianjiIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'remove-atomic-failed'; kind = $$kind; pathLength = $$failed.Length; tempCandidateLength = $$tempCandidate.Length; atomicFailedPath = $$failed; tempCandidate = $$tempCandidate }; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) \
  }"`
  Pop $9
  Pop $9
!macroend

!macro QIANJI_LOG_REMOVE_FAILURE_JSON _PHASE _FATAL _FAILED_PATH _EXTRA_FIELDS
  !insertmacro QIANJI_LOG_JSON_EVENT "failure" "$$lockerText = '$QianjiLockerList'; $$processes = @(); if ($$lockerText -and $$lockerText -notlike 'Windows did not identify*' -and $$lockerText -ne 'unknown process') { $$processes = @($$lockerText -split ',\s*' | Where-Object { $$_ } | ForEach-Object { if ($$_ -match '^(.*)\(([0-9]+)\)$$') { [ordered]@{ name = $$Matches[1]; pid = [int]$$Matches[2] } } else { [ordered]@{ name = $$_; pid = $$null } } }) }; $$payload.code = '${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED}'; $$payload.phase = '${_PHASE}'; $$payload.failedPath = '${_FAILED_PATH}'; $$payload.blockingProcesses = @($$processes); if ($$lockerText -like 'Qianji installer(*)') { $$payload.fallbackReason = 'installer-self-lock'; $$payload.message = 'The installer process is using the install directory as its current output directory.' } elseif ($$processes.Count -eq 0) { $$payload.fallbackReason = 'restart-manager-no-process'; $$payload.message = 'Windows did not identify a specific locking process. Close terminals, editors, and file managers opened in the install folder.' } else { $$payload.fallbackReason = ''; $$payload.message = '' }; $$payload.fatal = ('${_FATAL}' -eq '1'); ${_EXTRA_FIELDS}"
!macroend

!macro QIANJI_REMOVE_INSTALL_DIR
  StrCpy $QianjiRemoveResidueCount "0"
  ${If} $QianjiRemoveResidueRoot == ""
    StrCpy $QianjiRemoveResidueRoot "$INSTDIR"
  ${EndIf}
  StrCpy $QianjiRemoveFirstFailedPath ""
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'Continue'; \
    $$log = '$QianjiSessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${QIANJI_FALLBACK_LOG}' }; \
    $$path = [System.IO.Path]::GetFullPath('$QianjiRemoveResidueRoot'); \
    $$firstFailedFile = '$PLUGINSDIR\qianji-remove-first-failed.txt'; \
    Set-Content -LiteralPath $$firstFailedFile -Encoding UTF8 -NoNewline -Value ''; \
    function Write-InstallerLog($$message) { $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = '$QianjiSessionId'; version = '${VERSION}'; arch = '${QIANJI_TARGET_ARCH}'; updated = ('$QianjiIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = 'remove-log'; message = $$message }; if ($$message -match '(^|\s)event=([^\s]+)') { $$payload.event = $$Matches[2] }; Add-Content -LiteralPath $$log -Encoding UTF8 -Value ($$payload | ConvertTo-Json -Compress -Depth 8) } \
    function Convert-LongPath($$itemPath) { if ($$itemPath.StartsWith('\\')) { return '\\?\UNC\' + $$itemPath.TrimStart('\') } return '\\?\' + $$itemPath } \
    function Remove-WithRetries($$item, $$isDir) { \
      $$delays = @(200,500,1000); \
      for ($$i = 0; $$i -lt $$delays.Count; $$i++) { \
        try { \
          if ($$isDir) { [System.IO.Directory]::Delete((Convert-LongPath $$item), $$false) } else { [System.IO.File]::Delete((Convert-LongPath $$item)) } \
          return $$true \
        } catch { \
          if ($$i -lt $$delays.Count - 1) { Start-Sleep -Milliseconds $$delays[$$i] } else { Write-InstallerLog ('event=remove-resilient-leftover path=' + $$item + ' attempts=3 error=' + $$_.Exception.GetType().FullName + ': ' + $$_.Exception.Message); return $$false } \
        } \
      } \
      return $$false \
    } \
    try { \
      if (-not (Test-Path -LiteralPath $$path)) { Write-InstallerLog ('remove-longpath result=0 instDir=' + $$path); exit 0 } \
      $$failed = New-Object System.Collections.Generic.List[string]; \
      foreach ($$file in @(Get-ChildItem -LiteralPath $$path -Force -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)) { if (-not (Remove-WithRetries $$file.FullName $$false)) { $$failed.Add($$file.FullName) } } \
      foreach ($$dir in @(Get-ChildItem -LiteralPath $$path -Force -Recurse -Directory -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)) { if (-not (Remove-WithRetries $$dir.FullName $$true)) { $$failed.Add($$dir.FullName) } } \
      if (-not (Remove-WithRetries $$path $$true)) { $$failed.Add($$path) } \
      Write-InstallerLog ('event=remove-resilient-summary failedCount=' + $$failed.Count + ' root=' + $$path); \
      if ($$failed.Count -gt 0) { Set-Content -LiteralPath $$firstFailedFile -Encoding UTF8 -NoNewline -Value $$failed[0]; exit $$failed.Count } \
      Write-InstallerLog ('remove-longpath result=0 instDir=' + $$path); \
      exit 0 \
    } catch { \
      Write-InstallerLog ('remove-longpath result=1 instDir=' + $$path + ' error=' + $$_.Exception.GetType().FullName + ': ' + $$_.Exception.Message); \
      exit 1 \
    } \
  }"`
  Pop $QianjiRemoveDirResult

  ClearErrors
  SetDetailsPrint none
  FileOpen $QianjiRemoveFirstFailedFile "$PLUGINSDIR\qianji-remove-first-failed.txt" r
  ${IfNot} ${Errors}
    FileRead $QianjiRemoveFirstFailedFile $QianjiRemoveFirstFailedPath
    FileClose $QianjiRemoveFirstFailedFile
  ${EndIf}
  SetDetailsPrint lastused

  ${If} $QianjiRemoveDirResult == "error"
    !insertmacro QIANJI_LOG_EVENT "event=remove-longpath fallback=RMDir reason=no-powershell root=$INSTDIR"
    RMDir /r "$QianjiRemoveResidueRoot"
    ${If} ${FileExists} "$QianjiRemoveResidueRoot\*.*"
      StrCpy $QianjiRemoveDirResult "1"
    ${Else}
      StrCpy $QianjiRemoveDirResult "0"
    ${EndIf}
  ${EndIf}

  ${If} $QianjiRemoveDirResult != 0
    StrCpy $QianjiRemoveResidueCount $QianjiRemoveDirResult
  ${EndIf}
!macroend

!macro customRemoveFiles
  !insertmacro QIANJI_LOG_EVENT "remove-start instDir=$INSTDIR"
  Var /GLOBAL QianjiRemoveDirResult
  Var /GLOBAL QianjiAtomicFailedPath
  Var /GLOBAL QianjiAtomicRemoveSucceeded
  Var /GLOBAL QianjiAtomicStagingDir
  Var /GLOBAL QianjiRemoveResidueCount
  Var /GLOBAL QianjiRemoveResidueRoot
  Var /GLOBAL QianjiRemoveFirstFailedPath
  Var /GLOBAL QianjiRemoveFirstFailedFile
  StrCpy $QianjiAtomicFailedPath ""
  StrCpy $QianjiAtomicRemoveSucceeded "0"
  StrCpy $QianjiAtomicStagingDir ""
  StrCpy $QianjiRemoveResidueCount "0"
  StrCpy $QianjiRemoveResidueRoot "$INSTDIR"
  StrCpy $QianjiRemoveFirstFailedPath ""

  SetOutPath $TEMP
  StrCpy $QianjiCurrentOutDir "$TEMP"

  ${if} ${isUpdated}
    StrCpy $QianjiAtomicStagingDir "$INSTDIR.__old"
    ${If} ${FileExists} "$QianjiAtomicStagingDir\*.*"
      StrCpy $QianjiRemoveResidueRoot "$QianjiAtomicStagingDir"
      !insertmacro QIANJI_LOG_EVENT "remove-stale-staging start root=$QianjiRemoveResidueRoot"
      !insertmacro QIANJI_REMOVE_INSTALL_DIR
      StrCpy $QianjiRemoveResidueRoot "$INSTDIR"
    ${EndIf}

    qianji_retry_atomic_rename:
      ClearErrors
      Rename "$INSTDIR" "$QianjiAtomicStagingDir"
    ${if} ${Errors}
      DetailPrint "Atomic update cleanup failed before replacing previous installation: $INSTDIR"
      StrCpy $QianjiAtomicFailedPath "$INSTDIR"
      !insertmacro QIANJI_LOG_ATOMIC_REMOVE_FAILURE
      !insertmacro QIANJI_CAPTURE_FAILED_PATH_LOCKERS "$QianjiAtomicFailedPath"
      ${IfNot} ${Silent}
        !insertmacro QIANJI_PROMPT_FAILED_PATH_LOCKERS "$QianjiAtomicFailedPath" "atomic-failed" qianji_retry_atomic_rename qianji_cancel_atomic_rename qianji_continue_atomic_failed
        qianji_cancel_atomic_rename:
      ${EndIf}
      qianji_continue_atomic_failed:
      !insertmacro QIANJI_LOG_REMOVE_FAILURE_JSON "atomic-failed" "1" "$QianjiAtomicFailedPath" "$$payload.atomicFailedPath = '$QianjiAtomicFailedPath'"
      !insertmacro QIANJI_LOG_EVENT "code=${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=atomic-failed fatal=1 degraded=none firstFailed=$QianjiAtomicFailedPath atomicFailedPath=$QianjiAtomicFailedPath"
      !insertmacro QIANJI_CLEAR_INSTALL_REGISTRY "remove-failed-before-quit"
      !insertmacro QIANJI_FAIL_REPORTABLE_BILINGUAL ${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} "event=session-end result=fail code=${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=atomic-failed fatal=1 firstFailed=$QianjiAtomicFailedPath lockers=$QianjiLockerList" "${QIANJI_MSG_REPLACE_LOCKED_EN}" "${QIANJI_MSG_REPLACE_LOCKED_ZH}" "${QIANJI_MSG_CLOSE_SHOWN_FILE_ACTION_EN}" "${QIANJI_MSG_CLOSE_SHOWN_FILE_ACTION_ZH}"
    ${else}
      !insertmacro QIANJI_LOG_EVENT "remove-atomic result=0 staging=$QianjiAtomicStagingDir"
      StrCpy $QianjiAtomicRemoveSucceeded "1"
      StrCpy $QianjiRemoveResidueRoot "$QianjiAtomicStagingDir"
    ${endif}
  ${endif}

  qianji_retry_remove_install_dir:
    !insertmacro QIANJI_REMOVE_INSTALL_DIR
  ${if} $QianjiRemoveDirResult != 0
    !insertmacro QIANJI_CAPTURE_FAILED_PATH_LOCKERS "$QianjiRemoveFirstFailedPath"
    ${if} $QianjiAtomicRemoveSucceeded == "1"
      ${IfNot} ${Silent}
        !insertmacro QIANJI_PROMPT_FAILED_PATH_LOCKERS "$QianjiRemoveFirstFailedPath" "residual-delete-failed" qianji_retry_remove_install_dir qianji_cancel_remove_after_rm qianji_continue_after_rm
        qianji_cancel_remove_after_rm:
          !insertmacro QIANJI_LOG_REMOVE_FAILURE_JSON "residual-delete-failed" "1" "$QianjiRemoveFirstFailedPath" "$$payload.residueRoot = '$QianjiRemoveResidueRoot'; $$payload.failedCount = '$QianjiRemoveResidueCount'; $$payload.removeDirResult = '$QianjiRemoveDirResult'; $$payload.atomicSucceeded = ('$QianjiAtomicRemoveSucceeded' -eq '1')"
          !insertmacro QIANJI_LOG_EVENT "code=${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed userAction=cancel fatal=1 residueRoot=$QianjiRemoveResidueRoot failedCount=$QianjiRemoveResidueCount firstFailed=$QianjiRemoveFirstFailedPath removeDirResult=$QianjiRemoveDirResult removeResidueCount=$QianjiRemoveResidueCount atomicFailedPath=$QianjiAtomicFailedPath atomicSucceeded=$QianjiAtomicRemoveSucceeded"
          !insertmacro QIANJI_FAIL_REPORTABLE_BILINGUAL ${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} "event=session-end result=fail code=${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed userAction=cancel fatal=1 firstFailed=$QianjiRemoveFirstFailedPath lockers=$QianjiLockerList" "${QIANJI_MSG_PREVIOUS_FILE_OPEN_EN}" "${QIANJI_MSG_PREVIOUS_FILE_OPEN_ZH}" "${QIANJI_MSG_CLOSE_SHOWN_FILE_ACTION_EN}" "${QIANJI_MSG_CLOSE_SHOWN_FILE_ACTION_ZH}"
      ${EndIf}
      qianji_continue_after_rm:
      DetailPrint `Qianji previous installation had locked residual files; continuing after atomic cleanup succeeded: $INSTDIR`
      !insertmacro QIANJI_LOG_EVENT "code=${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed degraded=continue fatal=0 residueRoot=$QianjiRemoveResidueRoot failedCount=$QianjiRemoveResidueCount firstFailed=$QianjiRemoveFirstFailedPath removeDirResult=$QianjiRemoveDirResult removeResidueCount=$QianjiRemoveResidueCount atomicFailedPath=$QianjiAtomicFailedPath atomicSucceeded=$QianjiAtomicRemoveSucceeded"
    ${else}
      DetailPrint `Can't safely remove previous installation without atomic cleanup proof: $INSTDIR`
      ${IfNot} ${Silent}
        !insertmacro QIANJI_PROMPT_FAILED_PATH_LOCKERS "$QianjiRemoveFirstFailedPath" "residual-delete-failed-no-atomic-proof" qianji_retry_remove_install_dir qianji_cancel_remove_no_atomic qianji_continue_remove_no_atomic
        qianji_cancel_remove_no_atomic:
      ${EndIf}
      qianji_continue_remove_no_atomic:
      !insertmacro QIANJI_LOG_REMOVE_FAILURE_JSON "residual-delete-failed-no-atomic-proof" "1" "$QianjiRemoveFirstFailedPath" "$$payload.residueRoot = '$QianjiRemoveResidueRoot'; $$payload.failedCount = '$QianjiRemoveResidueCount'; $$payload.removeDirResult = '$QianjiRemoveDirResult'; $$payload.atomicSucceeded = ('$QianjiAtomicRemoveSucceeded' -eq '1')"
      !insertmacro QIANJI_LOG_EVENT "code=${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed-no-atomic-proof degraded=none fatal=1 residueRoot=$QianjiRemoveResidueRoot failedCount=$QianjiRemoveResidueCount firstFailed=$QianjiRemoveFirstFailedPath removeDirResult=$QianjiRemoveDirResult removeResidueCount=$QianjiRemoveResidueCount atomicFailedPath=$QianjiAtomicFailedPath atomicSucceeded=$QianjiAtomicRemoveSucceeded"
      !insertmacro QIANJI_CLEAR_INSTALL_REGISTRY "remove-failed-before-quit"
      !insertmacro QIANJI_FAIL_REPORTABLE_BILINGUAL ${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} "event=session-end result=fail code=${QIANJI_E_INSTALL_DIR_REMOVE_OR_LOCKED} phase=residual-delete-failed-no-atomic-proof fatal=1 firstFailed=$QianjiRemoveFirstFailedPath removeDirResult=$QianjiRemoveDirResult lockers=$QianjiLockerList" "${QIANJI_MSG_REMOVE_PREVIOUS_DIR_EN}" "${QIANJI_MSG_REMOVE_PREVIOUS_DIR_ZH}" "${QIANJI_MSG_CLOSE_INSTALL_DIR_ACTION_EN}" "${QIANJI_MSG_CLOSE_INSTALL_DIR_ACTION_ZH}"
    ${endif}
  ${else}
    !insertmacro QIANJI_LOG_EVENT "remove-final errors=0 instDir=$INSTDIR removeDirResult=$QianjiRemoveDirResult removeResidueCount=$QianjiRemoveResidueCount removeResidueRoot=$QianjiRemoveResidueRoot atomicFailedPath=$QianjiAtomicFailedPath atomicSucceeded=$QianjiAtomicRemoveSucceeded"
  ${endif}
!macroend

!macro customUnInit
  !insertmacro QIANJI_LOG_EVENT "uninit instDir=$INSTDIR"
!macroend

!macro customUnInstall
  !insertmacro QIANJI_LOG_EVENT "uninstall-section start instDir=$INSTDIR"
!macroend

!endif
