'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getUserProfile } from '@/lib/auth-utils';

export default function AuthStatus() {
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUserProfile(user.id).then((data) => {
        setProfile(data);
        setProfileLoading(false);
      });
    } else {
      setProfile(null);
      setProfileLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-gray-400">Loading authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Authentication Status</h3>
        <p className="text-gray-400 mb-3">Not authenticated</p>
        <div className="flex gap-2">
          <a
            href="/login"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            Login
          </a>
          <a
            href="/signup"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
          >
            Sign Up
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2">Authentication Status</h3>
      <div className="space-y-2">
        <p className="text-green-400">✓ Authenticated</p>
        <p className="text-sm text-gray-400">
          Email: {user.email}
        </p>
        {(profile?.username || user.user_metadata?.username) && (
          <p className="text-sm text-gray-400">
            Username: {profile?.username || user.user_metadata.username}
          </p>
        )}
        {!profileLoading && profile && (
          <p className="text-sm text-gray-400">
            Balance: ${profile.balance?.toFixed(2) || '0.00'}
          </p>
        )}
        <p className="text-xs text-gray-500 break-all">
          ID: {user.id}
        </p>
        <button
          onClick={signOut}
          className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}