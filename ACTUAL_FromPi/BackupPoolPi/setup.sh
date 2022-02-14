#!/bin/bash
softwareVersion=$(git describe --long)

echo -e "\e[1;4;246mPoolPi Setup $softwareVersion\e[0m
PoolPi will change your life
"

read -p "Would you like to continue? (Y/n) " answer
if [ "$answer" == "n" ] || [ "$answer" == "N" ] || [ "$answer" == "" ]
then
	echo "Setup aborted"
	exit
fi

# 
# #################
# # Update System #
# #################
# echo -e "\e[1;4;93mUpdating system\e[0m"
# sudo apt update
# sudo apt upgrade -y
# 
# ###########################################
# # Install pre-built dependencies from Apt #
# ###########################################
# echo -e "\e[1;4;93mInstall pre-built dependencies from Apt\e[0m"
# sudo apt install -y dnsmasq hostapd libbluetooth-dev apache2 php7.0 php7.0-mysql php7.0-bcmath mariadb-server libmariadbclient-dev libmariadbclient-dev-compat uvcdynctrl libsdl2-dev
# sudo systemctl disable hostapd dnsmasq
# 
# ################
# # Build FFMpeg #
# ################
# echo -e "\e[1;4;93mBuild ffmpeg (this may take a while)\e[0m"
# wget https://www.ffmpeg.org/releases/ffmpeg-3.4.2.tar.gz
# tar -xvf ffmpeg-3.4.2.tar.gz
# cd ffmpeg-3.4.2
# echo "./configure --enable-gpl --enable-nonfree --enable-mmal --enable-omx --enable-omx-rpi"
# ./configure --enable-gpl --enable-nonfree --enable-mmal --enable-omx --enable-omx-rpi
# make -j$(nproc)
# sudo make install
# cd ..

#######################
# Install PoolPi #
#######################
echo -e "\e[1;4;93mBuilding and installing PoolPi\e[0m"
cd PoolPi
make

cd ..
make
sudo make install

sudo cp -r html /var/www/
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 0755 /var/www/html
sudo systemctl daemon-reload
sudo cp hostapd-rap.conf /etc/hostapd
sudo cp dnsmasq.conf /etc
sudo mkdir /var/www/html/vids
sudo chown -R www-data:www-data /var/www/html

installDate=$(date)
cp poolpi.sql poolpi-configd.sql
echo "INSERT INTO env (name, value) VALUES (\"PoolPiVersion\", \"$softwareVersion\"), (\"installDate\", \"$installDate\");" >> poolpi-configd.sql
sudo mysql < poolpi-configd.sql

echo "Done! Please reboot your Raspberry Pi now"
