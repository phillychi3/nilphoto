# NILPhoto

## 圖片庫，支援 S3、EXIF 詳細資訊、地圖

---

## 需求概述

### 上傳圖片
圖片上傳支援github/s3/r2等多種儲存服務
並且上傳後自動生成縮圖

### 不只圖片
支援影片上傳，並且自動生成縮圖與預覽影片

### 管理員介面
只有相簿管理員才可以上傳圖片、編輯圖片資訊、刪除圖片

### 相簿設計
相簿使用瀑布流來展示圖片，並且支援無限捲動。
每張圖片停留都會顯示標題與一些基本資訊
有分公開與私人相簿，私人相簿需要特定的連結才能觀看，公開相簿則會在主頁列出

相簿內建搜索器，可以依照標題、描述、EXIF 資訊來搜尋圖片，甚至是圖片內的物件或者人物分類

主頁面就是一個相簿，算是一個攝影師想要展示自己作品的地方。

圖片分享功能

### 設計風格
現代黑白配色, tailwindcss

### 易用性設計
操作邏輯要像google drive, 包括右鍵選單, 拖拉選取, 多選, 快捷鍵等

### 圖片檢視器
點擊圖片會進入圖片檢視器，可以看到更大的圖片以及詳細的 EXIF 資訊，圖片檢視器配置了簡易的圖片編輯功能，可以裁切、旋轉圖片
支援hdr

### 地圖功能
如果圖片有包含 GPS 資訊，會自動在地圖上標記拍攝位置

### 備份管理系統
支援自動備份到多個雲端儲存服務，並且可以設定備份頻率與保留期限，並顯示目前備份狀態與歷史紀錄，個檔案也紀錄備份狀態

---

## 開發待辦清單

### P0 基礎架構 (必須先完成)

- [x] **資料庫 Schema 設計**
  - [x] users 表 (id, email, password_hash, name, role, created_at, updated_at)
  - [x] sessions 表 (Lucia Auth)
  - [x] albums 表 (id, name, description, is_public, share_token, cover_photo_id, owner_id, sort_order, created_at, updated_at)
  - [x] photos 表 (id, album_id, filename, original_filename, mime_type, size, storage_path, thumbnail_path, storage_provider, width, height, aspect_ratio, is_hdr, title, description, media_type, video_duration, video_preview_path, sort_order, created_at, updated_at)
  - [x] photo_exif 表 (photo_id, camera_make, camera_model, lens_model, aperture, shutter_speed, iso, focal_length, focal_length_35mm, latitude, longitude, altitude, taken_at, raw_exif)
  - [x] storage_configs 表 (id, provider, name, is_default, config, created_at)
  - [x] backups 表 (id, photo_id, storage_config_id, status, backup_path, error_message, created_at, completed_at)
  - [x] backup_schedules 表 (id, storage_config_id, enabled, frequency, retention_days, last_run_at, next_run_at, created_at)
  - [x] site_settings 表 (key, value, updated_at)
  - [x] invite_codes 表 (id, code, created_by, max_uses, used_count, expires_at, is_active, created_at)
  - [x] invite_code_uses 表 (id, invite_code_id, user_id, used_at)

- [x] **儲存服務抽象層**
  - [x] 定義統一介面 (StorageAdapter: upload, download, delete, getUrl, exists)
  - [x] S3 adapter 實作 (支援 AWS S3)
  - [x] R2 adapter 實作 (與 S3 共用，使用 S3 協議)
  - [x] Local adapter 實作 (開發用)
  - [ ] GitHub adapter 實作 (選用)
  - [x] 儲存設定管理 (getStorage 工廠函數)
  - [x] 儲存設定 CRUD API (/api/storage-configs)
  - [x] 連線測試 API (/api/storage-configs/test)
  - [x] 管理員儲存設定頁面 (/admin/storage)

- [x] **管理員認證系統**
  - [x] 登入/登出 API (/api/auth/login, /api/auth/logout)
  - [x] 註冊 API (/api/auth/register) - 支援邀請碼系統
  - [x] Session 管理 (Lucia Auth)
  - [x] 路由保護 middleware (hooks.server.ts)
  - [x] 登入頁面 UI (/login)
  - [x] 註冊頁面 UI (/register) - 支援邀請碼

### P1 核心功能

- [x] **圖片上傳**
  - [x] 上傳 API endpoint (/api/photos/upload)
  - [x] 檔案驗證 (類型、大小)
  - [x] 縮圖自動生成 (sharp)
  - [ ] 上傳進度顯示 (目前為逐檔上傳)
  - [x] 拖放上傳 UI (/upload)

- [x] **EXIF 資訊提取**
  - [x] 使用 exifr 提取 metadata
  - [x] GPS 座標解析
  - [x] 儲存至 photo_exif 表

- [x] **相簿管理**
  - [x] 相簿 CRUD API (/api/albums)
  - [x] 公開/私人切換
  - [x] 分享連結生成 (shareToken)
  - [x] 相簿封面設定

- [x] **瀑布流相簿頁面**
  - [x] Masonry layout 實作 (CSS columns)
  - [ ] 無限捲動 (Intersection Observer)
  - [x] 圖片 hover 顯示資訊
  - [x] 響應式設計

### P2 檢視功能

- [x] **圖片檢視器** (基礎版)
  - [x] Lightbox modal
  - [x] 左右切換圖片
  - [x] EXIF 資訊面板
  - [x] 鍵盤導航 (←→ ESC)

- [ ] **圖片編輯**
  - [ ] 裁切功能
  - [ ] 旋轉功能
  - [ ] 儲存編輯結果

- [ ] **HDR 支援**
  - [ ] 檢測 HDR 圖片
  - [ ] 適當的色彩空間渲染

### P3 進階功能

- [ ] **影片支援**
  - [ ] 影片上傳
  - [ ] 縮圖生成 (ffmpeg)
  - [ ] 預覽影片生成
  - [ ] 影片播放器

- [ ] **地圖功能**
  - [ ] 整合 Leaflet/Mapbox
  - [ ] 顯示有 GPS 的圖片標記
  - [ ] 點擊標記開啟圖片

- [ ] **搜尋功能**
  - [ ] 全文搜尋 (標題、描述)
  - [ ] EXIF 篩選 (相機、日期範圍)
  - [ ] 物件/人物分類 (需要 ML 服務)

- [ ] **備份管理系統**
  - [ ] 備份設定 UI
  - [ ] 排程備份 (cron job)
  - [ ] 備份狀態儀表板
  - [ ] 單檔備份狀態顯示

### P4 UX 優化

- [ ] **Google Drive 風格操作**
  - [ ] 右鍵選單 (context menu)
  - [ ] 框選多選 (drag select)
  - [ ] Ctrl/Cmd + 點擊多選
  - [ ] 快捷鍵 (Delete, Enter, Ctrl+A)

- [ ] **圖片分享**
  - [ ] 單張圖片分享連結
  - [ ] 社群分享按鈕
  - [ ] 嵌入碼生成

---

## 技術棧

- **前端**: SvelteKit 5, Tailwind CSS 4, shadcn-svelte
- **後端**: SvelteKit API routes
- **資料庫**: Turso/SQLite + Drizzle ORM
- **認證**: Lucia Auth (Session-based) + argon2 密碼雜湊
- **圖片處理**: Sharp
- **影片處理**: FFmpeg
- **地圖**: Leaflet
- **儲存**: @aws-sdk/client-s3 (S3/R2)

---

## 當前進度

- [x] 專案初始化
- [x] 基本 UI 組件 (Button, Card, Dialog, Input, Label)
- [x] P0 資料庫 Schema 設計 (11 個表)
- [x] P0 儲存服務抽象層 (S3/R2/Local adapters)
- [x] P0 管理員認證系統 (登入/註冊/登出/路由保護)
- [x] 開發用 seed 腳本 (test/test 測試帳號)
- [x] P1 圖片上傳 + 縮圖生成 + EXIF 提取
- [x] P1 相簿 CRUD API
- [x] P1 瀑布流相簿頁面 + Lightbox 檢視器
- [x] 上傳頁面 (/upload) - 拖放上傳
- [x] 相簿管理頁面 (/albums)
- [x] 儲存服務設定管理頁面 (/admin/storage) - CRUD + 連線測試
- [ ] P2-P4 進階功能開發中...
