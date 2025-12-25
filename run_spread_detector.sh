#!/bin/bash
#
# CoinNavigator Spread Detector Runner
# Wrapper script for running the spread detector
# Can be used with cron jobs or manual execution
#

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Warning: venv not found. Using system Python."
fi

# Create data directory if it doesn't exist
mkdir -p data

# Create logs directory if it doesn't exist
mkdir -p logs

# Run the spread detector
echo "$(date): Starting spread detector..." >> logs/runner.log
python src/spread_detector.py >> logs/runner.log 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "$(date): Spread detector completed successfully" >> logs/runner.log
else
    echo "$(date): Spread detector failed with exit code $EXIT_CODE" >> logs/runner.log
fi

# Deactivate virtual environment if it was activated
if [ -d "venv" ]; then
    deactivate
fi

exit $EXIT_CODE


