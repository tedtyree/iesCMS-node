CREATE TABLE IF NOT EXISTS jobjhist (
  ObjHistID bigint(20) NOT NULL AUTO_INCREMENT,
  ObjID bigint(20) DEFAULT NULL,
  WorldID varchar(100) DEFAULT NULL,
  ObjName varchar(200) DEFAULT NULL,
  PrimaryType varchar(100) DEFAULT NULL,
  Owner varchar(100) DEFAULT NULL,
  Status varchar(40) DEFAULT NULL,
  ObjTypes text,
  ModDateTime datetime DEFAULT NULL,
  ModCommand varchar(100) DEFAULT NULL,
  extra       JSONB,        -- flexible overflow (PostgreSQL syntax)
  PRIMARY KEY (ObjHistID),
  KEY HistObjID (ObjID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1 ;