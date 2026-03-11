CREATE TABLE IF NOT EXISTS users (
  userID bigserial NOT NULL PRIMARY KEY,
  userType varchar(50) DEFAULT NULL,
  loginid varchar(100) DEFAULT NULL, -- was uID previously
  userName varchar(255) DEFAULT NULL,
  userEmail varchar(255) DEFAULT NULL,
  pwd varchar(2000) DEFAULT NULL,
  status varchar(20) DEFAULT NULL,
  userLevel int NOT NULL DEFAULT 0,  -- was [level]
  -- allowEmails varchar(20) DEFAULT 'yes',
  -- children text,
  -- address text,
  -- secondaryEmails text,
  phoneNumber varchar(100) DEFAULT NULL,
  nameText varchar(255) DEFAULT NULL,
  -- title varchar(100) DEFAULT NULL,
  memberFlag varchar(10) DEFAULT NULL,
  -- directory varchar(50) DEFAULT NULL,
  flag varchar(50) DEFAULT NULL,
  -- dList varchar(150) DEFAULT NULL,
  -- dList2 varchar(50) DEFAULT NULL,
  -- adcustomer varchar(10) DEFAULT NULL, -- Indicates this member has been an Ad Customer at some point
  -- adcampaign varchar(10) DEFAULT NULL, -- Indicates that this customer is currently running an ad campaign or will be in the near future
  -- objID bigint DEFAULT NULL,
  siteID varchar(100) DEFAULT NULL,  -- was WorldID
  extra JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS users_loginid ON users (loginid);