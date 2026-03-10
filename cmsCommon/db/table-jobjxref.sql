CREATE TABLE IF NOT EXISTS jobjxref (
  ObjXRefID bigint(20) NOT NULL AUTO_INCREMENT,
  SiteID varchar(100) NOT NULL DEFAULT '',
  ObjID1 bigint(20) NOT NULL DEFAULT '0',
  ObjID2 bigint(20) NOT NULL DEFAULT '0',
  Relation varchar(100) DEFAULT NULL,
  Alias varchar(200) DEFAULT NULL,
  Seq int(11) DEFAULT NULL,
  Status varchar(40) DEFAULT NULL,
  PrimaryParent varchar(20) DEFAULT NULL,
  PRIMARY KEY (ObjXRefID),
  KEY ObjID1 (ObjID1,Seq),
  KEY ObjID2 (ObjID2,ObjID1)
);
