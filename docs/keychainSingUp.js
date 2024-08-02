const connectBtn = document.getElementById('connectBtn');
let userAccount;
let contract;

connectBtn.addEventListener('click', async function() {
    try {
        if (typeof window.ethereum !== 'undefined') {
            console.log('MetaMask is installed!');

            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

            userAccount = accounts[0];
            localStorage.userAccount = userAccount;

            connectBtn.style.display = 'none';
            console.log("Connected account:", userAccount);

            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            const contractABI = [
                {
                    "anonymous": false,
                    "inputs": [
                        {
                            "indexed": true,
                            "internalType": "address",
                            "name": "user",
                            "type": "address"
                        },
                        {
                            "indexed": false,
                            "internalType": "string",
                            "name": "key",
                            "type": "string"
                        },
                        {
                            "indexed": false,
                            "internalType": "string",
                            "name": "encryptedValue",
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
                            "name": "key",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "value",
                            "type": "string"
                        }
                    ],
                    "name": "setKey",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "string",
                            "name": "key",
                            "type": "string"
                        },
                        {
                            "internalType": "string",
                            "name": "value",
                            "type": "string"
                        }
                    ],
                    "name": "setNewId",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "string",
                            "name": "key",
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
                }
            ];

            const contractAddress = '0x0ac2fE0CCe763e7947E60D021c6DC1554c000c4b'; 
            contract = new ethers.Contract(contractAddress, contractABI, signer);

        } else {
            alert('MetaMask is not installed. Please install it to use BlockCrypt');
        }
    } catch (error) {
        console.error("Error fetching accounts:", error);
    }
});

function encryptPassword(password, key) {
    return CryptoJS.AES.encrypt(password, key).toString();
}

// Decrypt function
function decryptPassword(encryptedPassword, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

const newUserButton = document.getElementById('newUser');
const inputText = document.getElementById('inputText'); 

const newUserFunction = async () => {
    const id = inputText.value;
    try {
        const existingValue = await contract.getValue(id); 
        if (existingValue) {
            alert('ID already exists. Please choose a different ID.');
            return;
        }

        const encryptedValue = encryptPassword('a', id);
        await contract.setNewId(id, encryptedValue); 
        alert('New ID created successfully!');
    } catch (error) {
        if (error.message.includes("User already has an ID")) {
            alert('User already has an ID. Cannot create a new one.');
        } else {
            alert('Error setting new ID');
        }
        console.error('Error setting new ID:', error);
    }
};

newUserButton.addEventListener('click', newUserFunction);