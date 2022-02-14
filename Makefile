all: run
run: run.c
	gcc run.c -o run -Wall -lmysqlclient -lbluetooth

install:
	cp run /usr/bin
	chmod u+s /usr/bin/run
clean:
	-rm run

