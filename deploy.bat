@echo off
chcp 65001 >nul
title رفع التحديثات إلى GitHub و Vercel
echo [1/3] فحص ملفات المشروع وتجهيز التحديثات...
git add .
echo [2/3] تسجيل نقطة الحفظ...
git commit -m "feat: complete tenancy contracts audit, standardized images, and dual contract/receipt viewer"
echo [3/3] رفع التحديثات إلى GitHub (origin main)...
git push -u origin main
echo.
pause
