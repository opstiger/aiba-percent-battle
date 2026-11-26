#!/bin/bash
# Colab CLI 便捷入口（沙箱兼容版）
# 用法：./colab-cli.sh <colab 命令...>
# 例： ./colab-cli.sh sessions
#     echo 'print(1)' | ./colab-cli.sh exec -s NAME
#     ./colab-cli.sh new -s mysess --gpu T4
WS="$(cd "$(dirname "$0")" && pwd)"
export HOME="$WS/.colab-home"
export PATH="/Users/tigeryao/.local/bin:$PATH"
# --auth adc: 直接读本地凭据文件，不再访问系统钥匙串（避免 Keychain 弹窗）
exec colab --auth adc "$@"
