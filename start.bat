@echo off

:start

C:
cd C:\Users\ASUS\Desktop\discord_music
node --max_old_space_size=1024 main.js

timeout 10

goto start
