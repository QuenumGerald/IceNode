'use client'

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import Search from '../components/Search';

const API_URL = 'https://icenode-production.up.railway.app';

const SUBNETS = {
  'mainnet': 'C-Chain',
  'dfk': 'DFK Chain',
  'swimmer': 'Swimmer Network',
  'dexalot': 'Dexalot'
};

// Fonction pour convertir les Wei en AVAX
const formatAvax = (value: string) => {
  try {
    return parseFloat(ethers.formatEther(value)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  } catch (err) {
    console.error('Error formatting AVAX value:', err);
    return '0.00';
  }
};

interface Transaction {
  hash: string;
  from_address: string;
  to_address: string;
  value: string;
  subnet: string;
  created_at: string;
  is_contract_creation: boolean;
  is_contract: boolean;
  contract_address?: string;
  contract_code?: string;
  contract_abi?: string;
}

interface SubnetStats {
  subnet: string;
  transaction_count: number;
  unique_senders: number;
  unique_receivers: number;
  total_volume: string;
  average_value: string;
  max_value: string;
  min_value: string;
}

interface TopAddress {
  address: string;
  subnet: string;
  volume: string;
}

interface ActivityPeriod {
  subnet: string;
  period: string;
  tx_count: number;
}

interface Stats {
  stats: SubnetStats[];
  topAddresses: TopAddress[];
  activity: ActivityPeriod[];
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    stats: [],
    topAddresses: [],
    activity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubnet, setSelectedSubnet] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all'); // 'all', 'address', 'contract', 'hash'

  const loadStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      setStats(response.data || { stats: [], topAddresses: [], activity: [] });
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics. Please try again later.');
    }
  }, []);

  const handleSearch = useCallback(async (searchParams: { query: string; subnet: string; isContract: string }) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchParams.query) params.append('query', searchParams.query);
      if (searchParams.subnet) params.append('subnet', searchParams.subnet);
      if (searchParams.isContract) params.append('isContract', searchParams.isContract);

      const response = await axios.get(`${API_URL}/search?${params.toString()}`);
      if (response.data.success) {
        setTransactions(response.data.transactions);
      } else {
        setError('La recherche a échoué. Veuillez réessayer.');
      }
    } catch (err) {
      console.error('Error searching:', err);
      setError('Une erreur est survenue lors de la recherche.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedSubnet) params.append('subnet', selectedSubnet);
      if (searchQuery) {
        params.append('search', searchQuery);
        params.append('type', searchType);
      }

      const response = await axios.get(`${API_URL}/transactions?${params.toString()}`);
      setTransactions(response.data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [selectedSubnet, searchQuery, searchType]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([loadStats(), loadTransactions()]);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [loadStats, loadTransactions]);

  if (loading && !transactions.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8"></h1>

        <Search onSearch={handleSearch} />

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
            {error}
          </div>
        )}

        {/* Statistiques par subnet */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.stats.map((stat) => (
            <div key={stat.subnet} className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">{SUBNETS[stat.subnet as keyof typeof SUBNETS] || stat.subnet}</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold">{stat.transaction_count.toLocaleString()}</p>
                  <p className="text-gray-600">transactions</p>
                </div>
                <div>
                  <p className="text-xl font-semibold">{formatAvax(stat.total_volume)} AVAX</p>
                  <p className="text-gray-600">volume total</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="font-medium">{stat.unique_senders.toLocaleString()}</p>
                    <p className="text-gray-600">émetteurs</p>
                  </div>
                  <div>
                    <p className="font-medium">{stat.unique_receivers.toLocaleString()}</p>
                    <p className="text-gray-600">récepteurs</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Adresses */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Top 5 Adresses par Volume</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subnet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.topAddresses.map((address) => (
                  <tr key={address.address}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      <a href={`https://subnets.avax.network/address/${address.address}`} target="_blank" rel="noopener noreferrer">
                        {address.address.slice(0, 8)}...{address.address.slice(-6)}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {SUBNETS[address.subnet as keyof typeof SUBNETS] || address.subnet}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatAvax(address.volume)} AVAX
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions Récentes */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <h2 className="text-lg font-medium leading-6 text-gray-900">Transactions Récentes</h2>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 w-full sm:w-96"
                />
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value="all">Tout</option>
                  <option value="address">Adresse</option>
                  <option value="contract">Contrat</option>
                  <option value="hash">Hash</option>
                </select>
              </div>
              <select
                value={selectedSubnet}
                onChange={(e) => setSelectedSubnet(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              >
                <option value="">Tous les Subnets</option>
                {Object.entries(SUBNETS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subnet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.hash}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <a href={`https://subnets.avax.network/transaction/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                          {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <a href={`https://subnets.avax.network/address/${tx.from_address}`} target="_blank" rel="noopener noreferrer">
                          {tx.from_address.slice(0, 6)}...{tx.from_address.slice(-4)}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tx.to_address ? (
                          <a href={`https://subnets.avax.network/address/${tx.to_address}`} target="_blank" rel="noopener noreferrer">
                            {tx.to_address.slice(0, 6)}...{tx.to_address.slice(-4)}
                          </a>
                        ) : (
                          <span className="text-yellow-600">Contract Creation</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatAvax(tx.value)} AVAX
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {tx.is_contract_creation ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Contract Creation
                          </span>
                        ) : tx.is_contract ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            Contract Call
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Transfer
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {SUBNETS[tx.subnet as keyof typeof SUBNETS] || tx.subnet}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
