'use client'

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://icenode-production.up.railway.app';

interface Transaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  subnet?: string;
}

interface Stats {
  transactions: Array<{ subnet: string; count: number }>;
  volumes: Array<{ subnet: string; volume: string }>;
  contracts: { count: number };
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({ transactions: [], volumes: [], contracts: { count: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('address');
  const [selectedSubnet, setSelectedSubnet] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics. Please try again later.');
      setStats(prev => prev);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedSubnet) params.append('subnet', selectedSubnet);
      
      const response = await axios.get(`${API_URL}/transactions?${params.toString()}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      setTransactions(response.data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again later.');
      setTransactions(prev => prev);
    } finally {
      setLoading(false);
    }
  }, [selectedSubnet]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/search?${searchType}=${searchQuery}`);
      setTransactions(response.data);
    } catch (err) {
      console.error('Error searching transactions:', err);
      setError('Failed to search transactions. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadTransactions();
    const interval = setInterval(() => {
      loadStats();
      loadTransactions();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadStats, loadTransactions]);

  if (loading && !transactions.length) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
        <div className="relative py-3 sm:max-w-xl sm:mx-auto">
          <div className="text-center">
            Loading transactions...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Transactions par Subnet</h2>
            {stats.transactions.map((stat) => (
              <div key={stat.subnet} className="flex justify-between mb-2">
                <span>{stat.subnet}</span>
                <span className="font-mono">{stat.count}</span>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Volume par Subnet</h2>
            {stats.volumes.map((stat) => (
              <div key={stat.subnet} className="flex justify-between mb-2">
                <span>{stat.subnet}</span>
                <span className="font-mono">{parseFloat(stat.volume).toFixed(4)} AVAX</span>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Smart Contracts</h2>
            <div className="flex justify-between">
              <span>Total Déployés</span>
              <span className="font-mono">{stats.contracts?.count || 0}</span>
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <form onSubmit={handleSearch} className="flex flex-1 gap-2">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value="address">Adresse</option>
                  <option value="hash">Hash</option>
                  <option value="contract">Contract</option>
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                >
                  Rechercher
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      loadTransactions();
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                  >
                    Clear
                  </button>
                )}
              </form>
              <select
                value={selectedSubnet}
                onChange={(e) => setSelectedSubnet(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              >
                <option value="">Tous les Subnets</option>
                <option value="C-Chain">C-Chain</option>
                <option value="DFK">DFK</option>
                <option value="Swimmer">Swimmer</option>
                <option value="Dexalot">Dexalot</option>
              </select>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                {error}
                <button 
                  onClick={loadTransactions}
                  className="ml-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Block</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subnet</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.hash}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <a href={`https://snowtrace.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                          {tx.hash.substring(0, 10)}...
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.blockNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <a href={`https://snowtrace.io/address/${tx.from}`} target="_blank" rel="noopener noreferrer">
                          {tx.from.substring(0, 8)}...
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <a href={`https://snowtrace.io/address/${tx.to}`} target="_blank" rel="noopener noreferrer">
                          {tx.to.substring(0, 8)}...
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {parseFloat(tx.value).toFixed(4)} AVAX
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tx.timestamp * 1000).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tx.subnet || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
