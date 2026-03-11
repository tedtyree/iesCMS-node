CREATE TABLE IF NOT EXISTS log (
  LogKey bigserial NOT NULL PRIMARY KEY,
  SiteID varchar(200) NOT NULL DEFAULT '',
  LogDatetime timestamp DEFAULT NULL,
  EventCode varchar(500) DEFAULT NULL,
  Context varchar(2000) DEFAULT NULL,
  Severity varchar(100) DEFAULT NULL,
  extra JSONB
);
