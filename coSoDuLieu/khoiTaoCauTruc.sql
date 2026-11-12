IF DB_ID(N'CarbonGreatBritain') IS NULL
    CREATE DATABASE CarbonGreatBritain;
GO
USE CarbonGreatBritain;
GO
IF OBJECT_ID(N'dbo.so_lieu_carbon', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.so_lieu_carbon (
        id INT IDENTITY PRIMARY KEY,
        thoi_gian DATETIMEOFFSET NOT NULL UNIQUE,
        cuong_do FLOAT NOT NULL,
        muc_do NVARCHAR(20) NULL,
        phat_thai FLOAT NULL,
        tai_tao FLOAT NULL,
        khi FLOAT NULL,
        hat_nhan FLOAT NULL,
        gio FLOAT NULL,
        mat_troi FLOAT NULL
    );
    CREATE INDEX IX_so_lieu_carbon_thoi_gian ON dbo.so_lieu_carbon(thoi_gian DESC);
END;
IF OBJECT_ID(N'dbo.du_lieu_khu_vuc', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.du_lieu_khu_vuc (
        id INT IDENTITY PRIMARY KEY,
        ma_vung INT NOT NULL,
        ten_vung NVARCHAR(120) NOT NULL,
        thoi_gian DATETIMEOFFSET NOT NULL,
        cuong_do FLOAT NOT NULL,
        muc_do NVARCHAR(20) NULL,
        CONSTRAINT UQ_vung_thoi_gian UNIQUE(ma_vung, thoi_gian)
    );
    CREATE INDEX IX_du_lieu_khu_vuc_thoi_gian ON dbo.du_lieu_khu_vuc(thoi_gian DESC);
END;
IF OBJECT_ID(N'dbo.chi_so_hieu_nang', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.chi_so_hieu_nang (
        id INT IDENTITY PRIMARY KEY,
        ten_mo_hinh NVARCHAR(100) NOT NULL,
        r2 FLOAT NULL,
        mae FLOAT NULL,
        rmse FLOAT NULL,
        thoi_gian DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
END;
