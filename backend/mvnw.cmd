@ECHO OFF
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0
if not defined MAVEN_PROJECTBASEDIR set MAVEN_PROJECTBASEDIR=%CD%
set MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%

set WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar
set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

IF NOT EXIST "%WRAPPER_JAR%" (
  echo Downloading Maven Wrapper...
  powershell -Command "Invoke-WebRequest https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar -OutFile '%WRAPPER_JAR%'" || EXIT /B 1
)

set JAVA_EXE=java

"%JAVA_EXE%" -cp "%WRAPPER_JAR%" %WRAPPER_LAUNCHER% -Dmaven.multiModuleProjectDirectory="%MAVEN_PROJECTBASEDIR%" %*
@endlocal
