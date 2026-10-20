@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: Timeliner LAN Firewall Rule Installer
:: Automatically requests Administrator privileges and registers Inbound Allow
:: rules in Windows Defender Firewall for TCP Port 3000 and node.exe (LAN only)
:: so Windows never pauses or blocks waiting for an interactive firewall prompt.
:: ============================================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges to configure Windows Firewall...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================================
echo Configuring Windows Defender Firewall for Timeliner LAN Server...
echo ============================================================================

:: Find node.exe path dynamically (fallback to default Program Files path)
set "NODE_PATH=C:\Program Files\nodejs\node.exe"
for /f "delims=" %%i in ('where node 2^>nul') do (
    set "NODE_PATH=%%i"
    goto :found_node
)
:found_node

echo Detected Node.js at: "%NODE_PATH%"

:: Remove any existing Timeliner rules to avoid duplicates
netsh advfirewall firewall delete rule name="Timeliner LAN Server (TCP 3000)" >nul 2>&1
netsh advfirewall firewall delete rule name="Timeliner LAN Server (Node.js Runtime)" >nul 2>&1

:: Remove any auto-generated Windows Firewall BLOCK rules for node.exe (created if a prompt was previously ignored/cancelled)
netsh advfirewall firewall delete rule name="Node.js JavaScript Runtime" dir=in action=block >nul 2>&1
netsh advfirewall firewall delete rule name="node.exe" dir=in action=block >nul 2>&1

:: 1. Allow Inbound TCP Port 3000 from Local Subnet across all profiles (Private, Domain, Public)
netsh advfirewall firewall add rule ^
    name="Timeliner LAN Server (TCP 3000)" ^
    description="Allow inbound LAN connections to Timeliner web server on TCP port 3000" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=3000 ^
    remoteip=localsubnet ^
    profile=any ^
    enable=yes

:: 2. Allow Inbound Node.js executable from Local Subnet (prevents the "Windows Firewall has blocked some features of this app" popup)
if exist "%NODE_PATH%" (
    netsh advfirewall firewall add rule ^
        name="Timeliner LAN Server (Node.js Runtime)" ^
        description="Suppress interactive Windows Firewall prompt when Node.js binds to 0.0.0.0 on LAN" ^
        dir=in ^
        action=allow ^
        program="%NODE_PATH%" ^
        protocol=TCP ^
        remoteip=localsubnet ^
        profile=any ^
        enable=yes
)

echo.
echo [OK] Firewall rules installed successfully for LocalSubnet (TCP 3000 + Node.js).
echo You can verify them in "Windows Defender Firewall with Advanced Security" (wf.msc)
echo under Inbound Rules -> "Timeliner LAN Server".
echo.
pause
