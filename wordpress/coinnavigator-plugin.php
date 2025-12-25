<?php
/**
 * Plugin Name: CoinNavigator Spread Detector
 * Plugin URI: https://coinnavigator.net
 * Description: Displays real-time cryptocurrency spread data between exchanges (Binance vs ByBit)
 * Version: 1.0.0
 * Author: CoinNavigator
 * License: GPL v2 or later
 * Text Domain: coinnavigator
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('COINNAVIGATOR_VERSION', '1.0.0');
define('COINNAVIGATOR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('COINNAVIGATOR_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include shortcode functionality
require_once COINNAVIGATOR_PLUGIN_DIR . 'shortcode.php';

// Optional: Add admin settings page (for future use)
add_action('admin_menu', 'coinnavigator_admin_menu');

function coinnavigator_admin_menu() {
    add_options_page(
        'CoinNavigator Settings',
        'CoinNavigator',
        'manage_options',
        'coinnavigator-settings',
        'coinnavigator_settings_page'
    );
}

function coinnavigator_settings_page() {
    ?>
    <div class="wrap">
        <h1>CoinNavigator Settings</h1>
        <div class="card">
            <h2>Spread Detector Status</h2>
            <?php
            // Check if JSON file exists
            $json_path = WP_CONTENT_DIR . '/uploads/coinnavigator/data/spread_data.json';
            if (file_exists($json_path)) {
                $data = json_decode(file_get_contents($json_path), true);
                if ($data && isset($data['timestamp'])) {
                    echo '<p style="color: green;">✓ Data file found</p>';
                    echo '<p>Last updated: ' . date('Y-m-d H:i:s', strtotime($data['timestamp'])) . '</p>';
                    echo '<p>Symbols: ' . implode(', ', array_keys($data['symbols'] ?? [])) . '</p>';
                } else {
                    echo '<p style="color: orange;">⚠ Data file exists but is invalid</p>';
                }
            } else {
                echo '<p style="color: red;">✗ Data file not found at: ' . esc_html($json_path) . '</p>';
                echo '<p>Please run the Python script and upload the JSON file to the server.</p>';
            }
            ?>
        </div>
        <div class="card">
            <h2>Usage</h2>
            <p>Add the shortcode to any page or post:</p>
            <code>[coinnavigator_spread]</code>
            <p>Or with parameters:</p>
            <code>[coinnavigator_spread symbol="BTCUSDT" style="cards"]</code>
        </div>
    </div>
    <?php
}


