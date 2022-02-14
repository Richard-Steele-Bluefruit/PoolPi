var sideBar = false;
var offline = false;
var selectedMenu = 1;
var forageLoaded = 0;
var logReturned = false;
var savedVideos = [];
var updateLastTimeInstance, lastSeconds, lastHours, lastMinutes, getInitialStatus, refreshValue, fetchVideo, currentVideo, videoArray, dateArray, videoSelect, timingAdvance;

var LOADING_TEXT = "<div style='height: 10px;'></div><div class='loadWait'>Loading, please wait...</div>";
var ERROR_TEXT = "<div style='height: 10px;'></div><div class='loadWait'>There was an error loading this page</div>";
var sysPropNames = {"poolpiVersion" : "PoolPi Version", "installDate" : "PoolPi Install Date", "osName" : "Operating System", "kernelVersion" : "Linux Kernel", "baseModel" : "Hardware"};

function slideDrawer()
{
	document.getElementById('sideBar').style.transform = "translateX(" + (sideBar ? '-305px' : '0px') + ")";
	sideBar = (sideBar ? false : true);
}
function retractDrawer()
{
	if(sideBar)
	{
		document.getElementById('sideBar').style.transform = 'translateX(-305px)';
		sideBar = false;
	}
}
function menuSelect(menuNumber)
{
	//Make sure localForage has loaded its information before continuing
	if(forageLoaded != 1)
	{
		setTimeout(function(){menuSelect(menuNumber)}, 100);
		return;
	}

	//Change selection and retract drawer
	document.getElementById('menuItem' + selectedMenu).className = 'menuItem';
	selectedMenu = menuNumber;
	sessionStorage.setItem('selectedMenu', selectedMenu);
	document.getElementById('menuItem' + selectedMenu).className = 'menuItem selected';
	retractDrawer();
	
	//Cancel any pending async tasks
	clearTimeout(updateLastTimeInstance);
	if(typeof fetchVideo != "undefined") fetchVideo.abort();
	
	//Load the new view
	mainContent = document.getElementById('mainContent');
	barTitle = document.getElementById('barTitle');
	
	switch(menuNumber)
	{
		case 0:
		barTitle.innerHTML = "Live";
		if(typeof(EventSource) !== "undefined")
		{
			mainContent.innerHTML = "<div id='container'><video autoplay='true' id='videoStream'></video></div>";

			var video = document.querySelector("#videoStream");

			if (navigator.mediaDevices.getUserMedia)
			{
				navigator.mediaDevices.getUserMedia({ video: true })
				.then(function (stream)
				{
					video.srcObject = stream;
				})
				.catch(function (err)
				{
					console.log("getUserMedia error: " + err);
				});
			}
		}
		else mainContent.innerHTML = "<div style='height: 10px;'></div><div class='loadWait'>Sorry! Internet Explorer does not support Live. Please use a real browser.</div>";
		break;

		case 1:
		barTitle.innerHTML = "Recordings";
		mainContent.innerHTML = LOADING_TEXT;
		xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function()
		{
			//Online mode, fetch from server
			if(this.readyState == 4 && this.status == 200)
			{
				try { videoArray = JSON.parse(this.responseText); }
				catch(err)
				{
					mainContent.innerHTML = ERROR_TEXT;
					return;
				}

				//Merge cached videos
				videoArray = videoArray.concat(savedVideos);
				videoArray.sort();
				videoArray = Array.from(new Set(videoArray));
				
				mainContent.innerHTML = '';
				offline = false;
				parseVideos();
			}
			
			//Offline mode, view cached videos only
			else if (xhttp.readyState == 4 && xhttp.status == 0)
			{
				mainContent.innerHTML = "<div style='height: 10px;'></div><div class='offlineMessage'><i class='fa fa-times-circle' aria-hidden='true'></i> Only cached videos are available in offline mode.</div>";
				videoArray = savedVideos;
				offline = true;
				parseVideos();
			}
		};
		xhttp.open("GET", "dataHandler.php?action=vidList", true);
		xhttp.send();
		break;
		
		case 2:
		barTitle.innerHTML = "System Info";
		mainContent.innerHTML = LOADING_TEXT;
		xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function()
		{
			//Online mode, fetch from server
			working = false;
			if(this.readyState == 4 && this.status == 200)
			{
				try { sysInfo = JSON.parse(this.responseText); }
				catch(err)
				{
					mainContent.innerHTML = ERROR_TEXT;
					return;
				}
				
				//Save to localStorage for offline view
				localStorage.setItem("sysInfo", JSON.stringify(sysInfo));
				working = true;
			}
			
			//Offline mode, view cached information
			else if (xhttp.readyState == 4 && xhttp.status == 0)
			{
				if(localStorage.getItem('sysInfo') != null)
				{
					try { sysInfo = JSON.parse(localStorage.getItem('sysInfo')); }
					catch(err)
					{
						mainContent.innerHTML = ERROR_TEXT;
						return;
					}
					
					working = true;
				}
				else
				{
					mainContent.innerHTML = ERROR_TEXT;
					return;
				}
			}
			
			if(working)
			{
				infoBox = document.createElement("div");
				infoBox.className = "settingsList";
				infoBox.style.marginTop = "20px";
				mainContent.innerHTML = "<div style='height: 10px;'></div>";
				
				poolpiLogo = document.createElement("img");
				poolpiLogo.src="icon.png";
				poolpiLogo.className = "poolpiIcon";
				mainContent.appendChild(poolpiLogo);
				
				poolpiLabel = document.createElement("div");
				poolpiLabel.className = "poolpiLabel";
				poolpiLabel.innerHTML = "PoolPi";
				mainContent.appendChild(poolpiLabel);
				
				if(typeof sysInfo.poolpiVersion != "undefined")
				{
					poolpiVersion = document.createElement("div");
					poolpiVersion.className = "poolpiVersion";
					poolpiVersion.innerHTML = sysInfo.poolpiVersion;
					mainContent.appendChild(poolpiVersion);
				}
				mainContent.appendChild(infoBox);
				
			
				for (var key in sysInfo)
				{
					if (typeof sysInfo[key] !== 'function')
					{
						if(key == "poolpiVersion") continue;
						newSysProp = document.createElement("div");
						newSysProp.className = "settingsItem settingsItemNoClick";
						newSysProp.innerHTML = "<div class='sysProp'>" + sysPropNames[key] + "</div><div class='sysProp'>" + sysInfo[key] + "</div>";
						infoBox.appendChild(newSysProp);
					}
				}
			}
		};
		xhttp.open("GET", "dataHandler.php?action=sysInfo", true);
		xhttp.send();
		break;
		
		case 3:
		barTitle.innerHTML = "Settings";
		mainContent.innerHTML = "";

		//Padding
		paddingBox = document.createElement('div');
		paddingBox.style.height = '10px';
		mainContent.appendChild(paddingBox);
		
		//Load online-only results
		xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function()
		{
			if (this.readyState == 4 && this.status == 200)
			{
				try { var currentSettings = JSON.parse(this.responseText); }
				catch(err)
				{
					mainContent.innerHTML += "<div style='height: 10px;'></div><div class='offlineMessage'><i class='fa fa-times-circle' aria-hidden='true'></i> There was an error loading the rest of your settings</div>";
					return;
				}
		
				//Network
				networkLabel = document.createElement('div');
				networkLabel.className = 'settingsLabel';
				networkLabel.innerHTML = "Networking";
				mainContent.appendChild(networkLabel);
		
				networkList = document.createElement('div');
				networkList.className = 'settingsList';
				mainContent.appendChild(networkList);
		
				networkPanel = document.createElement('div');
				networkPanel.className = "settingsItem settingsItemNoClick";
				networkPanel.style.textAlign = 'left';
				networkPanel.style.lineHeight = 2;
				networkList.appendChild(networkPanel);
		
				apSet = document.createElement('label');
				accessPoint = document.createElement('input');
				accessPoint.type = 'radio';
				accessPoint.name = 'networkSwitch';
				accessPoint.value = 'ap';
				accessPoint.id='apButton'
				accessPoint.onclick = function(){document.getElementById('ssid').value = ""; document.getElementById('password').value = ""}
				apLabel = document.createElement('span');
				apLabel.innerHTML = "Create Access Point";
				apSet.appendChild(accessPoint);
				apSet.appendChild(apLabel);
				networkPanel.appendChild(apSet);
				networkPanel.appendChild(document.createElement('br'));
		
				ctSet = document.createElement('label');
				client = document.createElement('input');
				client.type = 'radio';
				client.name = 'networkSwitch';
				client.value = 'ct';
				client.id='clientButton';
				client.onclick = function(){document.getElementById('ssid').value = ""; document.getElementById('password').value = ""}
				ctLabel = document.createElement('span');
				ctLabel.innerHTML = "Connect to existing network";
				ctSet.appendChild(client);
				ctSet.appendChild(ctLabel);
				networkPanel.appendChild(ctSet);
				networkPanel.appendChild(document.createElement('br'));
		
				padding = document.createElement('div');
				padding.style.height = '10px';
				networkPanel.appendChild(padding);
		
				ssidSet = document.createElement('label');
				ssidLabel = document.createElement('span');
				ssidLabel.innerHTML = "SSID: ";
				ssid = document.createElement('input');
				ssid.type = 'text';
				ssid.name = 'ssid';
				ssid.id = 'ssid';
				ssid.value = currentSettings["SSID"];
				ssidSet.appendChild(ssidLabel);
				ssidSet.appendChild(ssid);
				networkPanel.appendChild(ssidSet);
		
				pwSet = document.createElement('label');
				pwLabel = document.createElement('span');
				pwLabel.innerHTML = "Password: ";
				password = document.createElement('input');
				password.type = 'text';
				password.name = 'password';
				password.id = 'password';
				password.value = currentSettings["PSK"];
				pwSet.appendChild(pwLabel);
				pwSet.appendChild(password);
				networkPanel.appendChild(pwSet);
				networkPanel.appendChild(document.createElement('br'));
		
				networkSave = document.createElement('div');
				networkSave.className = 'settingsItem settingsButton';
				networkSave.innerHTML = "Save changes";
				networkSave.id = 'networkSave';
				networkSave.onclick = function()
				{
					getNetType = document.getElementsByName('networkSwitch');
					for(i = 0; i < getNetType.length; i++) if(getNetType[i].checked) break;
					if(i == getNetType.length || getNetType[i].value == 'dn') return;
			
					if(document.getElementById('password').value.length < 8)
					{
						alert("Your password must be at least 8 characters");
						return;
					}
			
					networkInfo = new FormData();
					networkInfo.append("ssid", document.getElementById('ssid').value);
					networkInfo.append("password", document.getElementById('password').value);

					currentSettings["Mode"] = (getNetType[i].value == 'ap' ? 0 : 1);
					currentSettings["SSID"] = document.getElementById('ssid').value;
					currentSettings["PSK"] = document.getElementById('password').value;
			
					url = "dataHandler.php?action=" + getNetType[i].value;
					xhttp = new XMLHttpRequest();
					xhttp.open("POST", url, true);
					xhttp.send(networkInfo);
					document.getElementById("mainContent").innerHTML = "<div style='height: 10px;'></div><div class='settingsLabel'>" +  (getNetType[i].value == 'ap' ? "Access Point Creation" : "Client Connection") + " Successful</div><div class='settingsList'><div class='settingsItem settingsItemNoClick' style='text-align: center;'>You have switched your PoolPi into " + (getNetType[i].value == 'ap' ? "access point" : "client") + " mode. Please give it a minute to reconfigure itself, then connect to it accordingly</div></div>";
				};
				networkList.appendChild(networkSave);

				if(currentSettings["Mode"] == 0) document.getElementById('apButton').checked = true;
				else document.getElementById('clientButton').checked = true;
				
				//Time sync
				timeLabel = document.createElement('div');
				timeLabel.className = 'settingsLabel';
				timeLabel.innerHTML = "Time sync";
				mainContent.appendChild(timeLabel);
		
				timeList = document.createElement('div');
				timeList.className = 'settingsList';
				mainContent.appendChild(timeList);
		
				syncTime = document.createElement('div');
				syncTime.className = "settingsItem";
				syncTime.id = "syncTime";
				syncTime.innerHTML = "<i class='far fa-clock'></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sync PoolPi time with this device";
				syncTime.onclick = function()
				{
					this.innerHTML = "<i class='far fa-clock'></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Syncing time...";
					timeSyncer = new XMLHttpRequest();
					timeSyncer.onreadystatechange = function()
					{
						if(this.readyState == 4 && this.status == 200)
						{
							if(this.responseText == "success") document.getElementById('syncTime').innerHTML = "<i class='far fa-clock'></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Time successfully synced!";
							else document.getElementById('syncTime').innerHTML = "<i class='far fa-clock'></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Time sync failed! Tap to try again";
							setTimeout(function(){document.getElementById('syncTime').innerHTML = "<i class='far fa-clock'></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sync PoolPi time with this device";}, 5000);
						}
					};
					timeSyncer.open("GET", "dataHandler.php?action=timeSync&timestamp=" + Date.now(), true);
					timeSyncer.send();
					
				};
				timeList.appendChild(syncTime);
				
				//Power Management
				powerLabel = document.createElement('div');
				powerLabel.className = 'settingsLabel';
				powerLabel.innerHTML = "Power Management";
				mainContent.appendChild(powerLabel);
		
				powerList = document.createElement('div');
				powerList.className = 'settingsList';
				mainContent.appendChild(powerList);
		
				shutdownButton = document.createElement('div');
				shutdownButton.className = 'settingsItem';
				shutdownButton.innerHTML = "<i class='fa fa-power-off' ></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Shutdown";
				shutdownButton.onclick = function() { powerManagement(0); };
				powerList.appendChild(shutdownButton);
		
				restartButton = document.createElement('div');
				restartButton.className = 'settingsItem';
				restartButton.innerHTML = "<i class='fa fa-sync' ></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Restart";
				restartButton.onclick = function() { powerManagement(1); };
				powerList.appendChild(restartButton);
			}
			else if (xhttp.readyState == 4 && xhttp.status == 0)
			{
				paddingDiv = document.createElement('div');
				paddingDiv.style.height = '10px';
				mainContent.appendChild(paddingDiv);
				
				offMessage = document.createElement('div');
				offMessage.innerHTML = "<i class='fa fa-times-circle' aria-hidden='true'></i> Only some settings are available while offline.";
				offMessage.className = "offlineMessage";
				mainContent.appendChild(offMessage);
			}
		};
		xhttp.open("GET", "dataHandler.php?action=currentSettings", true);
		xhttp.send();

		break;
	}
}

function loadVideo(newVideo)
{
	currentVideo = newVideo = parseInt(newVideo);
	vidPlayer = document.getElementById('dashPlayer');
	
	//Opportunistically load from cache
	if(savedVideos.indexOf(videoArray[newVideo]) != -1) localforage.getItem('video' + videoArray[newVideo], function (err, value){if(value != null) vidPlayer.src = URL.createObjectURL(value);});
	else vidPlayer.src = "/vids/" + videoArray[newVideo] + ".mp4";
	
	navBar = document.getElementById('navbar');
	navBar.innerHTML = "";
	
	if(newVideo != 0)
	{
		lastIcon = document.createElement('i');
		lastIcon.className = 'fa fa-step-backward navbarArrows';
		lastSpan = document.createElement('span');
		lastSpan.onclick = function(){loadVideo(newVideo - 1)};
		lastSpan.appendChild(lastIcon);
		navBar.appendChild(lastSpan);
	}
	
	navBar.appendChild(videoSelect);
	videoSelect.selectedIndex = newVideo;
	
	if(newVideo != videoArray.length - 1)
	{
		nextIcon = document.createElement('i');
		nextIcon.className = 'fa fa-step-forward navbarArrows';
		nextSpan = document.createElement('span');
		nextSpan.onclick = function(){loadVideo(newVideo + 1)};
		nextSpan.appendChild(nextIcon);
		navBar.appendChild(nextSpan);
		vidPlayer.onended = function(){loadVideo(newVideo + 1)};
	}
	else vidPlayer.onended = null;
	
	/*
	//Set up function for caching video
	downloadBox = document.getElementById('downloadBox');
	downloadBox.className = "downloadBox";
	if(savedVideos.indexOf(videoArray[newVideo]) != -1)
	{
		downloadBox.style.color = "green";
		downloadBox.innerHTML = "<i class='fa fa-check-circle' aria-hidden='true'></i> This video is cached";
		downloadBox.onclick = removeFromCache;
		downloadBox.onmouseout = function()
		{
			this.style.color = "green";
			this.innerHTML = "<i class='fa fa-check-circle' aria-hidden='true'></i> This video is cached";
		};
		downloadBox.onmouseover = function()
		{
			this.style.color = "red";
			this.innerHTML = "<i class='fas fa-times-circle'></i> Delete from cache";
		};
	}
	else
	{
		downloadBox.style.color = "";
		downloadBox.innerHTML = "Cache video for offline viewing";
		downloadBox.onclick = addToCache;
		downloadBox.onmouseover = null;
		downloadBox.onmouseout = null;
	}
	*/
}

function powerManagement(mode)
{
	url = "dataHandler.php?action=" + (mode == 0 ? "shutdown" : "restart");
	xhttp = new XMLHttpRequest();
	xhttp.open("GET", url, true);
	xhttp.send();
	document.getElementById("mainContent").innerHTML = "<div style='height: 10px;'></div><div class='settingsLabel'>" + (mode == 0 ? "Shutdown" : "Restart") + " Successful</div><div class='settingsList'><div class='settingsItem settingsItemNoClick' style='text-align: center;'>Your PoolPi is currently " + (mode == 0 ? "shutting down. You may now close this page" : "restarting. Please refresh this page in a few minutes") + "</div></div>";
	
}

function addToCache()
{
	document.getElementById('downloadBox').innerHTML = "Downloading... 0% Complete";
	document.getElementById('downloadBox').onclick = null;
	
	fetchVideo = new XMLHttpRequest();
	fetchVideo.responseType = "blob";
	fetchVideo.onreadystatechange = function()
	{
		if(this.readyState == 4 && this.status == 200)
		{
			document.getElementById('downloadBox').color = "#ffd800";
			document.getElementById('downloadBox').innerHTML = "Saving to local database...";
			
			localforage.setItem("video" + videoArray[currentVideo], this.response).then(function()
			{
				savedVideos.push(videoArray[currentVideo]);
				localforage.setItem('savedVideos', savedVideos);

				downloadBox = document.getElementById('downloadBox');
				downloadBox.style.color = "green";
				downloadBox.innerHTML = "<i class='fa fa-check-circle' aria-hidden='true'></i> This video is cached";
				downloadBox.onclick = removeFromCache;
				downloadBox.onmouseout = function()
				{
					this.style.color = "green";
					this.innerHTML = "<i class='fa fa-check-circle' aria-hidden='true'></i> This video is cached";
				};
				downloadBox.onmouseover = function()
				{
					this.style.color = "red";
					this.innerHTML = "<i class='fas fa-times-circle'></i> Delete from cache";
				};
			});
		}
	};
	fetchVideo.open("GET", "/dataHandler.php?action=vidDownload&timestamp=" + videoArray[currentVideo], true);
	fetchVideo.onprogress = function (evt){if(evt.lengthComputable) document.getElementById('downloadBox').innerHTML = "Downloading: " + Math.round((evt.loaded / evt.total) * 100) + "% Complete";};
	fetchVideo.send();

}

function removeFromCache()
{
	if(!confirm("Are you sure you want to remove this video from your cache?")) return;
	
	localforage.removeItem("video" + videoArray[currentVideo]);
	savedVideos.splice(savedVideos.indexOf(videoArray[currentVideo]), 1);
	localforage.setItem('savedVideos', savedVideos);
	
	if(offline) menuSelect(1);
	else
	{
		downloadBox = document.getElementById('downloadBox');
		downloadBox.onmouseover = null;
		downloadBox.onmouseout = null;
		downloadBox.style.color = "";
		downloadBox.innerHTML = "Cache video for offline viewing";
		downloadBox.onclick = addToCache;
	}
}

function parseVideos()
{
	//Create an array of human-readable strings
	dateArray = [];
	videoSelect = document.createElement('select');
	videoSelect.id = 'videoSelect';
	videoSelect.onchange = function(){loadVideo(document.getElementById('videoSelect').value);};
	videoSelect.className = 'videoSelect';
	
	if(videoArray.length == 0)
	{
		mainContent.innerHTML += "<div style='height: 10px;'></div><div class='loadWait'>You have no recorded videos</div>";
		return;
	}
	
	for(i = 0; i < videoArray.length; i++)
	{
		newOption = document.createElement('option');
		
		getDate = new Date(parseInt(videoArray[i])); //Time is already in milliseconds
		switch(getDate.getMonth())
		{
			case 0: dateArray[i] = "January"; break;
			case 1: dateArray[i] = "February"; break;
			case 2: dateArray[i] = "March"; break;
			case 3: dateArray[i] = "April"; break;
			case 4: dateArray[i] = "May"; break;
			case 5: dateArray[i] = "June"; break;
			case 6: dateArray[i] = "July"; break;
			case 7: dateArray[i] = "August"; break;
			case 8: dateArray[i] = "September"; break;
			case 9: dateArray[i] = "October"; break;
			case 10: dateArray[i] = "November"; break;
			case 11: dateArray[i] = "December"; break;
		}
		
		minute = getDate.getMinutes();
		if(minute < 10) minute = "0" + minute;
		second = getDate.getSeconds();
		if(second < 10) second = "0" + second;
		
		dateArray[i] += " " + getDate.getDate() + ", " + getDate.getFullYear() + " " + getDate.getHours() + ":" + minute + ":" + second;
		newOption.value = i;
		newOption.innerHTML = dateArray[i];
		videoSelect.appendChild(newOption);
	}
	
	//Create the interface
	video = document.createElement('video');
	video.className = "dashPlayer";
	video.controls = true;
	video.id='dashPlayer';
	video.ontimeupdate = function()
	{
		getDate = new Date(parseInt(videoArray[currentVideo]) + this.currentTime * 1000); //Time is already in milliseconds
		switch(getDate.getMonth())
		{
			case 0: shownTime = "January"; break;
			case 1: shownTime = "February"; break;
			case 2: shownTime = "March"; break;
			case 3: shownTime = "April"; break;
			case 4: shownTime = "May"; break;
			case 5: shownTime = "June"; break;
			case 6: shownTime = "July"; break;
			case 7: shownTime = "August"; break;
			case 8: shownTime = "September"; break;
			case 9: shownTime = "October"; break;
			case 10: shownTime = "November"; break;
			case 11: shownTime = "December"; break;
		}
		
		minute = getDate.getMinutes();
		if(minute < 10) minute = "0" + minute;
		second = getDate.getSeconds();
		if(second < 10) second = "0" + second;
		
		shownTime += " " + getDate.getDate() + ", " + getDate.getFullYear() + " " + getDate.getHours() + ":" + minute + ":" + second;
		
		document.getElementById('videoSelect').childNodes[currentVideo].innerHTML = shownTime;
	};
	
	paddingBox = document.createElement('div');
	paddingBox.style.height = '10px';
	mainContent.appendChild(paddingBox);
	
	navBar = document.createElement('div');
	navBar.className = "navbar";
	navBar.id = "navbar";

	//downloadBox = document.createElement('div');
	//downloadBox.className = 'downloadBox';
	//downloadBox.id = 'downloadBox';
	
	prettyBox = document.createElement('div');
	prettyBox.className = 'prettyBox';
	prettyBox.appendChild(video);
	prettyBox.appendChild(navBar);
	//prettyBox.appendChild(downloadBox);
	mainContent.appendChild(prettyBox);

	paddingBox = document.createElement('div');
	paddingBox.style.height = '10px';
	mainContent.appendChild(paddingBox);
	
	loadVideo(videoArray.length - 1);
}

window.addEventListener("load", function()
{
	if(sessionStorage.getItem('selectedMenu') != null) selectedMenu = parseInt(sessionStorage.getItem('selectedMenu'));
	localforage.getItem('savedVideos', function (err, value)
	{
		if(value != null) savedVideos = value;
		forageLoaded++;
	});

	menuSelect(selectedMenu);
});
