@echo off
setlocal

python -m venv venv
call venv\Scripts\activate

pip install -r requirements.txt
pip install pyinstaller

pyinstaller problem_cutter.spec --clean

if not exist "src\python_dist" mkdir src\python_dist
xcopy /E /I /Y "dist\problem_cutter" "src\python_dist\problem_cutter"

deactivate
endlocal