<?php
/**
 * Table template for spread display
 */
?>

<div class="coinnavigator-spread-container">
    <style>
        .coinnavigator-spread-container {
            margin: 20px 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .coinnavigator-spread-table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        .coinnavigator-spread-table thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .coinnavigator-spread-table th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        .coinnavigator-spread-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        .coinnavigator-spread-table tbody tr:hover {
            background: #f8f9fa;
        }
        .coinnavigator-spread-table tbody tr:last-child td {
            border-bottom: none;
        }
        .coinnavigator-price {
            font-weight: 600;
            color: #2d3748;
        }
        .coinnavigator-spread {
            font-weight: 700;
            color: #e53e3e;
        }
        .coinnavigator-spread.positive {
            color: #38a169;
        }
        .coinnavigator-timestamp {
            text-align: center;
            padding: 10px;
            color: #718096;
            font-size: 0.9em;
        }
        .coinnavigator-symbol {
            font-weight: 700;
            color: #4a5568;
        }
    </style>
    
    <table class="coinnavigator-spread-table">
        <thead>
            <tr>
                <th>Symbol</th>
                <th>Binance Price</th>
                <th>ByBit Price</th>
                <th>Spread</th>
                <th>Difference</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($symbols as $symbol => $spread_data): ?>
            <tr>
                <td class="coinnavigator-symbol"><?php echo esc_html($symbol); ?></td>
                <td class="coinnavigator-price">$<?php echo number_format($spread_data['binance_price'], 2); ?></td>
                <td class="coinnavigator-price">$<?php echo number_format($spread_data['bybit_price'], 2); ?></td>
                <td class="coinnavigator-spread <?php echo $spread_data['spread_percent'] < 0.1 ? 'positive' : ''; ?>">
                    <?php echo number_format($spread_data['spread_percent'], 4); ?>%
                </td>
                <td>$<?php echo number_format($spread_data['absolute_diff'], 2); ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
    
    <?php if ($timestamp): ?>
    <div class="coinnavigator-timestamp">
        Last updated: <?php echo date('Y-m-d H:i:s', strtotime($timestamp)); ?>
    </div>
    <?php endif; ?>
</div>


