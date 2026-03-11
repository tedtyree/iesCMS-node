CREATE TABLE IF NOT EXISTS jobjects (
  ObjID bigserial NOT NULL,
  WorldID varchar(100) NOT NULL DEFAULT '',
  ObjName varchar(200) DEFAULT NULL,
  PrimaryType varchar(100) DEFAULT NULL,
  Owner varchar(100) DEFAULT NULL,
  Status varchar(40) DEFAULT NULL,
  ObjTypes text,
  extra JSONB,
  PRIMARY KEY (ObjID)
);

CREATE INDEX IF NOT EXISTS idx_worldid ON jobjects (WorldID, ObjID);
