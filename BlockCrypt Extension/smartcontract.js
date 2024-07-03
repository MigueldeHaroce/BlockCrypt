// Initialize Web3
const web3 = new Web3(new Web3.providers.HttpProvider('https://sepolia.infura.io/v3/b9750da435b048b885b77e0b1d42724b'));

// Add your private key to the wallet
web3.eth.accounts.wallet.add("0xb062fa28696d5b56fe0ad7d5b7ef616c9c1c5dcd3352cd4958fdcd5ab1ac17ed");

// Your contract ABI and address
const contractABI = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "string",
                "name": "id",
                "type": "string"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "pass",
                "type": "string"
            }
        ],
        "name": "KeyValuePairSet",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "id",
                "type": "string"
            }
        ],
        "name": "getValue",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "id",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "pass",
                "type": "string"
            }
        ],
        "name": "setKey",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
const contractAddress = '0x15E77C7DAe92952f627739f0473D17F29019EB28'; // Your contract address

// Get the contract instance
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Save password button click event
document.getElementById('saves-btn').addEventListener('click', async () => {
    const id = document.getElementById('user-id').value;
    const password = document.getElementById('password').value;
    console.log('Password value:', password); // Log password value
    try {
        await contract.methods.setKey(id, password).send({ from: '0xfd12Db8cC3C69edc632d7e11E2f0eEA60dFd995c' });
        alert('Password saved successfully!');
        console.log('Password saved successfully!');
    } catch (error) {
        alert('Error saving password');
        console.error('Error saving password:', error);
    }
});

// Retrieve passwords button click event
document.getElementById('view-passwords-btn').addEventListener('click', async () => {
    const id = document.getElementById('user-id').value;
    try {
        const passwords = await contract.methods.getValue(id).call();
        const outputDiv = document.getElementById('passwordOutput');
        console.log('Passwords retrieved:', passwords);
    } catch (error) {
        alert('Error retrieving passwords');
        console.error('Error retrieving passwords:', error);
    }
});