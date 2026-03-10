CREATE TABLE log (
  LogKey bigint NOT NULL IDENTITY(1,1) PRIMARY KEY,
  SiteID varchar(100) NOT NULL DEFAULT '',
  LogDatetime datetime DEFAULT NULL,
  EventCode varchar(500) DEFAULT NULL, -- Error code or debug code 
  Context varchar(2000) DEFAULT NULL, -- Module or location of error
  SiteID varchar(200) NOT NULL DEFAULT '',
  Severity varchar(100) DEFAULT NULL,
  extra       JSONB        -- flexible overflow (PostgreSQL syntax)
) ;

