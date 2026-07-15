<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$host = "31.11.38.12";
$user = "Sql1901803";
$pass = "gL28011967!";
$db   = "Sql1901803_5";

$conn = mysqli_connect($host, $user, $pass, $db);

if (!$conn) {
    die("FAIL: " . mysqli_connect_error());
}

echo "OK";