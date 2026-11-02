; x64 architecture entry for the NSIS installer.

!include "x64.nsh"

!define QIANJI_TARGET_ARCH "x64"
!define QIANJI_RUNTIME_KEY "win32-x64"
!define QIANJI_EXTRACT_METHOD "7z"

!addincludedir "${PROJECT_DIR}\resources\windows"
!include "installer-common.nsh"

!macro customHeader
  !insertmacro QIANJI_INSTALLER_CUSTOM_HEADER
!macroend

!macro preInit
  !insertmacro QIANJI_INSTALLER_PREINIT
!macroend

!macro customFiles_x64
  !insertmacro QIANJI_LOG_EXTRACT_RESULT "7z"
!macroend

; Architecture guard. Inserted from QIANJI_INSTALLER_PREINIT (preInit) so it runs before any
; registry mutation, replacing the old .onVerifyInstDir placement which fired after customInit
; had already healed/cleared/repaired an existing install's registry. (Sentry ELECTRON-3BX)
; Rejection policy is unchanged: an x64 build refuses both x86 and ARM64 machines.
!macro QIANJI_ASSERT_TARGET_ARCH
  Var /GLOBAL QianjiActualArch
  ${If} ${IsNativeARM64}
    !insertmacro QIANJI_DETECT_NATIVE_ARCH $QianjiActualArch
    !insertmacro QIANJI_FAIL_UX \
      "${QIANJI_E_ARCH_MISMATCH}" \
      "target=x64 actual=$QianjiActualArch" \
      "${QIANJI_MSG_ARCH_MISMATCH_ZH}" \
      "${QIANJI_MSG_ARCH_MISMATCH_EN}" \
      "${QIANJI_MSG_ARCH_MISMATCH_ACTION_ZH}" \
      "${QIANJI_MSG_ARCH_MISMATCH_ACTION_EN}" \
      "target=x64 actual=$QianjiActualArch" \
      "target=x64 actual=$QianjiActualArch"
  ${ElseIfNot} ${RunningX64}
    !insertmacro QIANJI_DETECT_NATIVE_ARCH $QianjiActualArch
    !insertmacro QIANJI_FAIL_UX \
      "${QIANJI_E_ARCH_MISMATCH}" \
      "target=x64 actual=$QianjiActualArch" \
      "${QIANJI_MSG_ARCH_MISMATCH_ZH}" \
      "${QIANJI_MSG_ARCH_MISMATCH_EN}" \
      "${QIANJI_MSG_ARCH_MISMATCH_ACTION_ZH}" \
      "${QIANJI_MSG_ARCH_MISMATCH_ACTION_EN}" \
      "target=x64 actual=$QianjiActualArch" \
      "target=x64 actual=$QianjiActualArch"
  ${EndIf}
!macroend
