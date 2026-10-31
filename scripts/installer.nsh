!macro customInstall
  FileOpen $0 "$INSTDIR\.foxvpn-installed" w
  FileWrite $0 "Fox VPN installer"
  FileClose $0
!macroend

!macro customUnInstall
  Delete "$INSTDIR\.foxvpn-installed"
!macroend
