<?php
/**
 * CoinNavigator WordPress Shortcode
 * 
 * Add this code to your theme's functions.php or create a custom plugin
 * 
 * Usage in WordPress editor: [coinnavigator_spread]
 */

function coinnavigator_spread_shortcode($atts) {
    // Default attributes
    $atts = shortcode_atts([
        'symbol' => 'all', // 'BTCUSDT', 'ETHUSDT', or 'all'
        'style' => 'table' // 'table' or 'cards'
    ], $atts);
    
    // Path to JSON file - ADJUST THIS PATH based on your server
    // Default: WordPress uploads directory (recommended)
    $json_path = WP_CONTENT_DIR . '/uploads/coinnavigator/data/spread_data.json';
    
    // Alternative: if JSON is outside WordPress root
    // $json_path = ABSPATH . '../data/spread_data.json';
    
    if (!file_exists($json_path)) {
        return '<div class="coinnavigator-error">Spread data not available. Please run the Python script.</div>';
    }
    
    $json_content = file_get_contents($json_path);
    $data = json_decode($json_content, true);
    
    if (!$data || !isset($data['symbols'])) {
        return '<div class="coinnavigator-error">Invalid data format.</div>';
    }
    
    $symbols = $data['symbols'];
    $timestamp = isset($data['timestamp']) ? $data['timestamp'] : '';
    
    // Filter by symbol if specified
    if ($atts['symbol'] !== 'all' && isset($symbols[$atts['symbol']])) {
        $symbols = [$atts['symbol'] => $symbols[$atts['symbol']]];
    }
    
    ob_start();
    
    if ($atts['style'] === 'cards') {
        include 'shortcode-cards-template.php';
    } else {
        include 'shortcode-table-template.php';
    }
    
    return ob_get_clean();
}
add_shortcode('coinnavigator_spread', 'coinnavigator_spread_shortcode');

