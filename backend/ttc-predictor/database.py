#!/usr/bin/env python3
"""
TTC Prediction Database
SQLite backend for storing predictions across all routes and stops
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import json

class PredictionDB:
    """Database for storing TTC predictions."""

    def __init__(self, db_file="ttc_predictions.db"):
        self.db_file = db_file
        self.init_db()

    def init_db(self):
        """Initialize database schema."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        # Frozen predictions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS frozen_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                vehicle_id TEXT NOT NULL,
                route TEXT NOT NULL,
                stop_from TEXT NOT NULL,
                stop_name_from TEXT,
                frozen_prediction_seconds INTEGER,
                freeze_category TEXT,
                hour_of_day INTEGER,
                day_of_week TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(vehicle_id, route, stop_from, timestamp)
            )
        ''')

        # Verified arrivals table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS verified_arrivals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                frozen_prediction_id INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                vehicle_id TEXT NOT NULL,
                route TEXT NOT NULL,
                stop_from TEXT NOT NULL,
                stop_to TEXT NOT NULL,
                stop_name_from TEXT,
                stop_name_to TEXT,
                frozen_prediction_seconds INTEGER,
                freeze_category TEXT,
                time_elapsed_seconds REAL,
                actual_error_seconds REAL,
                hour_of_day INTEGER,
                day_of_week TEXT,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(frozen_prediction_id) REFERENCES frozen_predictions(id)
            )
        ''')

        # Route/Stop metadata
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS routes_stops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                route TEXT NOT NULL,
                route_name TEXT,
                stop TEXT NOT NULL,
                stop_name TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                next_stop TEXT,
                next_stop_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(route, stop)
            )
        ''')

        # Statistics cache (for faster queries)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS statistics_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                route TEXT,
                stop TEXT,
                freeze_category TEXT,
                hour_of_day INTEGER,
                day_of_week TEXT,
                avg_error_seconds REAL,
                stdev_error_seconds REAL,
                sample_count INTEGER,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(route, stop, freeze_category, hour_of_day, day_of_week)
            )
        ''')

        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_route_stop ON verified_arrivals(route, stop_from)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_freeze_category ON verified_arrivals(freeze_category)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_hour ON verified_arrivals(hour_of_day)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_vehicle ON frozen_predictions(vehicle_id)')

        conn.commit()
        conn.close()

    def add_frozen_prediction(self, vehicle_id: str, route: str, stop: str,
                             stop_name: str, prediction_seconds: int,
                             freeze_category: str, hour_of_day: int,
                             day_of_week: str):
        """Record a frozen prediction."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        try:
            cursor.execute('''
                INSERT INTO frozen_predictions
                (vehicle_id, route, stop_from, stop_name_from, frozen_prediction_seconds,
                 freeze_category, hour_of_day, day_of_week)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (vehicle_id, route, stop, stop_name, prediction_seconds,
                  freeze_category, hour_of_day, day_of_week))

            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            # Duplicate - skip
            return None
        finally:
            conn.close()

    def add_verified_arrival(self, vehicle_id: str, route: str, stop_from: str,
                            stop_to: str, stop_name_from: str, stop_name_to: str,
                            prediction_seconds: int, freeze_category: str,
                            time_elapsed: float, error_seconds: float,
                            hour_of_day: int, day_of_week: str, status: str):
        """Record a verified arrival."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO verified_arrivals
            (vehicle_id, route, stop_from, stop_to, stop_name_from, stop_name_to,
             frozen_prediction_seconds, freeze_category, time_elapsed_seconds,
             actual_error_seconds, hour_of_day, day_of_week, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (vehicle_id, route, stop_from, stop_to, stop_name_from, stop_name_to,
              prediction_seconds, freeze_category, time_elapsed, error_seconds,
              hour_of_day, day_of_week, status))

        conn.commit()
        conn.close()

    def add_route_stop(self, route: str, route_name: str, stop: str,
                      stop_name: str, lat: float, lon: float,
                      next_stop: str = None, next_stop_name: str = None):
        """Store route/stop metadata."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        try:
            cursor.execute('''
                INSERT INTO routes_stops
                (route, route_name, stop, stop_name, latitude, longitude, next_stop, next_stop_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (route, route_name, stop, stop_name, lat, lon, next_stop, next_stop_name))

            conn.commit()
        except sqlite3.IntegrityError:
            pass  # Already exists
        finally:
            conn.close()

    def get_statistics(self, route: str = None, stop: str = None,
                      freeze_category: str = None, hour_of_day: int = None,
                      day_of_week: str = None) -> List[Dict]:
        """Query statistics with flexible filtering."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        query = 'SELECT * FROM statistics_cache WHERE 1=1'
        params = []

        if route:
            query += ' AND route = ?'
            params.append(route)
        if stop:
            query += ' AND stop = ?'
            params.append(stop)
        if freeze_category:
            query += ' AND freeze_category = ?'
            params.append(freeze_category)
        if hour_of_day is not None:
            query += ' AND hour_of_day = ?'
            params.append(hour_of_day)
        if day_of_week:
            query += ' AND day_of_week = ?'
            params.append(day_of_week)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        # Convert to dicts
        results = []
        for row in rows:
            results.append({
                'route': row[1],
                'stop': row[2],
                'freeze_category': row[3],
                'hour_of_day': row[4],
                'day_of_week': row[5],
                'avg_error': row[6],
                'stdev': row[7],
                'count': row[8],
            })

        return results

    def get_raw_arrivals(self, route: str = None, stop: str = None,
                        freeze_category: str = None) -> List[Dict]:
        """Get raw arrival data for analysis."""
        conn = sqlite3.connect(self.db_file)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        query = 'SELECT * FROM verified_arrivals WHERE 1=1'
        params = []

        if route:
            query += ' AND route = ?'
            params.append(route)
        if stop:
            query += ' AND stop_from = ?'
            params.append(stop)
        if freeze_category:
            query += ' AND freeze_category = ?'
            params.append(freeze_category)

        query += ' ORDER BY created_at DESC LIMIT 1000'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]

    def update_statistics_cache(self):
        """Recalculate statistics from raw data."""
        import statistics as stats

        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        # Get all unique combinations
        cursor.execute('''
            SELECT DISTINCT route, stop_from, freeze_category, hour_of_day, day_of_week
            FROM verified_arrivals
        ''')

        combos = cursor.fetchall()

        for route, stop, freeze_cat, hour, day in combos:
            # Get all errors for this combination
            cursor.execute('''
                SELECT actual_error_seconds FROM verified_arrivals
                WHERE route = ? AND stop_from = ? AND freeze_category = ?
                AND hour_of_day = ? AND day_of_week = ?
            ''', (route, stop, freeze_cat, hour, day))

            errors = [row[0] for row in cursor.fetchall()]

            if errors:
                avg_error = stats.mean(errors)
                stdev = stats.stdev(errors) if len(errors) > 1 else 0
                count = len(errors)

                # Update or insert
                cursor.execute('''
                    INSERT OR REPLACE INTO statistics_cache
                    (route, stop, freeze_category, hour_of_day, day_of_week,
                     avg_error_seconds, stdev_error_seconds, sample_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (route, stop, freeze_cat, hour, day, avg_error, stdev, count))

        conn.commit()
        conn.close()

    def get_status(self) -> Dict:
        """Get database statistics."""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM frozen_predictions')
        frozen_count = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM verified_arrivals')
        verified_count = cursor.fetchone()[0]

        cursor.execute('SELECT DISTINCT route FROM routes_stops')
        route_count = len(cursor.fetchall())

        cursor.execute('SELECT DISTINCT route, stop FROM routes_stops')
        route_stop_count = len(cursor.fetchall())

        conn.close()

        return {
            'frozen_predictions': frozen_count,
            'verified_arrivals': verified_count,
            'routes': route_count,
            'route_stops': route_stop_count,
        }


if __name__ == "__main__":
    db = PredictionDB()
    print("✓ Database initialized")
    print(f"Status: {db.get_status()}")
