<?php
?>
<!DOCTYPE html>
<html manifest="poolpi.appcache">
	<head>
		<title>PoolPi</title>
		
		<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
		<meta name="mobile-web-app-capable" content="yes">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<link rel="apple-touch-icon" href="/icon.png">
	
		<link rel="stylesheet" href="/styles.css">
		<link rel="stylesheet" href="/opensans.css">
		<link rel="manifest" href="/manifest.json">
		<script src='/script.js'></script>
		<script src='/raphael-2.1.4.min.js'></script>
		<script src='/localforage.min.js'></script>
		<script src="/fontawesome-all.js"></script>
	</head>
	<body>
		<div class='topBar'>
			<div class='topBarInner'>
				<div class="barRefresh" onclick="slideDrawer()"><i class="fa fa-bars" aria-hidden="true"></i></div>
				<div class='barTitle' id='barTitle'></div>
				<div class="barRefresh" onclick="menuSelect(selectedMenu)"><i class="fa fa-sync" aria-hidden="true"></i></div>
			</div>
		</div>
		<div class='sideBar' id='sideBar'>
			<div class='mainBodyPadding'></div>
<!--			<div id='menuItem0' onclick='menuSelect(0);' class='menuItem'><i class="fa fa-camera" aria-hidden="true" style='font-size: 18pt; vertical-align: middle;'></i><div style='vertical-align: middle; display: inline-block;'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Live</div></div>
-->			<div id='menuItem1' onclick='menuSelect(1);' class='menuItem'><i class="fa fa-video" aria-hidden="true" style='font-size: 18pt; vertical-align: middle;'></i><div style='vertical-align: middle; display: inline-block;'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Recordings</div></div>
			<div id='menuItem2' onclick='menuSelect(2);' class='menuItem'><i class="fa fa-info-circle" aria-hidden="true" style='font-size: 18pt; vertical-align: middle;'></i><div style='vertical-align: middle; display: inline-block;'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;System Info</div></div>
			<div id='menuItem3' onclick='menuSelect(3);' class='menuItem'><i class="fa fa-cog" aria-hidden="true" style='font-size: 18pt; vertical-align: middle;'></i><div style='vertical-align: middle; display: inline-block;'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Settings</div></div>
		</div>
		<div class='mainBody' onclick='retractDrawer();'>
			<div class='mainBodyPadding'></div>
			<div id='mainContent' class='mainContent'></div>
		</div>
	</body>
</html>
