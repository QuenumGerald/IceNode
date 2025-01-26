import { useState } from 'react';

interface SearchProps {
    onSearch: (params: {
        query: string;
        subnet: string;
        isContract: string;
    }) => void;
}

export default function Search({ onSearch }: SearchProps) {
    const [searchParams, setSearchParams] = useState({
        query: '',
        subnet: '',
        isContract: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSearchParams(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchParams);
    };

    return (
        <div className="w-full p-4 bg-white rounded-lg shadow-sm mb-6">
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <input
                        type="text"
                        name="query"
                        placeholder="Rechercher (hash, adresse...)"
                        value={searchParams.query}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                
                <div className="md:w-48">
                    <select
                        name="subnet"
                        value={searchParams.subnet}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Tous les subnets</option>
                        <option value="C">C-Chain</option>
                        <option value="P">P-Chain</option>
                        <option value="X">X-Chain</option>
                    </select>
                </div>
                
                <div className="md:w-48">
                    <select
                        name="isContract"
                        value={searchParams.isContract}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Tous les types</option>
                        <option value="true">Contrats</option>
                        <option value="false">Transactions</option>
                    </select>
                </div>
                
                <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Rechercher
                </button>
            </form>
        </div>
    );
}
