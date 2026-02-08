#!/usr/bin/env python3
"""
Watch the collector daemon activity by monitoring the database
"""
import sqlite3
import time
from datetime import datetime

def get_stats():
    """Get current database statistics"""
    try:
        conn = sqlite3.connect('ttc_predictions.db')
        cursor = conn.cursor()

        # Total counts
        cursor.execute("SELECT COUNT(*) FROM frozen_predictions")
        total_frozen = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM verified_arrivals")
        total_verified = cursor.fetchone()[0]

        # Recent frozen predictions (last 5 minutes)
        cursor.execute("""
            SELECT COUNT(*) FROM frozen_predictions
            WHERE timestamp > ?
        """, (time.time() - 300,))
        recent_frozen = cursor.fetchone()[0]

        # Recent verified arrivals (last 5 minutes)
        cursor.execute("""
            SELECT COUNT(*) FROM verified_arrivals
            WHERE timestamp > ?
        """, (time.time() - 300,))
        recent_verified = cursor.fetchone()[0]

        # Latest frozen prediction
        cursor.execute("""
            SELECT route, vehicle_id, frozen_prediction_seconds,
                   datetime(timestamp, 'unixepoch', 'localtime')
            FROM frozen_predictions
            ORDER BY timestamp DESC LIMIT 1
        """)
        latest_frozen = cursor.fetchone()

        # Latest verified arrival
        cursor.execute("""
            SELECT route, vehicle_id, actual_error_seconds, status,
                   datetime(timestamp, 'unixepoch', 'localtime')
            FROM verified_arrivals
            ORDER BY timestamp DESC LIMIT 1
        """)
        latest_verified = cursor.fetchone()

        conn.close()

        return {
            'total_frozen': total_frozen,
            'total_verified': total_verified,
            'recent_frozen': recent_frozen,
            'recent_verified': recent_verified,
            'latest_frozen': latest_frozen,
            'latest_verified': latest_verified,
        }
    except Exception as e:
        return {'error': str(e)}

def main():
    print("🔍 Watching TTC Collector Activity")
    print("=" * 60)
    print("Press Ctrl+C to stop\n")

    last_frozen_count = 0
    last_verified_count = 0

    while True:
        stats = get_stats()

        if 'error' in stats:
            print(f"❌ Error: {stats['error']}")
            time.sleep(5)
            continue

        timestamp = datetime.now().strftime('%H:%M:%S')

        # Check for new activity
        new_frozen = stats['total_frozen'] - last_frozen_count
        new_verified = stats['total_verified'] - last_verified_count

        print(f"\n[{timestamp}] 📊 Status:")
        print(f"  Total: {stats['total_frozen']} frozen, {stats['total_verified']} verified")
        print(f"  Recent (5min): {stats['recent_frozen']} frozen, {stats['recent_verified']} verified")

        if new_frozen > 0:
            print(f"  🆕 {new_frozen} new frozen prediction(s)!")

        if new_verified > 0:
            print(f"  ✅ {new_verified} new verified arrival(s)!")

        if stats['latest_frozen']:
            route, vehicle, pred_sec, time_str = stats['latest_frozen']
            print(f"  Latest frozen: Route {route}, Vehicle {vehicle}, {pred_sec}s @ {time_str}")

        if stats['latest_verified']:
            route, vehicle, error, status, time_str = stats['latest_verified']
            print(f"  Latest arrival: Route {route}, Vehicle {vehicle}, {error}s error ({status}) @ {time_str}")

        last_frozen_count = stats['total_frozen']
        last_verified_count = stats['total_verified']

        time.sleep(10)  # Check every 10 seconds

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Stopped watching")
