<?php

if($_GET['action'] == "") die();
set_time_limit(0);

//Load current settings
if($_GET['action'] == "currentSettings")
{
	$mysqli = new mysqli('127.0.0.1', 'poolpi', 'poolpi', 'poolpi');
	if ($mysqli->connect_errno) die();

	$sql = "SELECT value FROM env WHERE name='mode'";
	$result = $mysqli->query($sql);
	$getValue = $result->fetch_assoc();
	$dataToReturn["Mode"] = ($getValue['value'] == "client" ? 1 : 0);
	$result->free();

	$sql = "SELECT value FROM env WHERE name='ssid'";
	$result = $mysqli->query($sql);
	$getValue = $result->fetch_assoc();
	$dataToReturn["SSID"] = $getValue['value'];
	$result->free();

	$sql = "SELECT value FROM env WHERE name='psk'";
	$result = $mysqli->query($sql);
	$getValue = $result->fetch_assoc();
	$dataToReturn["PSK"] = $getValue['value'];
	$result->free();
	
	$mysqli->close();
	echo json_encode($dataToReturn);
	exit();
}

//Get system information
if($_GET['action'] == "sysInfo")
{
	$mysqli = new mysqli('127.0.0.1', 'poolpi', 'poolpi', 'poolpi');
	if ($mysqli->connect_errno) die();

	$sql = "SELECT value FROM env WHERE name='poolpiVersion'";
	$result = $mysqli->query($sql);
	$getValue = $result->fetch_assoc();
	$dataToReturn["poolpiVersion"] = $getValue['value'];
	$result->free();

	$sql = "SELECT value FROM env WHERE name='installDate'";
	$result = $mysqli->query($sql);
	$getValue = $result->fetch_assoc();
	$dataToReturn["installDate"] = $getValue['value'];
	$result->free();
	
	$mysqli->close();
	
	exec("lsb_release -d --short", $outputArray);
	$dataToReturn["osName"] = $outputArray[0];
	$dataToReturn["kernelVersion"] = php_uname("r");
	$baseModel = fopen("/sys/firmware/devicetree/base/model", "r");
	if($baseModel === false) $dataToReturn["baseModel"] = "Unknown";
	else
	{
		$dataToReturn["baseModel"] = fread($baseModel, filesize("/sys/firmware/devicetree/base/model"));
		fclose($baseModel);
	}
	
	echo json_encode($dataToReturn);
	exit();
}

//Fetch all available videos
if($_GET['action'] == "vidList")
{
	$timestamps = scandir("/var/www/html/vids");
	$totalFiles = count($timestamps);
	for($i = 0; $i < $totalFiles; $i++)
	{
		$splitArr = explode(".", $timestamps[$i]);
		if(count($splitArr) == 2 && $splitArr[1] == "mp4") $timestamps[$i] = $splitArr[0];
		else unset($timestamps[$i]);
	}

	$timestamps = array_values($timestamps);
	sort($timestamps);
	echo (count($timestamps) == 0 ? "[]" : json_encode($timestamps));
	exit();
}

if($_GET['action'] == "vidDownload" && $_GET['timestamp'] != "")
{
	header('Content-Description: File Transfer');
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="'.$_GET['timestamp'].'.mp4"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize("/var/www/html/vids/".$_GET['timestamp'].".mp4"));
    readfile("/var/www/html/vids/".$_GET['timestamp'].".mp4");
    exit;
}

//Configure wireless
if(in_array($_GET['action'], array('ap', 'ct')))
{
	$ssid = addslashes($_POST['ssid']);
	$password = addslashes($_POST['password']);
	system("run ".($_GET['action'] == "ap" ? "-a" : "-c")." ".$ssid." ".$password);
	exit();
}

//Power management
if($_GET['action'] == "shutdown") system("run -s");
if($_GET['action'] == "restart") system("run -r");

//Sync time with connected device
if($_GET['action'] == "timeSync" && is_numeric($_GET['timestamp']))
{
	$returnCode = 0;
	system("run -n " . $_GET['timestamp'], $returnCode);
	echo ($returnCode == 0 ? "success" : "fail");
	exit();
}
?>
