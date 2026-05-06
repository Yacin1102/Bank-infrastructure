CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_number VARCHAR(20) NOT NULL,
    owner_name VARCHAR(50) NOT NULL,
    balance DECIMAL(10,2) NOT NULL
);

INSERT IGNORE INTO accounts (account_number, owner_name, balance) VALUES
('ACC001', 'John Doe', 5000.00),
('ACC002', 'Jane Smith', 3200.50),
('ACC003', 'Bob Johnson', 12000.75);