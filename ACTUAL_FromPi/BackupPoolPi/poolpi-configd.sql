CREATE DATABASE poolpi;
GRANT ALL PRIVILEGES ON poolpi.* TO 'poolpi'@'%' IDENTIFIED BY 'poolpi';
USE poolpi;
CREATE TABLE env (id int NOT NULL auto_increment, name text NOT NULL, value text NOT NULL, PRIMARY KEY(id));
INSERT INTO env (name, value) VALUES ("PoolPiVersion", ""), ("installDate", "Fri 30 Jul 12:21:51 BST 2021");
