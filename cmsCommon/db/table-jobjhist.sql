CREATE TABLE IF NOT EXISTS jobjhist (
  ObjHistID bigserial NOT NULL,
  ObjID bigint DEFAULT NULL,
  WorldID varchar(100) DEFAULT NULL,
  ObjName varchar(200) DEFAULT NULL,
  PrimaryType varchar(100) DEFAULT NULL,
  Owner varchar(100) DEFAULT NULL,
  Status varchar(40) DEFAULT NULL,
  ObjTypes text,
  ModDateTime timestamp DEFAULT NULL,
  ModCommand varchar(100) DEFAULT NULL,
  extra JSONB,
  PRIMARY KEY (ObjHistID)
);

CREATE INDEX IF NOT EXISTS idx_histobjid ON jobjhist (ObjID);