CREATE TABLE IF NOT EXISTS jobjects (
  ObjID bigint(20) NOT NULL AUTO_INCREMENT,
  WorldID varchar(100) NOT NULL DEFAULT '',
  ObjName varchar(200) DEFAULT NULL, -- simlar to a vid (visual ID for humans)
  PrimaryType varchar(100) DEFAULT NULL,
  Owner varchar(100) DEFAULT NULL,
  Status varchar(40) DEFAULT NULL,
  ObjTypes text,
  extra       JSONB,        -- flexible overflow (PostgreSQL syntax)
  PRIMARY KEY (ObjID),
  KEY WorldID (WorldID,ObjID)
);
