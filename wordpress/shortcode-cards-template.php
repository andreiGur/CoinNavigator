<?php
/**
 * Cards template for spread display
 */
?>

<div class="coinnavigator-spread-cards">
    <style>
        .coinnavigator-spread-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .coinnavigator-card {
            background: #fff;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .coinnavigator-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
        }
        .coinnavigator-card-header {
            font-size: 1.5em;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        .coinnavigator-card-price-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
        }
        .coinnavigator-card-label {
            color: #718096;
            font-size: 0.9em;
        }
        .coinnavigator-card-value {
            font-weight: 600;
            color: #2d3748;
        }
        .coinnavigator-card-spread {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #e2e8f0;
        }
        .coinnavigator-card-spread-value {
            font-size: 1.8em;
            font-weight: 700;
            color: #e53e3e;
        }
        .coinnavigator-card-spread-value.positive {
            color: #38a169;
        }
        .coinnavigator-timestamp {
            text-align: center;
            margin-top: 20px;
            color: #718096;
            font-size: 0.85em;
        }
    </style>
    
    <?php foreach ($symbols as $symbol => $spread_data): ?>
    <div class="coinnavigator-card">
        <div class="coinnavigator-card-header"><?php echo esc_html($symbol); ?></div>
        
        <div class="coinnavigator-card-price-row">
            <span class="coinnavigator-card-label">Binance:</span>
            <span class="coinnavigator-card-value">$<?php echo number_format($spread_data['binance_price'], 2); ?></span>
        </div>
        
        <div class="coinnavigator-card-price-row">
            <span class="coinnavigator-card-label">ByBit:</span>
            <span class="coinnavigator-card-value">$<?php echo number_format($spread_data['bybit_price'], 2); ?></span>
        </div>
        
        <div class="coinnavigator-card-spread">
            <div class="coinnavigator-card-label">Spread</div>
            <div class="coinnavigator-card-spread-value <?php echo $spread_data['spread_percent'] < 0.1 ? 'positive' : ''; ?>">
                <?php echo number_format($spread_data['spread_percent'], 4); ?>%
            </div>
            <div class="coinnavigator-card-label" style="margin-top: 5px;">
                Difference: $<?php echo number_format($spread_data['absolute_diff'], 2); ?>
            </div>
        </div>
    </div>
    <?php endforeach; ?>
    
    <?php if ($timestamp): ?>
    <div class="coinnavigator-timestamp" style="grid-column: 1 / -1;">
        Last updated: <?php echo date('Y-m-d H:i:s', strtotime($timestamp)); ?>
    </div>
    <?php endif; ?>
</div>


