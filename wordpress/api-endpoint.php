<?php
/**
 * CoinNavigator API Endpoint
 * Reads spread_data.json and returns as JSON API
 * 
 * Usage: Place this file in your WordPress root or uploads directory
 * Access: https://coinnavigator.net/api-endpoint.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Path to JSON file (adjust based on your server structure)
$json_path = __DIR__ . '/../data/spread_data.json';

// Alternative path if file is in WordPress uploads directory
// $json_path = WP_CONTENT_DIR . '/uploads/coinnavigator/spread_data.json';

if (!file_exists($json_path)) {
    http_response_code(404);
    echo json_encode([
        'error' => 'Data file not found',
        'path' => $json_path
    ]);
    exit;
}

$json_content = file_get_contents($json_path);
$data = json_decode($json_content, true);

if ($data === null) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid JSON data',
        'json_error' => json_last_error_msg()
    ]);
    exit;
}

// Add cache headers (optional - adjust as needed)
header('Cache-Control: public, max-age=60'); // Cache for 60 seconds

echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);


