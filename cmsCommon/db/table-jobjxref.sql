CREATE TABLE IF NOT EXISTS jobjxref (
  ObjXRefID bigserial NOT NULL,
  SiteID varchar(100) NOT NULL DEFAULT '',
  ObjID1 bigint NOT NULL DEFAULT 0,
  ObjID2 bigint NOT NULL DEFAULT 0,
  Relation varchar(100) DEFAULT NULL,
  Alias varchar(200) DEFAULT NULL,
  Seq int DEFAULT NULL,
  Status varchar(40) DEFAULT NULL,
  PrimaryParent varchar(20) DEFAULT NULL,
  PRIMARY KEY (ObjXRefID)
);

CREATE INDEX IF NOT EXISTS idx_objid1_seq ON jobjxref (ObjID1, Seq);
CREATE INDEX IF NOT EXISTS idx_objid2_objid1 ON jobjxref (ObjID2, ObjID1);

