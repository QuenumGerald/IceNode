-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    hash TEXT PRIMARY KEY,
    blockNumber INTEGER,
    "from" TEXT,
    "to" TEXT,
    value TEXT,
    timestamp INTEGER,
    subnet TEXT
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions("from");
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions("to");

-- Contract deployments table
CREATE TABLE IF NOT EXISTS contract_deployments (
    address TEXT PRIMARY KEY,
    deployer TEXT,
    timestamp INTEGER,
    subnet TEXT
);

-- Active wallets table
CREATE TABLE IF NOT EXISTS active_wallets (
    address TEXT PRIMARY KEY,
    first_seen INTEGER,
    last_seen INTEGER,
    transaction_count INTEGER DEFAULT 0,
    is_contract INTEGER DEFAULT 0,
    subnet TEXT,
    balance TEXT DEFAULT '0'
);

-- Insert some test data
INSERT OR IGNORE INTO transactions (hash, blockNumber, "from", "to", value, timestamp, subnet)
VALUES 
('0x123', 1, '0xabc', '0xdef', '1000000000000000000', strftime('%s','now'), 'C-Chain'),
('0x456', 2, '0xdef', '0xghi', '2000000000000000000', strftime('%s','now'), 'DFK'),
('0x789', 3, '0xghi', '0xjkl', '3000000000000000000', strftime('%s','now'), 'Swimmer');

-- Insert test contract deployment
INSERT OR IGNORE INTO contract_deployments (address, deployer, timestamp, subnet)
VALUES 
('0xcontract1', '0xdeployer1', strftime('%s','now'), 'C-Chain');

-- Insert test active wallets
INSERT OR IGNORE INTO active_wallets (address, first_seen, last_seen, transaction_count, is_contract, subnet, balance)
VALUES 
('0xabc', strftime('%s','now'), strftime('%s','now'), 1, 0, 'C-Chain', '1000000000000000000'),
('0xdef', strftime('%s','now'), strftime('%s','now'), 2, 0, 'DFK', '2000000000000000000'),
('0xcontract1', strftime('%s','now'), strftime('%s','now'), 1, 1, 'C-Chain', '0');
