-- media.jfx
-- Media files are currently stored only on disk, not in the database
-- Images have a self-reference to the original (parent) image
-- Many media items below to an Object (wobjectID) for example
--   a web page or a blog post. jobjectID of 0 means no parent object
CREATE TABLE IF NOT EXISTS media (
  mediaID bigint(20) NOT NULL AUTO_INCREMENT,
  parentMediaId bigint(20) NOT NULL DEFAULT '0',
  SiteID varchar(100) NOT NULL DEFAULT '',
  parentObjId bigint(20) NOT NULL DEFAULT '0',
  vid bigint(20) NOT NULL DEFAULT '0', -- visual id (human readable: pic-of-house-01)
  mediaType varchar(200) NULL,
  path varchar(2000) NULL,
  filename varchar(2000) NULL,
  Status varchar(40) DEFAULT NULL,
  PRIMARY KEY (mediaID)
);

CREATE UNIQUE INDEX media_objID ON users (parentObjId,vid);
