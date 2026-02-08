'use client';

import { useState, useEffect } from 'react';

interface BusPrediction {
  vehicle_id: string;
  current_eta_seconds: number;
  current_eta_display: string;
  direction: string;
  recorded_at: string;
}

interface FrozenPrediction {
  vehicle_id: string;
  frozen_at: string;
  frozen_prediction_seconds: number;
  frozen_prediction_display: string;
  time_elapsed_since: string;
  actual_elapsed_seconds: number;
  actual_elapsed_display: string;
  error_seconds: number;
  error_display: string;
  status: string;
}

interface StopData {
  timestamp: string;
  route: string;
  stop: string;
  route_name: string;
  stop_name: string;
  current_predictions: BusPrediction[];
  frozen_predictions_history: FrozenPrediction[];
}

export default function BusPredictionMarket() {
  const [stopData, setStopData] = useState<StopData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState('501');
  const [selectedStop, setSelectedStop] = useState('6155');

  const fetchStopData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:5000/stop/${selectedRoute}/${selectedStop}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStopData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStopData();
  }, [selectedRoute, selectedStop]);

  const getAccuracyColor = (errorSeconds: number) => {
    const absError = Math.abs(errorSeconds);
    if (absError <= 15) return 'text-green-400';
    if (absError <= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'arrived': return 'bg-green-600';
      case 'missed': return 'bg-red-600';
      case 'pending': return 'bg-yellow-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">TTC Bus Prediction Market</h1>
      
      {/* Controls */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Route</label>
            <input
              type="text"
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 501"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stop</label>
            <input
              type="text"
              value={selectedStop}
              onChange={(e) => setSelectedStop(e.target.value)}
              className="px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 6155"
            />
          </div>
          <button
            onClick={fetchStopData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4">
          <p className="text-red-200">Error: {error}</p>
        </div>
      )}

      {stopData && (
        <>
          {/* Stop Info */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <h2 className="text-xl font-semibold mb-2">
              {stopData.route_name} - {stopData.stop_name}
            </h2>
            <p className="text-sm text-gray-400">
              Route {stopData.route} • Stop {stopData.stop}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {new Date(stopData.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Current Predictions */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold mb-3">Current Predictions</h3>
            {stopData.current_predictions.length > 0 ? (
              <div className="space-y-2">
                {stopData.current_predictions.map((prediction) => (
                  <div key={prediction.vehicle_id} className="bg-gray-700 rounded p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">Vehicle {prediction.vehicle_id}</span>
                        <span className="ml-2 text-sm text-gray-400">{prediction.direction}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-400">
                          {prediction.current_eta_display}
                        </div>
                        <div className="text-xs text-gray-500">
                          {prediction.current_eta_seconds}s
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No current predictions available</p>
            )}
          </div>

          {/* Prediction Accuracy History */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Prediction Accuracy History</h3>
            {stopData.frozen_predictions_history.length > 0 ? (
              <div className="space-y-2">
                {stopData.frozen_predictions_history.map((pred, index) => (
                  <div key={`${pred.vehicle_id}-${index}`} className="bg-gray-700 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Vehicle {pred.vehicle_id}</span>
                          <span className={`px-2 py-1 text-xs rounded ${getStatusColor(pred.status)}`}>
                            {pred.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          <div>Predicted: {pred.frozen_prediction_display}</div>
                          <div>Actual: {pred.actual_elapsed_display}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${getAccuracyColor(pred.error_seconds)}`}>
                          {pred.error_display}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(pred.frozen_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No prediction history available</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}