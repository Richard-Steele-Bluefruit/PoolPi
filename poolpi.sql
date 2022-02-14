CREATE DATABASE poolpi;
GRANT ALL PRIVILEGES ON poolpi.* TO 'poolpi'@'%' IDENTIFIED BY 'poolpi';
USE poolpi;
CREATE TABLE env (id int NOT NULL auto_increment, name text NOT NULL, value text NOT NULL, PRIMARY KEY(id));
