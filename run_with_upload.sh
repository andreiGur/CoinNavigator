#!/bin/bash
#
# CoinNavigator Spread Detector Runner with Auto-Upload
# Runs the script and uploads JSON to WordPress server
#

# Configuration - ADJUST THESE PATHS
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Server configuration
SERVER_USER="cointasu"  # Change to your server username
SERVER_HOST="coinnavigator.net"
SERVER_PATH="/home/cointasu/public_html/wp-content/uploads/coinnavigator/data/"
LOCAL_JSON="data/spread_data.json"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Warning: venv not found. Using system Python."
fi

# Create directories
mkdir -p data
mkdir -p logs

# Run the spread detector
echo "$(date): Starting spread detector..." >> logs/runner.log
python src/spread_detector.py >> logs/runner.log 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "$(date): Spread detector completed successfully" >> logs/runner.log
    
    # Upload JSON to server if file exists
    if [ -f "$LOCAL_JSON" ]; then
        echo "$(date): Attempting to upload JSON to server..." >> logs/runner.log
        
        # Method 1: SCP (if SSH is available)
        if command -v scp &> /dev/null; then
            scp "$LOCAL_JSON" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}" >> logs/runner.log 2>&1
            if [ $? -eq 0 ]; then
                echo "$(date): JSON uploaded successfully via SCP" >> logs/runner.log
            else
                echo "$(date): SCP upload failed, trying alternative methods..." >> logs/runner.log
            fi
        fi
        
        # Method 2: FTP (if lftp is available)
        if command -v lftp &> /dev/null; then
            # Note: You'll need to set FTP credentials
            # lftp -u USERNAME,PASSWORD ftp.coinnavigator.net <<EOF
            # cd ${SERVER_PATH}
            # put ${LOCAL_JSON}
            # bye
            # EOF
            echo "$(date): FTP upload available but not configured" >> logs/runner.log
        fi
    else
        echo "$(date): JSON file not found, skipping upload" >> logs/runner.log
    fi
else
    echo "$(date): Spread detector failed with exit code $EXIT_CODE" >> logs/runner.log
fi

# Deactivate virtual environment
if [ -d "venv" ]; then
    deactivate
fi

exit $EXIT_CODE






