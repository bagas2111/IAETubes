-- ==========================================
-- 0. DATABASE: user_db (Table: users)
-- ==========================================
CREATE DATABASE IF NOT EXISTS user_db;
USE user_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  role ENUM('mahasiswa', 'dosen', 'admin') NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

-- Seed users (Password for all accounts: password123. Hash is SHA-256)
INSERT INTO users (id, username, name, role, password_hash) VALUES
(1, 'admin', 'Administrator Kampus', 'admin', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'),
(2, 'budi', 'Budi Santoso (Mahasiswa)', 'mahasiswa', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'),
(3, 'irwan', 'Dr. Irwan Malik (Dosen)', 'dosen', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f');

-- ==========================================
-- 1. DATABASE: category_db (Table: kategori)
-- ==========================================
CREATE DATABASE IF NOT EXISTS category_db;
USE category_db;

CREATE TABLE IF NOT EXISTS kategori (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL UNIQUE,
  deskripsi TEXT
);

INSERT INTO kategori (id, nama, deskripsi) VALUES
(1, 'Ruang Pertemuan/Kelas', 'Ruangan yang dapat digunakan untuk kuliah umum, rapat, maupun seminar.'),
(2, 'Laboratorium', 'Laboratorium komputer, elektro, biologi, atau fisika untuk praktikum dan riset.'),
(3, 'Peralatan Elektronik', 'Peralatan pendukung seperti proyektor, kamera DSLR, sound system, atau laptop.');

-- ==========================================
-- 2. DATABASE: asset_db (Table: asset)
-- ==========================================
CREATE DATABASE IF NOT EXISTS asset_db;
USE asset_db;

CREATE TABLE IF NOT EXISTS asset (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kategori_id INT NOT NULL,
  nama VARCHAR(100) NOT NULL,
  tipe ENUM('ruangan', 'laboratorium', 'peralatan') NOT NULL,
  deskripsi TEXT,
  status ENUM('tersedia', 'dipelihara', 'dipakai') DEFAULT 'tersedia',
  image_url VARCHAR(255),
  stok INT NOT NULL DEFAULT 1
);

INSERT INTO asset (id, kategori_id, nama, tipe, deskripsi, status, image_url, stok) VALUES
(1, 1, 'Auditorium Utama H.3', 'ruangan', 'Auditorium kapasitas 300 orang dengan AC sentral dan sound system lengkap.', 'tersedia', 'https://images.unsplash.com/photo-1517502884422-41eaaced0168?w=800&auto=format&fit=crop', 1),
(2, 2, 'Laboratorium Rekayasa Perangkat Lunak', 'laboratorium', 'Lab komputer berspesifikasi tinggi untuk pemrograman, AI, dan grafis (30 PC).', 'tersedia', 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop', 2),
(3, 3, 'Kamera Sony Alpha A7 III', 'peralatan', 'Kamera mirrorless professional lengkap dengan lensa kit 28-70mm.', 'tersedia', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop', 3),
(4, 1, 'Ruang Seminar B.204', 'ruangan', 'Ruang kelas kecil ber-AC kapasitas 40 orang untuk diskusi ilmiah.', 'dipelihara', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop', 1);


-- ==========================================
-- 3. DATABASE: booking_db (Table: booking)
-- ==========================================
CREATE DATABASE IF NOT EXISTS booking_db;
USE booking_db;

CREATE TABLE IF NOT EXISTS booking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  user_role ENUM('mahasiswa', 'dosen') NOT NULL,
  deskripsi TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
);

INSERT INTO booking (id, asset_id, user_id, user_name, user_role, deskripsi, start_time, end_time, status) VALUES
(1, 1, 2, 'Budi Santoso', 'mahasiswa', 'Seminar Nasional Teknologi Web Berkelanjutan', '2026-06-10 09:00:00', '2026-06-10 13:00:00', 'approved'),
(2, 2, 3, 'Dr. Irwan Malik', 'dosen', 'Ujian Praktikum Struktur Data Kelas A', '2026-06-11 13:00:00', '2026-06-11 16:00:00', 'pending'),
(3, 3, 2, 'Siti Aminah', 'mahasiswa', 'Pembuatan video dokumenter profil UKM Seni', '2026-06-12 08:00:00', '2026-06-12 17:00:00', 'pending');

-- ==========================================
-- 4. DATABASE: schedule_db (Table: schedule)
-- ==========================================
CREATE DATABASE IF NOT EXISTS schedule_db;
USE schedule_db;

CREATE TABLE IF NOT EXISTS schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  date DATE NOT NULL,
  event_name VARCHAR(150) NOT NULL,
  deskripsi TEXT
);

INSERT INTO schedule (id, asset_id, date, event_name, deskripsi) VALUES
(1, 1, '2026-06-10', 'Seminar Nasional Teknologi Web', 'Penyelenggara BEM Fakultas Teknik'),
(2, 2, '2026-06-11', 'Praktikum Struktur Data Kelas A', 'Dosen pengampu Dr. Irwan Malik');
