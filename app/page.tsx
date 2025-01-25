'use client'

import { useState, useEffect } from 'react';
import axios from 'axios';

// Changer l'URL de l'API pour utiliser le proxy Next.js
const API_URL = '/api';

// Ajouter des logs pour le débogage
const fetchWithLogs = async (url: string) => {
  console.log(`Fetching ${url}...`);
  try {
    const response = await axios.get(url);
    console.log(`Response from ${url}:`, response.data);
    return response;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
};

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ transactions: [], volumes: [], contracts: { count: 0 } });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('address');
  const [selectedSubnet, setSelectedSubnet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour formater les adresses
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Fonction pour formater les timestamps
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Charger les statistiques
  const loadStats = async () => {
    try {
      setError(null);
      const response = await fetchWithLogs(`${API_URL}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Failed to load statistics');
    }
  };

  // Charger les transactions
  const loadTransactions = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (selectedSubnet) params.append('subnet', selectedSubnet);

      const response = await fetchWithLogs(`${API_URL}/transactions?${params.toString()}`);
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setError('Failed to load transactions');
    }
  };

  // Fonction de recherche
  const handleSearch = async () => {
    if (!searchQuery) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithLogs(`${API_URL}/search?query=${searchQuery}&type=${searchType}`);
      setTransactions(response.data);
    } catch (error) {
      console.error('Error searching:', error);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Charger les données initiales
  useEffect(() => {
    console.log('Loading initial data...');
    loadStats();
    loadTransactions();

    // Rafraîchir les données toutes les 10 secondes
    const interval = setInterval(() => {
      console.log('Refreshing data...');
      loadStats();
      loadTransactions();
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedSubnet]);

  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <h1 className="text-4xl font-bold mb-8"></h1>

      {/* Afficher les erreurs */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Transactions par Subnet</h2>
          {stats.transactions.map((stat: any) => (
            <div key={stat.subnet} className="flex justify-between mb-2">
              <span>{stat.subnet}</span>
              <span className="font-mono">{stat.count}</span>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Volume par Subnet</h2>
          {stats.volumes.map((stat: any) => (
            <div key={stat.subnet} className="flex justify-between mb-2">
              <span>{stat.subnet}</span>
              <span className="font-mono">{parseFloat(stat.volume).toFixed(4)}</span>
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

      {/* Barre de recherche */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <div className="flex gap-4">
          <select
            className="px-4 py-2 border rounded"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
          >
            <option value="address">Adresse</option>
            <option value="hash">Hash</option>
            <option value="contract">Contract</option>
          </select>

          <input
            type="text"
            placeholder="Rechercher..."
            className="flex-1 px-4 py-2 border rounded"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />

          <button
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>

          <select
            className="px-4 py-2 border rounded"
            value={selectedSubnet}
            onChange={(e) => setSelectedSubnet(e.target.value)}
          >
            <option value="">Tous les Subnets</option>
            <option value="C-Chain">C-Chain</option>
            <option value="DFK">DFK</option>
            <option value="Swimmer">Swimmer</option>
            <option value="Dexalot">Dexalot</option>
          </select>
        </div>
      </div>

      {/* Liste des transactions */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hash</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subnet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx: any) => (
              <tr key={tx.hash} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">{formatAddress(tx.hash)}</td>
                <td className="px-6 py-4 font-mono text-sm">{formatAddress(tx.from_address)}</td>
                <td className="px-6 py-4 font-mono text-sm">{formatAddress(tx.to_address)}</td>
                <td className="px-6 py-4 text-sm">{parseFloat(tx.amount).toFixed(4)}</td>
                <td className="px-6 py-4 text-sm">{tx.subnet}</td>
                <td className="px-6 py-4 text-sm">{formatTimestamp(tx.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
