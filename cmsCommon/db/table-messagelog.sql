CREATE TABLE IF NOT EXISTS messagelog (
  wLogID bigserial NOT NULL,
  FormID varchar(200) DEFAULT NULL,
  SubmitDate timestamp DEFAULT NULL,
  SpamLevel integer DEFAULT 0,
  SpamReason varchar(500) DEFAULT NULL,
  Params text,
  Comments text,
  Status varchar(40) DEFAULT NULL,
  PRIMARY KEY (wLogID)
);

CREATE INDEX IF NOT EXISTS idx_messagelog_submitdate ON messagelog (SubmitDate DESC);
