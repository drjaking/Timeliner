@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

:: ============================================================================
:: Timeliner LAN Firewall Rule Installer (Domain GPO + Local Firewall Store)
:: Requests Administrator privileges and registers Inbound Allow rules for
:: TCP Port 3000 and node.exe in BOTH the Local Firewall Store AND the
:: Domain Group Policy Firewall Store (HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall)
:: so UCL / Active Directory Domain profiles do not block inbound LAN traffic.
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

set "NODE_PATH=C:\Program Files\nodejs\node.exe"
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_PATH=%ProgramFiles%\nodejs\node.exe"
) else (
    for /f "delims=" %%i in ('where node 2^>nul') do (
        set "NODE_PATH=%%i"
        goto :found_node
    )
)
:found_node

echo Detected Node.js at: "%NODE_PATH%"

:: 1. Remove any previous Timeliner rules or auto-generated Node.js block rules
netsh advfirewall firewall delete rule name="Timeliner LAN Server (TCP 3000)" >nul 2>&1
netsh advfirewall firewall delete rule name="Timeliner LAN Server (Node.js Runtime)" >nul 2>&1
netsh advfirewall firewall delete rule name="Node.js JavaScript Runtime" dir=in action=block >nul 2>&1
netsh advfirewall firewall delete rule name="node.exe" dir=in action=block >nul 2>&1

:: 2. Add Inbound TCP Port 3000 Allow rule across all IP ranges (needed for multi-VLAN campus LANs & Wi-Fi)
netsh advfirewall firewall add rule ^
    name="Timeliner LAN Server (TCP 3000)" ^
    description="Allow inbound LAN connections to Timeliner web server on TCP port 3000" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=3000 ^
    remoteip=any ^
    profile=any ^
    enable=yes

:: 3. Add Inbound Node.js Runtime Allow rule
netsh advfirewall firewall add rule ^
    name="Timeliner LAN Server (Node.js Runtime)" ^
    description="Allow inbound LAN connections to Node.js runtime for Timeliner" ^
    dir=in ^
    action=allow ^
    program="%NODE_PATH%" ^
    protocol=TCP ^
    remoteip=any ^
    profile=any ^
    enable=yes

:: 4. Register rules directly in the Domain GPO Firewall Policy Store (HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall)
::    On UCL / AD Domain PCs, Windows Firewall ignores local rules unless they are in the GPO Policy store or PolicyMerge is enabled.
echo Registering rules in Domain Group Policy Firewall Store...
reg add "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\DomainProfile" /v AllowLocalPolicyMerge /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\PrivateProfile" /v AllowLocalPolicyMerge /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\PublicProfile" /v AllowLocalPolicyMerge /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\DomainProfile\AuthorizedApplications" /v AllowUserPrefMerge /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\DomainProfile\GloballyOpenPorts" /v AllowUserPrefMerge /t REG_DWORD /d 1 /f >nul 2>&1

reg add "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\FirewallRules" /v "Timeliner-LAN-Port-3000-TCP" /t REG_SZ /d "v2.31|Action=Allow|Active=TRUE|Dir=In|Protocol=6|LPort=3000|Name=Timeliner LAN Server (TCP 3000)|Desc=Allow inbound campus LAN traffic to Timeliner web server on TCP port 3000|" /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\WindowsFirewall\FirewallRules" /v "Timeliner-LAN-NodeJS-App" /t REG_SZ /d "v2.31|Action=Allow|Active=TRUE|Dir=In|Protocol=6|App=%NODE_PATH%|Name=Timeliner LAN Server (Node.js Runtime)|Desc=Allow Node.js runtime for Timeliner LAN server|" /f

echo.
echo [OK] Firewall rules installed in both Local Store and Domain GPO Store (TCP 3000 + Node.js).
echo Colleagues on UCL Ethernet, Eduroam/Wi-Fi, or VPN can now connect to:
echo   http://128.40.27.53:3000
echo.
pause
