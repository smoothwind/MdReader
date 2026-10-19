; Tauri NSIS 安装钩子：为 .md 文件关联设置专用 Markdown 文档图标
; （Tauri 的 fileAssociations 不支持独立图标，默认复用应用图标）

!macro NSIS_HOOK_POSTINSTALL
  ; 读取安装器为 .md 注册的 ProgID，并为其 DefaultIcon 指向随包分发的 md-file.ico
  ReadRegStr $R0 SHCTX ".md" ""
  StrCmp $R0 "" +2 0
  WriteRegStr SHCTX "$R0\DefaultIcon" "" "$INSTDIR\md-file.ico,0"
!macroend
