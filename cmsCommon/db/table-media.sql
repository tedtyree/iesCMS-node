-- media.jfx
-- Media files are currently stored only on disk, not in the database
-- Images have a self-reference to the original (parent) image
-- Many media items below to an Object (wobjectID) for example
--   a web page or a blog post. jobjectID of 0 means no parent object
CREATE TABLE IF NOT EXISTS media (
  mediaID bigserial NOT NULL,
  parentMediaId bigint NOT NULL DEFAULT 0,
  SiteID varchar(100) NOT NULL DEFAULT '',
  parentObjId bigint NOT NULL DEFAULT 0,
  vid bigint NOT NULL DEFAULT 0,
  mediaType varchar(200) DEFAULT NULL,
  path varchar(2000) DEFAULT NULL,
  filename varchar(2000) DEFAULT NULL,
  Status varchar(40) DEFAULT NULL,
  PRIMARY KEY (mediaID)
);

CREATE UNIQUE INDEX IF NOT EXISTS media_objid ON media (parentObjId, vid);
