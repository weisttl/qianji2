!ifndef QIANJI_INSTALLER_OBSERVABILITY_NSH
!define QIANJI_INSTALLER_OBSERVABILITY_NSH

!define QIANJI_APP_EXECUTABLE_FILENAME "Qianji.exe"
!define QIANJI_FALLBACK_LOG "qianji-installer-${VERSION}-fallback-log.jsonl"

!pragma warning disable 6001
Var /GLOBAL QianjiSessionId
Var /GLOBAL QianjiIsUpdated
Var /GLOBAL QianjiSessionLogResult
Var /GLOBAL QianjiSessionLogPath

!macro QIANJI_SESSION_HEADER
  !insertmacro QIANJI_SLOG "event=header arch=${QIANJI_TARGET_ARCH} updated=$QianjiIsUpdated instDir=$INSTDIR version=${VERSION} log=$QianjiSessionLogPath detail=customHeader"
!macroend

!macro QIANJI_SLOG _MESSAGE
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$QianjiSessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${QIANJI_FALLBACK_LOG}' }; \
    $$session = '$QianjiSessionId'; \
    if (-not $$session) { $$session = 'uninitialized' }; \
    $$message = '${_MESSAGE}'; \
    $$event = 'log'; \
    if ($$message -match '(^|\s)event=([^\s]+)') { $$event = $$Matches[2] } else { $$first = @($$message -split '\s+', 2)[0]; if ($$first -and $$first -notmatch '=') { $$event = $$first } }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = $$session; version = '${VERSION}'; arch = '${QIANJI_TARGET_ARCH}'; updated = ('$QianjiIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = $$event; message = $$message }; \
    $$json = $$payload | ConvertTo-Json -Compress -Depth 8; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value $$json \
  }"`
  Pop $9
  Pop $9
!macroend

!macro QIANJI_LOG_EVENT _MESSAGE
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$QianjiSessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${QIANJI_FALLBACK_LOG}' }; \
    $$session = '$QianjiSessionId'; \
    if (-not $$session) { $$session = 'uninitialized' }; \
    $$message = '${_MESSAGE}'; \
    $$event = 'log'; \
    if ($$message -match '(^|\s)event=([^\s]+)') { $$event = $$Matches[2] } else { $$first = @($$message -split '\s+', 2)[0]; if ($$first -and $$first -notmatch '=') { $$event = $$first } }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = $$session; version = '${VERSION}'; arch = '${QIANJI_TARGET_ARCH}'; updated = ('$QianjiIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = $$event; message = $$message }; \
    $$json = $$payload | ConvertTo-Json -Compress -Depth 8; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value $$json \
  }"`
  Pop $9
  Pop $9
!macroend

!macro QIANJI_LOG_JSON_EVENT _EVENT _JSON_FIELDS
  Push $9
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { \
    $$ErrorActionPreference = 'SilentlyContinue'; \
    $$log = '$QianjiSessionLogPath'; \
    if (-not $$log) { $$log = Join-Path $$env:TEMP '${QIANJI_FALLBACK_LOG}' }; \
    $$session = '$QianjiSessionId'; \
    if (-not $$session) { $$session = 'uninitialized' }; \
    $$payload = [ordered]@{ schemaVersion = 1; ts = (Get-Date -Format o); session = $$session; version = '${VERSION}'; arch = '${QIANJI_TARGET_ARCH}'; updated = ('$QianjiIsUpdated' -eq '1'); instDir = '$INSTDIR'; event = '${_EVENT}' }; \
    ${_JSON_FIELDS}; \
    $$json = $$payload | ConvertTo-Json -Compress -Depth 8; \
    Add-Content -LiteralPath $$log -Encoding UTF8 -Value $$json \
  }"`
  Pop $9
  Pop $9
!macroend

!macro QIANJI_SESSION_BEGIN
  ${GetParameters} $R9
  ClearErrors
  ${GetOptions} $R9 "--installer-log=" $R8
  ${IfNot} ${Errors}
    StrCpy $QianjiSessionLogPath $R8
  ${EndIf}
  ClearErrors
  ${GetOptions} $R9 "--installer-session=" $R8
  ${IfNot} ${Errors}
    StrCpy $QianjiSessionId $R8
  ${EndIf}

  ${If} $QianjiSessionLogPath == ""
    nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$$id = '$QianjiSessionId'; if (-not $$id) { $$id = [guid]::NewGuid().ToString('N').Substring(0,12) }; $$stamp = Get-Date -Format 'yyyyMMdd'; $$name = 'qianji-installer-${VERSION}-' + $$stamp + '-log.jsonl'; $$log = Join-Path $$env:TEMP $$name; [Console]::Out.Write($$id + '|' + $$log)"`
    Pop $QianjiSessionLogResult
    Pop $QianjiSessionLogResult
    StrCpy $QianjiSessionId $QianjiSessionLogResult 12
    StrCpy $QianjiSessionLogPath $QianjiSessionLogResult 1024 13
  ${ElseIf} $QianjiSessionId == ""
    nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "[Console]::Out.Write([guid]::NewGuid().ToString('N').Substring(0,12))"`
    Pop $QianjiSessionLogResult
    Pop $QianjiSessionLogResult
    StrCpy $QianjiSessionId $QianjiSessionLogResult
  ${EndIf}

  ClearErrors
  ${GetOptions} $R9 "--updated" $R8
  StrCpy $QianjiIsUpdated "0"
  ${IfNot} ${Errors}
    StrCpy $QianjiIsUpdated "1"
  ${EndIf}

  !insertmacro QIANJI_SLOG "event=session-begin detail=preInit"
!macroend

!macro QIANJI_LOG_EXTRACT_RESULT _METHOD
  ${IfNot} ${FileExists} "$INSTDIR\Qianji.exe"
    !insertmacro QIANJI_FAIL_UX \
      "${QIANJI_E_EXTRACT_FAILED}" \
      "event=extract result=fail method=${_METHOD} missing=Qianji.exe" \
      "${QIANJI_MSG_EXTRACT_FAILED_ZH}" \
      "${QIANJI_MSG_EXTRACT_FAILED_EN}" \
      "${QIANJI_MSG_EXTRACT_FAILED_ACTION_ZH}" \
      "${QIANJI_MSG_EXTRACT_FAILED_ACTION_EN}" \
      "extract result=fail method=${_METHOD} missing=Qianji.exe instDir=$INSTDIR" \
      "extract result=fail method=${_METHOD} missing=Qianji.exe instDir=$INSTDIR"
  ${Else}
    !insertmacro QIANJI_SLOG "event=extract result=ok method=${_METHOD} detail=customFiles_${QIANJI_TARGET_ARCH}"
  ${EndIf}
!macroend

!macro QIANJI_SESSION_SUCCESS
  !insertmacro QIANJI_SLOG "event=session-end result=success detail=customInstall"
!macroend

!endif
